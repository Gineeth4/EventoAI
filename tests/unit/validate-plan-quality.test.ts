import { describe, expect, it } from "vitest";

import {
  eventInputSchema,
} from "@/lib/validation/event-input";

import {
  generateLocalEventPlan,
} from "@/lib/ai/generate-local-event-plan";

import {
  validatePlanQuality,
} from "@/lib/ai/validate-plan-quality";

function createTestEvent() {
  return eventInputSchema.parse({
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
      totalAmount: 25_000,
      contingencyPercent: 10,
    },

    preferences: {
      preferredThemes: ["garden", "botanical"],
      preferredStyles: ["simple", "family-friendly"],
      notes: "An affordable outdoor celebration.",
    },

    planningPriorities: ["budget", "guest_experience"],
  });
}

describe("validatePlanQuality", () => {
  it("accepts a valid local plan and its calculated budget summary", () => {
    const event = createTestEvent();
    const generated = generateLocalEventPlan(event);

    const issues = validatePlanQuality(
      generated.plan,
      generated.budgetSummary,
    );

    expect(issues).toEqual([]);
    expect(generated.budgetSummary.isWithinBudget).toBe(true);
  });

  it("detects when expense amounts change after the summary was calculated", () => {
    const event = createTestEvent();
    const generated = generateLocalEventPlan(event);

    const changedPlan = structuredClone(generated.plan);

    const firstItem = changedPlan.budget.items[0];

    if (!firstItem) {
      throw new Error("The test plan must contain a budget item.");
    }

    // Change the underlying plan without recalculating its summary.
    firstItem.estimatedAmount += 100;

    const issues = validatePlanQuality(
      changedPlan,
      generated.budgetSummary,
    );

    expect(issues).toContain("PLAN_BUDGET_SUMMARY_MISMATCH");
    expect(issues).toContain("PLAN_BUDGET_LIMIT_EXCEEDED");
  });
});