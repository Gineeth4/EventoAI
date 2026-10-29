import type { PlanResult } from "@/components/planner/event-planner";
import type {
  SaveEventRecordInput,
  SavedEventInput,
  SavedEventRecord,
  SavedEventVersion,
} from "@/types/saved-event";

const STORAGE_KEY = "eventoai:saved-events:v2";
const LEGACY_STORAGE_KEY = "eventoai:saved-events:v1";
const CHANGE_EVENT = "eventoai:saved-events-changed";
const MAX_VERSION_HISTORY = 8;

type EventCore = {
  id: string;
  createdAt: string;
  updatedAt: string;
  input: SavedEventInput;
  result: PlanResult;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string");
}

function isValidDateTime(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value));
}

/**
 * Validates an exact YYYY-MM-DD calendar date without accepting
 * impossible dates that JavaScript Date.parse may normalize.
 */
function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10) {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    return false;
  }

  const isLeapYear =
    year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0);

  const daysPerMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  const maximumDay = daysPerMonth[month - 1];

  return day >= 1 && day <= maximumDay;
}

function isSavedEventInput(value: unknown): value is SavedEventInput {
  if (!isObject(value)) {
    return false;
  }

  const location = value.location;
  const budget = value.budget;
  const preferences = value.preferences;

  if (
    typeof value.eventType !== "string" ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    !isValidCalendarDate(value.eventDate) ||
    typeof value.guestCount !== "number" ||
    !Number.isFinite(value.guestCount) ||
    value.guestCount < 1 ||
    !isObject(location) ||
    typeof location.city !== "string" ||
    typeof location.country !== "string" ||
    typeof location.venueType !== "string" ||
    !isObject(budget) ||
    typeof budget.currency !== "string" ||
    !budget.currency.trim() ||
    typeof budget.totalAmount !== "number" ||
    !Number.isFinite(budget.totalAmount) ||
    budget.totalAmount <= 0 ||
    typeof budget.contingencyPercent !== "number" ||
    !Number.isFinite(budget.contingencyPercent) ||
    budget.contingencyPercent < 0 ||
    budget.contingencyPercent > 50 ||
    !isObject(preferences) ||
    !isStringArray(preferences.preferredThemes) ||
    !isStringArray(preferences.preferredStyles) ||
    typeof preferences.notes !== "string" ||
    !isStringArray(value.planningPriorities)
  ) {
    return false;
  }

  return true;
}

function isPlanResult(value: unknown): value is PlanResult {
  if (!isObject(value)) {
    return false;
  }

  const plan = value.plan;
  const budgetSummary = value.budgetSummary;

  return (
    isObject(plan) &&
    typeof plan.summary === "string" &&
    isObject(budgetSummary) &&
    typeof budgetSummary.projectedTotal === "number" &&
    Number.isFinite(budgetSummary.projectedTotal) &&
    budgetSummary.projectedTotal >= 0
  );
}

