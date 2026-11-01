import { describe, expect, it } from "vitest";

import {
  createEmptyDraft,
  normalizeStoredDraft,
} from "@/lib/planning-intelligence/normalize-conversation-draft";

describe("conversation draft normalization", () => {
  it("provides empty defaults for all newly added fields", () => {
    const draft = createEmptyDraft();

    expect(draft.dietaryRequirementsText).toBe("");
    expect(draft.accessibilityNeedsText).toBe("");
    expect(draft.mustHaveText).toBe("");
    expect(draft.mustAvoidText).toBe("");
    expect(draft.culturalNotes).toBe("");
    expect(draft.specialRequirements).toBe("");
  });

  it("restores legacy drafts that predate structured requirements", () => {
    const legacyDraft = normalizeStoredDraft({
      idea: "A family birthday",
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
      notes: "An older saved draft.",
      planningPriorities: ["budget"],
      assumptions: [],
    });

    expect(legacyDraft).not.toBeNull();
    expect(legacyDraft?.title).toBe("Garden birthday");
    expect(legacyDraft?.city).toBe("Chennai");
    expect(legacyDraft?.dietaryRequirementsText).toBe("");
    expect(legacyDraft?.accessibilityNeedsText).toBe("");
    expect(legacyDraft?.mustHaveText).toBe("");
    expect(legacyDraft?.mustAvoidText).toBe("");
    expect(legacyDraft?.culturalNotes).toBe("");
    expect(legacyDraft?.specialRequirements).toBe("");
  });

  it("normalizes malformed optional requirement values without throwing", () => {
    const draft = normalizeStoredDraft({
      dietaryRequirementsText: ["Vegetarian"],
      accessibilityNeedsText: { access: "step-free" },
      mustHaveText: 42,
      mustAvoidText: null,
      culturalNotes: false,
      specialRequirements: ["unexpected"],
    });

    expect(draft).not.toBeNull();
    expect(draft?.dietaryRequirementsText).toBe("");
    expect(draft?.accessibilityNeedsText).toBe("");
    expect(draft?.mustHaveText).toBe("");
    expect(draft?.mustAvoidText).toBe("");
    expect(draft?.culturalNotes).toBe("");
    expect(draft?.specialRequirements).toBe("");
  });

  it.each([null, undefined, "invalid", 42, true, []])(
    "rejects an invalid draft container: %s",
    (value) => {
      expect(normalizeStoredDraft(value)).toBeNull();
    },
  );

  it("bounds restored requirement text to the supported field limits", () => {
    const draft = normalizeStoredDraft({
      dietaryRequirementsText: "d".repeat(5000),
      accessibilityNeedsText: "a".repeat(5000),
      mustHaveText: "h".repeat(5000),
      mustAvoidText: "v".repeat(5000),
      culturalNotes: "c".repeat(1500),
      specialRequirements: "s".repeat(3500),
    });

    expect(draft?.dietaryRequirementsText).toHaveLength(4000);
    expect(draft?.accessibilityNeedsText).toHaveLength(4000);
    expect(draft?.mustHaveText).toHaveLength(4000);
    expect(draft?.mustAvoidText).toHaveLength(4000);
    expect(draft?.culturalNotes).toHaveLength(1000);
    expect(draft?.specialRequirements).toHaveLength(3000);
  });

  it("filters malformed array entries and applies the existing item limit", () => {
    const draft = normalizeStoredDraft({
      themes: ["garden", 42, null, "family"],
      planningPriorities: Array.from(
        { length: 25 },
        (_, index) => "priority-" + index,
      ),
    });

    expect(draft?.themes).toEqual(["garden", "family"]);
    expect(draft?.planningPriorities).toHaveLength(20);
  });

  it("preserves valid structured requirements", () => {
    const draft = normalizeStoredDraft({
      dietaryRequirementsText: "Vegetarian\nNut-free",
      accessibilityNeedsText: "Step-free access",
      mustHaveText: "Quiet room",
      mustAvoidText: "Fireworks",
      culturalNotes: "Respect the hosts' traditions.",
      specialRequirements: "Provide a quiet break space.",
    });

    expect(draft?.dietaryRequirementsText).toBe(
      "Vegetarian\nNut-free",
    );
    expect(draft?.accessibilityNeedsText).toBe("Step-free access");
    expect(draft?.mustHaveText).toBe("Quiet room");
    expect(draft?.mustAvoidText).toBe("Fireworks");
    expect(draft?.culturalNotes).toBe(
      "Respect the hosts' traditions.",
    );
    expect(draft?.specialRequirements).toBe(
      "Provide a quiet break space.",
    );
  });
});
