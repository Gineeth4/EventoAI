import type { ConversationDraft } from "@/types/conversation-draft";
import type { SavedEventInput } from "@/types/saved-event";

import { parseRequirementLines } from "@/lib/planning-intelligence/requirement-text";

/**
 * Convert the conversational draft into the validated planning payload.
 * User-supplied requirements are normalized but never silently discarded.
 */
export function buildSavedEventPayload(
  draft: ConversationDraft,
): SavedEventInput {
  const assumptions = [...draft.assumptions];

  if (!draft.contingencyChosen) {
    assumptions.push(
      "A 10% contingency reserve is a starting assumption and can be changed.",
    );
  }

  const priorities = draft.planningPriorities.length
    ? draft.planningPriorities
    : ["budget", "guest_experience"];

  if (!draft.planningPriorities.length) {
    assumptions.push(
      "Budget control and guest experience are the initial planning priorities.",
    );
  }

  const notes = [
    draft.idea.trim(),
    draft.notes.trim(),
    assumptions.length
      ? `Planning assumptions: ${assumptions.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 600);

  return {
    eventType: draft.eventType,
    title: draft.title.trim(),
    eventDate: draft.eventDate,
    guestCount: Number(draft.guestCount),
    location: {
      city: draft.city.trim(),
      country: draft.country.trim(),
      venueType: draft.venueType,
    },
    budget: {
      currency: draft.currency,
      totalAmount: Number(draft.totalAmount),
      contingencyPercent: Number(
        draft.contingencyPercent || "10",
      ),
    },
    preferences: {
      preferredThemes: draft.themes,
      preferredStyles: draft.styles,
      dietaryRequirements: parseRequirementLines(draft.dietaryRequirementsText),
      accessibilityNeeds: parseRequirementLines(draft.accessibilityNeedsText),
      mustHave: parseRequirementLines(draft.mustHaveText),
      mustAvoid: parseRequirementLines(draft.mustAvoidText),
      culturalNotes: draft.culturalNotes.trim(),
      notes,
    },
    planningPriorities: [...new Set(priorities)],
    specialRequirements: draft.specialRequirements.trim(),
  };
}
