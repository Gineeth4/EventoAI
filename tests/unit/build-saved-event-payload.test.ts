import { describe, expect, it } from "vitest";

import { eventInputSchema } from "@/lib/validation/event-input";
import { createEmptyDraft } from "@/lib/planning-intelligence/normalize-conversation-draft";
import { buildSavedEventPayload } from "@/lib/planning-intelligence/build-saved-event-payload";
import type { ConversationDraft } from "@/types/conversation-draft";

function makeDraft(
  overrides: Partial<ConversationDraft> = {},
): ConversationDraft {
  return {
    ...createEmptyDraft(),
    eventType: "birthday",
    title: "Garden birthday",
    eventDate: "2027-01-15",
    guestCount: "40",
    city: "Chennai",
    country: "India",
    venueType: "outdoor",
    currency: "INR",
    totalAmount: "50000",
    contingencyPercent: "10",
    contingencyChosen: true,
    themes: ["garden"],
    styles: ["relaxed"],
    planningPriorities: ["budget", "guest_experience"],
    ...overrides,
  };
}

describe("buildSavedEventPayload", () => {
  it("maps all structured requirements into the correct API fields", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        dietaryRequirementsText: "Vegetarian\nNut-free",
        accessibilityNeedsText: "Step-free access\nAccessible restroom",
        mustHaveText: "Quiet room",
        mustAvoidText: "Fireworks",
        culturalNotes: " Respect the hosts' traditions. ",
        specialRequirements: " Provide a quiet break space. ",
      }),
    );

    expect(payload.preferences.dietaryRequirements).toEqual([
      "Vegetarian",
      "Nut-free",
    ]);
    expect(payload.preferences.accessibilityNeeds).toEqual([
      "Step-free access",
      "Accessible restroom",
    ]);
    expect(payload.preferences.mustHave).toEqual(["Quiet room"]);
    expect(payload.preferences.mustAvoid).toEqual(["Fireworks"]);
    expect(payload.preferences.culturalNotes).toBe(
      "Respect the hosts' traditions.",
    );
    expect(payload.specialRequirements).toBe(
      "Provide a quiet break space.",
    );
  });

  it("normalizes list entries without splitting meaningful commas", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        dietaryRequirementsText:
          "- Vegetarian\nNut-free\nvegetarian\nNo peanuts, tree nuts, or sesame",
      }),
    );

    expect(payload.preferences.dietaryRequirements).toEqual([
      "Vegetarian",
      "Nut-free",
      "No peanuts, tree nuts, or sesame",
    ]);
  });

  it("trims core fields and preserves the existing theme and style selections", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        title: "  Garden birthday  ",
        city: "  Chennai  ",
        country: "  India  ",
        themes: ["garden", "botanical"],
        styles: ["relaxed"],
      }),
    );

    expect(payload.title).toBe("Garden birthday");
    expect(payload.location.city).toBe("Chennai");
    expect(payload.location.country).toBe("India");
    expect(payload.preferences.preferredThemes).toEqual([
      "garden",
      "botanical",
    ]);
    expect(payload.preferences.preferredStyles).toEqual(["relaxed"]);
  });

  it("applies documented default priorities and records the assumptions", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        planningPriorities: [],
        contingencyChosen: false,
      }),
    );

    expect(payload.planningPriorities).toEqual([
      "budget",
      "guest_experience",
    ]);
    expect(payload.preferences.notes).toContain(
      "10% contingency reserve",
    );
    expect(payload.preferences.notes).toContain(
      "initial planning priorities",
    );
  });

  it("deduplicates explicitly selected planning priorities", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        planningPriorities: [
          "budget",
          "accessibility",
          "budget",
        ],
      }),
    );

    expect(payload.planningPriorities).toEqual([
      "budget",
      "accessibility",
    ]);
  });

  it("produces a payload accepted by the existing event input schema", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        dietaryRequirementsText: "Vegetarian\nNut-free",
        accessibilityNeedsText: "Step-free access",
        mustHaveText: "Quiet room",
        mustAvoidText: "Fireworks",
        culturalNotes: "Respect the hosts' traditions.",
        specialRequirements: "Provide a quiet break space.",
      }),
    );

    const result = eventInputSchema.safeParse(payload);

    expect(result.success).toBe(true);
  });

  it("retains the existing notes length limit", () => {
    const payload = buildSavedEventPayload(
      makeDraft({
        idea: "i".repeat(600),
        notes: "n".repeat(500),
        assumptions: ["Existing assumption"],
      }),
    );

    expect(payload.preferences.notes.length).toBeLessThanOrEqual(600);
  });
});
