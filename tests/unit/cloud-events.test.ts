import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanResult } from "@/components/planner/event-planner";
import {
  deleteCloudEvent,
  importLocalEventsToCloud,
  loadCloudEvents,
  saveCloudEvent,
} from "@/lib/cloud-events";
import { saveEventRecord } from "@/lib/saved-events";
import type {
  SavedEventInput,
  SavedEventRecord,
} from "@/types/saved-event";

type MockFilter = {
  operator: "eq" | "is";
  column: string;
  value: unknown;
};

type MockRow = {
  user_id: string;
  id: string;
  data: SavedEventRecord;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  [key: string]: unknown;
};

type MockQueryCall = {
  table: string;
  action: "select" | "insert" | "update";
  filters: MockFilter[];
  payload?: Record<string, unknown>;
};

const { createClientMock, state } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  state: {
    userId: "user-a" as string | null,
    rows: [] as MockRow[],
    calls: [] as MockQueryCall[],
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: createClientMock,
}));

const sampleInput: SavedEventInput = {
  eventType: "birthday",
  title: "Garden birthday celebration",
  eventDate: "2027-01-15",
  guestCount: 40,
  location: {
    city: "Chennai",
    country: "India",
    venueType: "outdoor",
  },
  budget: {
    currency: "INR",
    totalAmount: 25000,
    contingencyPercent: 10,
  },
  preferences: {
    preferredThemes: ["garden"],
    preferredStyles: ["family-friendly"],
    notes: "Cloud persistence test record.",
  },
  planningPriorities: ["budget", "guest_experience"],
};

function createSampleResult(summary: string): PlanResult {
  return {
    plan: { summary },
    budgetSummary: { projectedTotal: 18000 },
  } as unknown as PlanResult;
}

let storage: Map<string, string>;

function makeRecord(
  id: string,
  title = "Garden birthday celebration",
): SavedEventRecord {
  return saveEventRecord({
    id,
    input: { ...sampleInput, title },
    result: createSampleResult(title),
  });
}

function makeRow(
  record: SavedEventRecord,
  userId: string,
  deletedAt: string | null = null,
): MockRow {
  return {
    user_id: userId,
    id: record.id,
    data: record,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    deleted_at: deletedAt,
  };
}

function buildMockQuery(table: string) {
  const call: MockQueryCall = {
    table,
    action: "select",
    filters: [],
  };

  state.calls.push(call);

  const matches = (row: MockRow) =>
    call.filters.every((filter) => row[filter.column] === filter.value);

  const builder: {
    select: (columns: string) => typeof builder;
    eq: (column: string, value: unknown) => typeof builder;
    is: (column: string, value: unknown) => typeof builder;
    update: (payload: Record<string, unknown>) => typeof builder;
    insert: (
      payload: Record<string, unknown>,
    ) => Promise<{ error: { code: string } | null; data: null }>;
    maybeSingle: () => Promise<{ data: { id: string } | null; error: null }>;
    then: (
      resolve?: ((value: { data: MockRow[]; error: null }) => unknown) | null,
      reject?: ((reason: unknown) => unknown) | null,
    ) => Promise<unknown>;
  } = {
    select() {
      if (call.action !== "update") {
        call.action = "select";
      }
      return builder;
    },

    eq(column, value) {
      call.filters.push({ operator: "eq", column, value });
      return builder;
    },

    is(column, value) {
      call.filters.push({ operator: "is", column, value });
      return builder;
    },

    update(payload) {
      call.action = "update";
      call.payload = payload;
      return builder;
    },

    async insert(payload) {
      call.action = "insert";
      call.payload = payload;

      const duplicate = state.rows.some(
        (row) =>
          row.user_id === payload.user_id && row.id === payload.id,
      );

      if (duplicate) {
        return { error: { code: "23505" }, data: null };
      }

      state.rows.push({ ...payload } as unknown as MockRow);
      return { error: null, data: null };
    },

    async maybeSingle() {
      const row = state.rows.find(matches);

      if (call.action !== "update" || !row) {
        return { data: null, error: null };
      }

      Object.assign(row, call.payload);
      return { data: { id: row.id }, error: null };
    },

    then(resolve, reject) {
      const result = {
        data: state.rows.filter(matches).map((row) => ({ ...row })),
        error: null as null,
      };

      return Promise.resolve(result).then(resolve, reject);
    },
  };

  return builder;
}

function installMockClient(): void {
  createClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: state.userId ? { id: state.userId } : null,
        },
        error: null,
      })),
    },
    from: vi.fn((table: string) => buildMockQuery(table)),
  });
}

