/**
 * Create and normalize the browser planner's persisted draft.
 *
 * Keeping this logic independent of React allows legacy and malformed
 * session snapshots to be tested without mounting the planner UI.
 */

import type { ConversationDraft } from "@/types/conversation-draft";

export function createEmptyDraft(): ConversationDraft {
  return {
    idea: "",
    eventType: "",
    title: "",
    eventDate: "",
    guestCount: "",
    city: "",
    country: "",
    venueType: "",
    currency: "",
    totalAmount: "",
    contingencyPercent: "10",
    contingencyChosen: false,
    themes: [],
    styles: [],
    notes: "",
    dietaryRequirementsText: "",
    accessibilityNeedsText: "",
    mustHaveText: "",
    mustAvoidText: "",
    culturalNotes: "",
    specialRequirements: "",
    planningPriorities: [],
    assumptions: [],
  };
}

export function normalizeStoredDraft(
  value: unknown,
): ConversationDraft | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const stringValue = (key: string, fallback = "") =>
    typeof raw[key] === "string"
      ? (raw[key] as string)
      : fallback;

  const stringArray = (key: string): string[] =>
    Array.isArray(raw[key])
      ? raw[key]
          .filter(
            (item): item is string =>
              typeof item === "string",
          )
          .slice(0, 20)
      : [];

  const venueType = raw.venueType;

  return {
    ...createEmptyDraft(),
    idea: stringValue("idea").slice(0, 600),
    eventType: stringValue("eventType"),
    title: stringValue("title").slice(0, 160),
    eventDate: stringValue("eventDate"),
    guestCount: stringValue("guestCount"),
    city: stringValue("city").slice(0, 100),
    country: stringValue("country").slice(0, 100),
    venueType:
      venueType === "indoor" || venueType === "outdoor"
        ? venueType
        : "",
    currency: stringValue("currency"),
    totalAmount: stringValue("totalAmount"),
    contingencyPercent: stringValue(
      "contingencyPercent",
      "10",
    ),
    contingencyChosen: raw.contingencyChosen === true,
    themes: stringArray("themes"),
    styles: stringArray("styles"),
    notes: stringValue("notes").slice(0, 500),
    dietaryRequirementsText: stringValue("dietaryRequirementsText").slice(0, 4000),
    accessibilityNeedsText: stringValue("accessibilityNeedsText").slice(0, 4000),
    mustHaveText: stringValue("mustHaveText").slice(0, 4000),
    mustAvoidText: stringValue("mustAvoidText").slice(0, 4000),
    culturalNotes: stringValue("culturalNotes").slice(0, 1000),
    specialRequirements: stringValue("specialRequirements").slice(0, 3000),
    planningPriorities: stringArray("planningPriorities"),
    assumptions: stringArray("assumptions"),
  };
}
