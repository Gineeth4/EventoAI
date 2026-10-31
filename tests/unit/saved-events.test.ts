import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlanResult } from "@/components/planner/event-planner";
import {
  deleteSavedEvent,
  parseSavedEventsSnapshot,
  readSavedEvents,
  restoreSavedEventVersion,
  saveEventRecord,
} from "@/lib/saved-events";
import type { SavedEventInput } from "@/types/saved-event";

const STORAGE_KEY = "eventoai:saved-events:v2";
const LEGACY_STORAGE_KEY = "eventoai:saved-events:v1";

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
    notes: "Sample event for the unit test.",
  },
  planningPriorities: ["budget", "guest_experience"],
};

function createSampleResult(summary = "A practical event plan"): PlanResult {
  // The storage layer checks this minimum shape when reading a record.
  // The production API provides the full, validated PlanResult.
  return {
    plan: {
      summary,
    },
    budgetSummary: {
      projectedTotal: 18000,
    },
  } as unknown as PlanResult;
}

describe("saved event storage", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map<string, string>();

    const localStorageMock = {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    };

    const windowMock = {
      localStorage: localStorageMock,
      dispatchEvent: vi.fn(() => true),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal("window", windowMock as unknown as Window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves an event and makes it available to read", () => {
    const saved = saveEventRecord({
      id: "event-1",
      input: sampleInput,
      result: createSampleResult(),
    });

    expect(saved.id).toBe("event-1");
    expect(saved.schemaVersion).toBe(2);
    expect(readSavedEvents()).toHaveLength(1);
    expect(readSavedEvents()[0].input.title).toBe(
      "Garden birthday celebration",
    );

    expect(storage.has(STORAGE_KEY)).toBe(true);
  });

  it("updates an existing event without creating a duplicate", () => {
    const original = saveEventRecord({
      id: "event-1",
      input: sampleInput,
      result: createSampleResult(),
    });

    const updatedInput: SavedEventInput = {
      ...sampleInput,
      title: "Updated garden celebration",
    };

    saveEventRecord({
      id: "event-1",
      input: updatedInput,
      result: createSampleResult("Updated plan"),
    });

    const records = readSavedEvents();

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("event-1");
    expect(records[0].createdAt).toBe(original.createdAt);
    expect(records[0].input.title).toBe("Updated garden celebration");
    expect(records[0].result.plan.summary).toBe("Updated plan");
  });

  it("deletes an event by ID", () => {
    saveEventRecord({
      id: "event-1",
      input: sampleInput,
      result: createSampleResult(),
    });

    saveEventRecord({
      id: "event-2",
      input: {
        ...sampleInput,
        title: "Anniversary celebration",
      },
      result: createSampleResult(),
    });

    deleteSavedEvent("event-1");

    const records = readSavedEvents();

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("event-2");
  });

  it("ignores malformed JSON rather than crashing", () => {
    expect(parseSavedEventsSnapshot("{invalid-json")).toEqual([]);
  });

  it("ignores records that do not match the saved-record format", () => {
    expect(
      parseSavedEventsSnapshot(
        JSON.stringify([{ id: "incomplete-record" }]),
      ),
    ).toEqual([]);
  });

  it.each([
  { eventDate: "2024-02-29", expectedValid: true },
  { eventDate: "2026-02-28", expectedValid: true },
  { eventDate: "2026-04-30", expectedValid: true },
  { eventDate: "2026-02-29", expectedValid: false },
  { eventDate: "2026-02-31", expectedValid: false },
  { eventDate: "2026-04-31", expectedValid: false },
  { eventDate: "2026-13-01", expectedValid: false },
  { eventDate: "2026-00-10", expectedValid: false },
  { eventDate: "2026-01-00", expectedValid: false },
  { eventDate: "2026-01-32", expectedValid: false },
  { eventDate: "2026-2-01", expectedValid: false },
])(
  "validates calendar date $eventDate",
  ({ eventDate, expectedValid }) => {
    const record = saveEventRecord({
      id: "event-date-validation",
      input: sampleInput,
      result: createSampleResult("Date validation"),
    });

    const candidate = {
      ...record,
      input: {
        ...record.input,
        eventDate,
      },
    };

    expect(
      parseSavedEventsSnapshot(JSON.stringify([candidate])),
    ).toHaveLength(expectedValid ? 1 : 0);
  },
);

  it("migrates valid schema-v1 records and preserves their initial snapshot", () => {
    storage.set(
      LEGACY_STORAGE_KEY,
      JSON.stringify([
        {
          id: "legacy-event",
          schemaVersion: 1,
          createdAt: "2026-10-01T10:00:00.000Z",
          updatedAt: "2026-10-02T10:00:00.000Z",
          input: sampleInput,
          result: createSampleResult("Legacy plan"),
        },
      ]),
    );

    const migrated = readSavedEvents();

    expect(migrated).toHaveLength(1);
    expect(migrated[0].schemaVersion).toBe(2);
    expect(migrated[0].versions).toHaveLength(1);
    expect(migrated[0].versions[0].version).toBe(1);
    expect(migrated[0].result.plan.summary).toBe("Legacy plan");
    expect(storage.has(STORAGE_KEY)).toBe(true);
    expect(storage.has(LEGACY_STORAGE_KEY)).toBe(false);
  });

  it("creates a new version for each meaningful update", () => {
    saveEventRecord({
      id: "event-history",
      input: sampleInput,
      result: createSampleResult("Version one"),
    });

    saveEventRecord({
      id: "event-history",
      input: sampleInput,
      result: createSampleResult("Version two"),
    });

    const record = readSavedEvents()[0];

    expect(record.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(record.versions[0].changeType).toBe("created");
    expect(record.versions[1].changeType).toBe("updated");
    expect(record.currentVersionId).toBe(record.versions[1].id);
    expect(record.result.plan.summary).toBe("Version two");
  });

  it("restores an earlier snapshot as a new version and clears approval", () => {
    const approvedInitial: PlanResult = {
      ...createSampleResult("Original approved plan"),
      approval: {
        status: "approved",
        approvedAt: "2026-10-01T10:00:00.000Z",
      },
    };

    saveEventRecord({
      id: "event-restore",
      input: sampleInput,
      result: approvedInitial,
    });

    saveEventRecord({
      id: "event-restore",
      input: sampleInput,
      result: createSampleResult("Updated plan"),
    });

    const beforeRestore = readSavedEvents()[0];
    const originalVersion = beforeRestore.versions.find(
      (version) => version.version === 1,
    );

    if (!originalVersion) {
      throw new Error("Test setup failed to create the initial version.");
    }

    const restored = restoreSavedEventVersion(
      "event-restore",
      originalVersion.id,
    );

    expect(restored.versions).toHaveLength(3);
    expect(restored.versions[2].version).toBe(3);
    expect(restored.versions[2].changeType).toBe("restored");
    expect(restored.versions[2].restoredFromVersion).toBe(1);
    expect(restored.result.plan.summary).toBe("Original approved plan");
    expect(restored.result.approval).toBeUndefined();
    expect(readSavedEvents()[0].currentVersionId).toBe(
      restored.currentVersionId,
    );
  });

  it("retains only the eight newest versions", () => {
    for (let index = 1; index <= 10; index++) {
      saveEventRecord({
        id: "event-bounded-history",
        input: sampleInput,
        result: createSampleResult(`Plan ${index}`),
      });
    }

    const record = readSavedEvents()[0];

    expect(record.versions).toHaveLength(8);
    expect(record.versions[0].version).toBe(3);
    expect(record.versions[7].version).toBe(10);
    expect(record.result.plan.summary).toBe("Plan 10");
  });

  it("does not create a duplicate version when the saved content is unchanged", () => {
    const first = saveEventRecord({
      id: "event-unchanged",
      input: sampleInput,
      result: createSampleResult("Unchanged plan"),
    });

    const second = saveEventRecord({
      id: "event-unchanged",
      input: sampleInput,
      result: createSampleResult("Unchanged plan"),
    });

    expect(second.currentVersionId).toBe(first.currentVersionId);
    expect(readSavedEvents()[0].versions).toHaveLength(1);
  });

  it("preserves the current plan when version-history metadata is malformed", () => {
    const malformedV2Record = {
      id: "event-recovery",
      schemaVersion: 2,
      createdAt: "2026-10-01T10:00:00.000Z",
      updatedAt: "2026-10-03T10:00:00.000Z",
      input: sampleInput,
      result: createSampleResult("Keep this current plan"),
      currentVersionId: "missing-version",
      versions: [{ id: "broken-version" }],
    };

    const recovered = parseSavedEventsSnapshot(
      JSON.stringify([malformedV2Record]),
    );

    expect(recovered).toHaveLength(1);
    expect(recovered[0].result.plan.summary).toBe("Keep this current plan");
    expect(recovered[0].versions).toHaveLength(1);
    expect(recovered[0].versions[0].changeType).toBe("recovered");
    expect(recovered[0].currentVersionId).toBe(
      recovered[0].versions[0].id,
    );
  });

  it("surfaces localStorage write failures instead of reporting a successful save", () => {
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new Error("Quota exceeded");
    });

    expect(() =>
      saveEventRecord({
        id: "event-storage-failure",
        input: sampleInput,
        result: createSampleResult(),
      }),
    ).toThrow(/could not be saved/i);

    expect(storage.has(STORAGE_KEY)).toBe(false);
  });
});