describe("cloud event ownership and persistence", () => {
  beforeEach(() => {
    storage = new Map<string, string>();
    state.userId = "user-a";
    state.rows = [];
    state.calls = [];

    vi.stubGlobal(
      "window",
      {
        localStorage: {
          getItem: vi.fn((key: string) => storage.get(key) ?? null),
          setItem: vi.fn((key: string, value: string) => {
            storage.set(key, value);
          }),
          removeItem: vi.fn((key: string) => {
            storage.delete(key);
          }),
        },
        dispatchEvent: vi.fn(() => true),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as Window,
    );

    installMockClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads only the signed-in user's active events", async () => {
    const ownEvent = makeRecord("own-event", "My event");
    const otherEvent = makeRecord("other-event", "Another account's event");
    const deletedEvent = makeRecord("deleted-event", "Deleted event");

    state.rows.push(
      makeRow(otherEvent, "user-b"),
      makeRow(deletedEvent, "user-a", "2026-10-20T10:00:00.000Z"),
      makeRow(ownEvent, "user-a"),
    );

    const loaded = await loadCloudEvents();

    expect(loaded.map((record) => record.id)).toEqual(["own-event"]);

    const selectCall = state.calls.find(
      (call) => call.action === "select",
    );

    expect(
      selectCall?.filters.some(
        (filter) =>
          filter.column === "user_id" && filter.value === "user-a",
      ),
    ).toBe(true);
  });

  it("rejects cloud access when no user is authenticated", async () => {
    state.userId = null;

    await expect(loadCloudEvents()).rejects.toThrow(
      /session is unavailable/i,
    );

    expect(state.calls).toHaveLength(0);
  });

  it("assigns inserts to the authenticated account, even when another account uses the same ID", async () => {
    const record = makeRecord("shared-event");
    state.rows.push(makeRow(record, "user-b"));

    await saveCloudEvent(record);

    const matchingRows = state.rows.filter(
      (row) => row.id === "shared-event",
    );

    expect(matchingRows.map((row) => row.user_id).sort()).toEqual([
      "user-a",
      "user-b",
    ]);

    const inserted = matchingRows.find((row) => row.user_id === "user-a");
    expect(inserted?.data.id).toBe("shared-event");
  });

  it("updates only the current user's row and uses concurrency filters", async () => {
    const original = makeRecord("versioned-event", "Version one");
    const updated = saveEventRecord({
      id: original.id,
      input: { ...sampleInput, title: "Version two" },
      result: createSampleResult("Version two"),
    });

    // Put the other account's matching row first to detect an update
    // that forgets to scope the write to the authenticated user.
    state.rows.push(
      makeRow(original, "user-b"),
      makeRow(original, "user-a"),
    );

    await saveCloudEvent(updated);

    const otherAccountRow = state.rows.find(
      (row) => row.user_id === "user-b",
    );
    const ownAccountRow = state.rows.find(
      (row) => row.user_id === "user-a",
    );

    expect(otherAccountRow?.data.currentVersionId).toBe(
      original.currentVersionId,
    );
    expect(ownAccountRow?.data.currentVersionId).toBe(
      updated.currentVersionId,
    );

    const updateCall = state.calls.find(
      (call) => call.action === "update",
    );

    expect(
      updateCall?.filters.some(
        (filter) =>
          filter.column === "user_id" && filter.value === "user-a",
      ),
    ).toBe(true);
    expect(
      updateCall?.filters.some(
        (filter) =>
          filter.column === "updated_at" &&
          filter.value === original.updatedAt,
      ),
    ).toBe(true);
    expect(
      updateCall?.filters.some(
        (filter) =>
          filter.column === "deleted_at" && filter.value === null,
      ),
    ).toBe(true);
  });

  it("refuses to restore a stale record over a deletion tombstone", async () => {
    const record = makeRecord("deleted-event");
    state.rows.push(
      makeRow(record, "user-a", "2026-10-20T10:00:00.000Z"),
    );

    await expect(saveCloudEvent(record)).rejects.toThrow(
      /event has been deleted/i,
    );

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].deleted_at).not.toBeNull();
    expect(
      state.calls.some((call) => call.action === "insert"),
    ).toBe(false);
    expect(
      state.calls.some((call) => call.action === "update"),
    ).toBe(false);
  });

  it("soft-deletes only the current user's event", async () => {
    const record = makeRecord("delete-test");
    state.rows.push(
      makeRow(record, "user-b"),
      makeRow(record, "user-a"),
    );

    await deleteCloudEvent(record.id);

    const otherAccountRow = state.rows.find(
      (row) => row.user_id === "user-b",
    );
    const ownAccountRow = state.rows.find(
      (row) => row.user_id === "user-a",
    );

    expect(otherAccountRow?.deleted_at).toBeNull();
    expect(ownAccountRow?.deleted_at).toEqual(expect.any(String));

    const updateCall = state.calls.find(
      (call) => call.action === "update",
    );

    expect(
      updateCall?.filters.some(
        (filter) =>
          filter.column === "user_id" && filter.value === "user-a",
      ),
    ).toBe(true);
    expect(updateCall?.action).toBe("update");
    expect(updateCall?.payload).toHaveProperty("deleted_at");
  });

  it("imports missing local events without resurrecting tombstones or overwriting another account", async () => {
    const tombstoned = makeRecord("local-deleted", "Old local copy");
    const missing = makeRecord("local-new", "New local event");
    const otherOnly = makeRecord("local-exists-for-another-user");

    state.rows.push(
      makeRow(tombstoned, "user-a", "2026-10-20T10:00:00.000Z"),
      makeRow(otherOnly, "user-b"),
    );

    const result = await importLocalEventsToCloud();

    expect(result).toEqual({
      importedCount: 2,
      skippedCount: 1,
      cloudCount: 2,
    });

    expect(
      state.rows.some(
        (row) =>
          row.user_id === "user-a" &&
          row.id === tombstoned.id &&
          row.deleted_at !== null,
      ),
    ).toBe(true);

    expect(
      state.rows.some(
        (row) =>
          row.user_id === "user-a" && row.id === missing.id,
      ),
    ).toBe(true);

    expect(
      state.rows.some(
        (row) =>
          row.user_id === "user-a" && row.id === otherOnly.id,
      ),
    ).toBe(true);

    const otherUserOriginal = state.rows.find(
      (row) => row.user_id === "user-b" && row.id === otherOnly.id,
    );

    expect(otherUserOriginal?.user_id).toBe("user-b");
  });
});