function readEventCore(
  value: Record<string, unknown>,
): EventCore | null {
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    !isValidDateTime(value.createdAt) ||
    !isValidDateTime(value.updatedAt) ||
    !isSavedEventInput(value.input) ||
    !isPlanResult(value.result)
  ) {
    return null;
  }

  return {
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    input: value.input,
    result: value.result,
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function randomSuffix(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEventId(): string {
  return `event-${randomSuffix()}`;
}

function createVersionId(eventId: string, version: number): string {
  return `${eventId}:v${version}:${randomSuffix()}`;
}

function isSavedEventVersion(
  value: unknown,
): value is SavedEventVersion {
  if (!isObject(value)) {
    return false;
  }

  const validChangeType =
    value.changeType === "created" ||
    value.changeType === "updated" ||
    value.changeType === "restored" ||
    value.changeType === "recovered";

  const validRestoreReference =
    value.restoredFromVersion === undefined ||
    (
      typeof value.restoredFromVersion === "number" &&
      Number.isSafeInteger(value.restoredFromVersion) &&
      value.restoredFromVersion >= 1
    );

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.version === "number" &&
    Number.isSafeInteger(value.version) &&
    value.version >= 1 &&
    value.version <= 1_000_000_000 &&
    isValidDateTime(value.createdAt) &&
    validChangeType &&
    validRestoreReference &&
    isSavedEventInput(value.input) &&
    isPlanResult(value.result)
  );
}

function makeVersion(
  eventId: string,
  versionNumber: number,
  createdAt: string,
  changeType: SavedEventVersion["changeType"],
  input: SavedEventInput,
  result: PlanResult,
  restoredFromVersion?: number,
): SavedEventVersion {
  return {
    id: createVersionId(eventId, versionNumber),
    version: versionNumber,
    createdAt,
    changeType,
    input: cloneJson(input),
    result: cloneJson(result),
    ...(restoredFromVersion === undefined
      ? {}
      : { restoredFromVersion }),
  };
}

function normalizeSavedEventRecord(
  value: unknown,
): SavedEventRecord | null {
  if (!isObject(value)) {
    return null;
  }

  const core = readEventCore(value);

  if (!core) {
    return null;
  }

  // Migrate the original schema-v1 record to a v2 record with
  // an initial version representing the saved plan at that time.
  if (value.schemaVersion === 1) {
    const initialVersion: SavedEventVersion = {
      id: `${core.id}:v1:legacy`,
      version: 1,
      createdAt: core.createdAt,
      changeType: "created",
      input: cloneJson(core.input),
      result: cloneJson(core.result),
    };

    return {
      id: core.id,
      schemaVersion: 2,
      createdAt: core.createdAt,
      updatedAt: core.updatedAt,
      input: core.input,
      result: core.result,
      currentVersionId: initialVersion.id,
      versions: [initialVersion],
    };
  }

  if (value.schemaVersion !== 2) {
    return null;
  }

  const candidateVersions = Array.isArray(value.versions)
    ? value.versions.filter(isSavedEventVersion).map(cloneJson)
    : [];

  const byVersion = new Map<number, SavedEventVersion>();
  const seenIds = new Set<string>();

  for (const version of candidateVersions) {
    if (
      !byVersion.has(version.version) &&
      !seenIds.has(version.id)
    ) {
      byVersion.set(version.version, version);
      seenIds.add(version.id);
    }
  }

  let versions = [...byVersion.values()].sort(
    (a, b) => a.version - b.version,
  );

  let currentVersion =
    typeof value.currentVersionId === "string"
      ? versions.find((version) => version.id === value.currentVersionId)
      : undefined;

  const highestVersion = versions.reduce(
    (highest, version) => Math.max(highest, version.version),
    0,
  );

  const currentMatchesRecord =
    currentVersion !== undefined &&
    sameJson(currentVersion.input, core.input) &&
    sameJson(currentVersion.result, core.result);

  // Never discard a valid current plan because its history metadata
  // is incomplete or inconsistent. Reconstruct a recovery snapshot.
  if (
    !currentMatchesRecord ||
    !currentVersion ||
    currentVersion.version < highestVersion
  ) {
    const nextVersion = highestVersion + 1;

    currentVersion = {
      id: `${core.id}:v${nextVersion}:recovered`,
      version: nextVersion,
      createdAt: core.updatedAt,
      changeType: "recovered",
      input: cloneJson(core.input),
      result: cloneJson(core.result),
    };

    versions = [
      ...versions,
      currentVersion,
    ];
  }

  versions = versions.slice(-MAX_VERSION_HISTORY);

  return {
    id: core.id,
    schemaVersion: 2,
    createdAt: core.createdAt,
    updatedAt: core.updatedAt,
    input: core.input,
    result: core.result,
    currentVersionId: currentVersion.id,
    versions,
  };
}

/**
 * Read the v2 snapshot first, falling back to the legacy key.
 * This function is side-effect-free for React external-store reads.
 */
export function getSavedEventsSnapshot(): string {
  if (typeof window === "undefined") {
    return "[]";
  }

  try {
    const current = window.localStorage.getItem(STORAGE_KEY);

    if (current !== null) {
      return current;
    }

    return window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function getSavedEventsServerSnapshot(): string {
  return "[]";
}

/**
 * Invalid records are ignored, and inconsistent version metadata is
 * repaired in memory without losing a valid current plan.
 */
export function parseSavedEventsSnapshot(
  snapshot: string,
): SavedEventRecord[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeSavedEventRecord)
      .filter((record): record is SavedEventRecord => record !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function readSavedEvents(): SavedEventRecord[] {
  const snapshot = getSavedEventsSnapshot();
  const records = parseSavedEventsSnapshot(snapshot);

  if (typeof window === "undefined") {
    return records;
  }

  let currentSnapshot: string | null;
  let legacySnapshot: string | null;

  try {
    currentSnapshot = window.localStorage.getItem(STORAGE_KEY);
    legacySnapshot = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return records;
  }

  // Persist a successful migration or repaired v2 representation.
  // If all records are invalid, leave their raw source untouched.
  const needsPersistence =
    records.length > 0 &&
    (
      currentSnapshot === null
        ? legacySnapshot !== null
        : currentSnapshot !== JSON.stringify(records)
    );

  if (needsPersistence) {
    persistEvents(records);
  }

  return records;
}

/**
 * Merge validated account records into the browser snapshot.
 * Cloud records win for matching IDs after the sync routine has
 * resolved which local records need uploading.
 */
export function mergeCloudSavedEvents(
  cloudRecords: unknown[],
): SavedEventRecord[] {
  const normalizedCloud = parseSavedEventsSnapshot(
    JSON.stringify(cloudRecords),
  );

  if (normalizedCloud.length !== cloudRecords.length) {
    throw new Error(
      "Some cloud event records failed validation. The local snapshot was not merged.",
    );
  }

  const localRecords = readSavedEvents();
  const mergedById = new Map(
    localRecords.map((record) => [record.id, record]),
  );

  for (const record of normalizedCloud) {
    mergedById.set(record.id, record);
  }

  const merged = [...mergedById.values()].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  );

  if (!sameJson(localRecords, merged)) {
    persistEvents(merged);
  }

  return merged;
}

export function subscribeToSavedEvents(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function persistEvents(records: SavedEventRecord[]): void {
  if (typeof window === "undefined") {
    throw new Error("Event plans can only be saved in the browser.");
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    throw new Error(
      "The event plan could not be saved. Your browser storage may be full or unavailable.",
    );
  }

  // Remove the old key only after the new snapshot was written.
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // The v2 snapshot is already saved, so legacy-key cleanup is best-effort.
  }

  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function limitHistory(
  versions: SavedEventVersion[],
): SavedEventVersion[] {
  return [...versions]
    .sort((a, b) => a.version - b.version)
    .slice(-MAX_VERSION_HISTORY);
}

/**
 * Create the next event record without writing to browser storage.
 * Passing an existing record preserves its creation time and version history.
 */
export function buildSavedEventRecord(
  input: SaveEventRecordInput,
  existing?: SavedEventRecord,
): SavedEventRecord {
  if (!isSavedEventInput(input.input) || !isPlanResult(input.result)) {
    throw new Error(
      "This event plan is not in a valid format and was not saved.",
    );
  }

  const requestedId =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : undefined;

  if (existing && requestedId && existing.id !== requestedId) {
    throw new Error("The event ID does not match the existing record.");
  }

  if (
    existing &&
    sameJson(existing.input, input.input) &&
    sameJson(existing.result, input.result)
  ) {
    return existing;
  }

  const now = new Date().toISOString();
  const id = existing?.id ?? requestedId ?? createEventId();
  const nextNumber = existing
    ? Math.max(...existing.versions.map((version) => version.version)) + 1
    : 1;

  const version = makeVersion(
    id,
    nextNumber,
    now,
    existing ? "updated" : "created",
    input.input,
    input.result,
  );

  return {
    id,
    schemaVersion: 2,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    input: cloneJson(input.input),
    result: cloneJson(input.result),
    currentVersionId: version.id,
    versions: limitHistory([
      ...(existing?.versions ?? []),
      version,
    ]),
  };
}

export function saveEventRecord(
  input: SaveEventRecordInput,
): SavedEventRecord {
  const records = readSavedEvents();
  const requestedId =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : undefined;

  const existing = requestedId
    ? records.find((record) => record.id === requestedId)
    : undefined;

  const record = buildSavedEventRecord(input, existing);

  if (existing && record === existing) {
    return existing;
  }

  persistEvents([
    record,
    ...records.filter((item) => item.id !== record.id),
  ]);

  return record;
}

/**
 * Restore a historical snapshot by creating a new version.
 * The current saved plan is never replaced by an older version number.
 * Approval metadata is cleared so the restored plan must be reviewed.
 */
/**
 * Restore a historical version without writing to browser storage.
 * The restore becomes a new version and requires fresh approval.
 */
export function buildRestoredSavedEventRecord(
  existing: SavedEventRecord,
  versionId: string,
): SavedEventRecord {
  const target = existing.versions.find(
    (version) => version.id === versionId,
  );

  if (!target) {
    throw new Error("That event version is no longer available.");
  }

  if (target.id === existing.currentVersionId) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextNumber =
    Math.max(...existing.versions.map((version) => version.version)) + 1;

  const restoredResult = cloneJson(target.result);
  delete restoredResult.approval;

  const restoredVersion = makeVersion(
    existing.id,
    nextNumber,
    now,
    "restored",
    target.input,
    restoredResult,
    target.version,
  );

  return {
    ...existing,
    updatedAt: now,
    input: cloneJson(target.input),
    result: restoredResult,
    currentVersionId: restoredVersion.id,
    versions: limitHistory([
      ...existing.versions,
      restoredVersion,
    ]),
  };
}

export function restoreSavedEventVersion(
  eventId: string,
  versionId: string,
): SavedEventRecord {
  const records = readSavedEvents();
  const existing = records.find((record) => record.id === eventId);

  if (!existing) {
    throw new Error("The saved event could not be found.");
  }

  const updatedRecord = buildRestoredSavedEventRecord(existing, versionId);

  if (updatedRecord === existing) {
    return existing;
  }

  persistEvents([
    updatedRecord,
    ...records.filter((record) => record.id !== eventId),
  ]);

  return updatedRecord;
}

export function deleteSavedEvent(id: string): void {
  const records = readSavedEvents();
  const remaining = records.filter((record) => record.id !== id);

  if (remaining.length !== records.length) {
    persistEvents(remaining);
  }
}
