import { createClient } from "@/lib/supabase/client";
import {
  parseSavedEventsSnapshot,
  readSavedEvents,
} from "@/lib/saved-events";
import type { SavedEventRecord } from "@/types/saved-event";

const CLOUD_CHANGE_EVENT = "eventoai:cloud-events-changed";

type CloudEventRow = {
  id: string;
  data: SavedEventRecord;
  updated_at: string;
  deleted_at: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function notifyCloudEventsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLOUD_CHANGE_EVENT));
  }
}

export function subscribeToCloudEvents(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(CLOUD_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener(CLOUD_CHANGE_EVENT, callback);
  };
}

async function requireAuthenticatedUser(
  client: ReturnType<typeof createClient>,
) {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error(
      "Your session is unavailable. Sign in again before accessing cloud events.",
    );
  }

  return data.user;
}

function validateCloudRows(rows: unknown): CloudEventRow[] {
  if (!Array.isArray(rows)) {
    throw new Error("The cloud returned an invalid event list.");
  }

  return rows.map((row: unknown) => {
    if (
      !isObject(row) ||
      typeof row.id !== "string" ||
      typeof row.updated_at !== "string" ||
      !isObject(row.data) ||
      row.data.id !== row.id ||
      !(
        row.deleted_at === null ||
        typeof row.deleted_at === "string"
      )
    ) {
      throw new Error("A cloud event record failed its integrity check.");
    }

    // Validate each record separately: the list parser sorts records,
    // so parsing the entire array could change row-to-record alignment.
    const parsed = parseSavedEventsSnapshot(JSON.stringify([row.data]));

    if (parsed.length !== 1 || parsed[0].id !== row.id) {
      throw new Error("A cloud event record failed schema validation.");
    }

    return {
      id: row.id,
      data: parsed[0],
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
  });
}

async function fetchCloudRows(
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<CloudEventRow[]> {
  const { data, error } = await client
    .from("events")
    .select("id, data, updated_at, deleted_at")
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not load your cloud event records.");
  }

  return validateCloudRows(data);
}

export async function loadCloudEvents(): Promise<SavedEventRecord[]> {
  const client = createClient();
  const user = await requireAuthenticatedUser(client);
  const rows = await fetchCloudRows(client, user.id);

  return rows
    .filter((row) => row.deleted_at === null)
    .map((row) => row.data)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Save using insert for new records and compare-and-update for existing
 * records. Never use an unconditional upsert that can resurrect a tombstone.
 */
export async function saveCloudEvent(
  record: SavedEventRecord,
): Promise<void> {
  const client = createClient();
  const user = await requireAuthenticatedUser(client);
  const rows = await fetchCloudRows(client, user.id);
  const existing = rows.find((row) => row.id === record.id);

  if (existing?.deleted_at !== undefined && existing?.deleted_at !== null) {
    throw new Error(
      "This event has been deleted from your account. Create a new event instead of restoring a stale browser copy.",
    );
  }

  if (existing) {
    if (existing.data.currentVersionId === record.currentVersionId) {
      notifyCloudEventsChanged();
      return;
    }

    const currentVersion = record.versions.find(
      (version) => version.id === record.currentVersionId,
    );

    const previousVersion = currentVersion
      ? record.versions
          .filter((version) => version.version < currentVersion.version)
          .sort((a, b) => b.version - a.version)[0]
      : undefined;

    if (
      !previousVersion ||
      previousVersion.id !== existing.data.currentVersionId
    ) {
      throw new Error(
        "This event changed in the cloud since you opened it. Reload My Events before making another update.",
      );
    }

    const { data, error } = await client
      .from("events")
      .update({
        data: record,
        updated_at: record.updatedAt,
      })
      .eq("user_id", user.id)
      .eq("id", record.id)
      .eq("updated_at", existing.updated_at)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        "The event was not updated because it changed concurrently. Reload My Events and try again.",
      );
    }
  } else {
    const { error } = await client
      .from("events")
      .insert({
        user_id: user.id,
        id: record.id,
        data: record,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        deleted_at: null,
      });

    if (error) {
      throw new Error(
        "Could not create this cloud event. It may have been created in another session; reload My Events and try again.",
      );
    }
  }

  notifyCloudEventsChanged();
}

/**
 * Soft-delete an event. The retained row prevents an import of an old local
 * copy from silently recreating the deleted event.
 */
export async function deleteCloudEvent(id: string): Promise<void> {
  const client = createClient();
  const user = await requireAuthenticatedUser(client);
  const rows = await fetchCloudRows(client, user.id);
  const existing = rows.find((row) => row.id === id);

  // A browser-only event has no cloud row. Deleting it locally is safe.
  if (!existing || existing.deleted_at !== null) {
    notifyCloudEventsChanged();
    return;
  }

  const now = new Date().toISOString();

  const { data, error } = await client
    .from("events")
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .eq("id", id)
    .eq("updated_at", existing.updated_at)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "The event could not be deleted because it changed concurrently. Reload My Events and try again.",
    );
  }

  notifyCloudEventsChanged();
}

/**
 * Count local records whose IDs do not exist in the account at all.
 * A tombstone counts as an existing ID and must never be re-imported.
 */
export async function getImportableLocalEventCount(): Promise<number> {
  const client = createClient();
  const user = await requireAuthenticatedUser(client);
  const [rows] = await Promise.all([
    fetchCloudRows(client, user.id),
  ]);

  const cloudIds = new Set(rows.map((row) => row.id));

  return readSavedEvents().filter(
    (record) => !cloudIds.has(record.id),
  ).length;
}

/**
 * Import only missing IDs, and only when explicitly requested by the UI.
 * This function uses INSERT, never UPSERT, so it cannot overwrite a cloud
 * record or resurrect an event represented by a tombstone.
 */
export async function importLocalEventsToCloud(): Promise<{
  importedCount: number;
  skippedCount: number;
  cloudCount: number;
}> {
  const client = createClient();
  const user = await requireAuthenticatedUser(client);
  const localRecords = readSavedEvents();
  const rows = await fetchCloudRows(client, user.id);
  const existingIds = new Set(rows.map((row) => row.id));

  let importedCount = 0;
  let skippedCount = 0;

  for (const record of localRecords) {
    if (existingIds.has(record.id)) {
      skippedCount += 1;
      continue;
    }

    const { error } = await client
      .from("events")
      .insert({
        user_id: user.id,
        id: record.id,
        data: record,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
        deleted_at: null,
      });

    if (error) {
      // A concurrent insert may have claimed this ID. Never overwrite it.
      if (error.code === "23505") {
        skippedCount += 1;
        existingIds.add(record.id);
        continue;
      }

      throw new Error(
        "The import stopped because an event could not be saved. Already imported records remain in your account; you can safely retry.",
      );
    }

    importedCount += 1;
    existingIds.add(record.id);
  }

  const finalRows = await fetchCloudRows(client, user.id);

  notifyCloudEventsChanged();

  return {
    importedCount,
    skippedCount,
    cloudCount: finalRows.filter((row) => row.deleted_at === null).length,
  };
}