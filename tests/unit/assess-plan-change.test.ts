/**
 * Tests for EventoAI's Plan Impact Simulator engine.
 */

import { describe, expect, it } from "vitest";

import type {
  EventInput,
} from "@/types/event";

import type {
  EventPlan,
} from "@/types/event-plan";

import {
  assessPlanChange,
} from "@/lib/plan-impact/assess-plan-change";

/**
 * A reusable test event and plan.
 *
 * All amounts are test fixtures, not real quotations.
 */
function createTestScenario(): {
  currentEvent: EventInput;
  currentPlan: EventPlan;
} {
  const currentEvent: EventInput = {
    eventType: "birthday",
    title: "Test birthday",
    eventDate: "2027-07-20",
    guestCount: 20,
    location: {
      city: "Chennai",
      country: "India",
    },
    budget: {
      currency: "INR",
      totalAmount: 10_000,
    },
  };

  const currentPlan: EventPlan = {
    summary:
      "A sample birthday plan used for automated testing.",
    budget: {
      currency: "INR",
      spendingLimit: 10_000,
      contingencyPercent: 10,
      items: [
        {
          id: "catering",
          name: "Catering",
          category: "catering",
          estimatedAmount: 4_000,
          costStatus: "ai_estimate",
        },
        {
          id: "venue",
          name: "Venue hire",
          category: "venue",
          estimatedAmount: 2_000,
          costStatus: "ai_estimate",
        },
      ],
    },
    tasks: [
      {
        id: "final-check",
        title: "Complete the final arrangements",
        dueDate: "2027-07-18",
        category: "logistics",
        priority: "high",
        status: "todo",
        dependsOn: [],
      },
    ],
    recommendations: [],
    vendorSuggestions: [],
    assumptions: [
      "Test costs are illustrative and not verified quotations.",
    ],
  };

  return { currentEvent, currentPlan };
}

describe("assessPlanChange", () => {
  it("recalculates an eligible estimate when the guest count increases", () => {
    const { currentEvent, currentPlan } =
      createTestScenario();

    const assessment = assessPlanChange({
      currentEvent,
      currentPlan,
      change: {
        kind: "guest_count",
        value: 30,
      },
      guestUnitCosts: {
        catering: 100,
      },
    });

    // An extra 10 guests adds ₹1,000 to the catering estimate.
    expect(
      assessment.proposedPlan.budget.items.find(
        (item) => item.id === "catering",
      )?.estimatedAmount,
    ).toBe(5_000);

    // Original estimate: ₹6,000 + 10% reserve = ₹6,600.
    expect(assessment.currentBudget.projectedTotal).toBe(6_600);

    // New estimate: ₹7,000 + 10% reserve = ₹7,700.
    expect(assessment.proposedBudget.projectedTotal).toBe(7_700);

    expect(assessment.projectedCostChange).toBe(1_100);
    expect(assessment.proposedEvent.guestCount).toBe(30);

    // Assessment must not modify the original plan supplied by the caller.
    expect(
      currentPlan.budget.items.find(
        (item) => item.id === "catering",
      )?.estimatedAmount,
    ).toBe(4_000);
  });

  it("flags a proposed budget that cannot cover the existing plan", () => {
    const { currentEvent, currentPlan } =
      createTestScenario();

    const assessment = assessPlanChange({
      currentEvent,
      currentPlan,
      change: {
        kind: "budget",
        value: 5_000,
      },
    });

    expect(assessment.proposedBudget.spendingLimit).toBe(5_000);
    expect(assessment.proposedBudget.projectedTotal).toBe(6_600);
    expect(assessment.proposedBudget.overBudgetAmount).toBe(1_600);
    expect(assessment.proposedBudget.isWithinBudget).toBe(false);
    expect(assessment.requiresReview).toBe(true);

    // The engine changes the limit, not the expense amounts.
    expect(
      assessment.proposedPlan.budget.items.find(
        (item) => item.id === "venue",
      )?.estimatedAmount,
    ).toBe(2_000);
  });

  it("shifts task dates when the event date changes", () => {
    const { currentEvent, currentPlan } =
      createTestScenario();

    const assessment = assessPlanChange({
      currentEvent,
      currentPlan,
      change: {
        kind: "event_date",
        value: "2027-07-27",
      },
    });

    expect(assessment.proposedEvent.eventDate).toBe("2027-07-27");
    expect(assessment.tasksRescheduled).toBe(1);

    // The task remains two calendar days before the event.
    expect(assessment.proposedPlan.tasks[0].dueDate).toBe(
      "2027-07-25",
    );

    expect(assessment.requiresReview).toBe(true);
  });

  it("marks location-sensitive costs for review without inventing replacement prices", () => {
    const { currentEvent, currentPlan } =
      createTestScenario();

    const assessment = assessPlanChange({
      currentEvent,
      currentPlan,
      change: {
        kind: "location",
        value: {
          city: "Coimbatore",
          country: "India",
        },
      },
    });

    expect(assessment.proposedEvent.location?.city).toBe(
      "Coimbatore",
    );

    const venue = assessment.affectedBudgetItems.find(
      (item) => item.itemId === "venue",
    );

    expect(venue).toBeDefined();
    expect(venue?.updated).toBe(false);
    expect(venue?.proposedAmount).toBe(2_000);
    expect(assessment.requiresReview).toBe(true);
  });

  it("does not automatically modify a vendor quote when guests change", () => {
    const { currentEvent, currentPlan } =
      createTestScenario();

    currentPlan.budget.items.push({
      id: "catering-quote",
      name: "Catering vendor quotation",
      category: "catering",
      estimatedAmount: 4_000,
      quotedAmount: 4_200,
      costStatus: "vendor_quote",
    });

    const assessment = assessPlanChange({
      currentEvent,
      currentPlan,
      change: {
        kind: "guest_count",
        value: 30,
      },
      guestUnitCosts: {
        catering: 100,
        "catering-quote": 125,
      },
    });

    const quotedItem = assessment.proposedPlan.budget.items.find(
      (item) => item.id === "catering-quote",
    );

    expect(quotedItem?.quotedAmount).toBe(4_200);
    expect(quotedItem?.estimatedAmount).toBe(4_000);

    expect(
      assessment.reviewRequiredItems.some(
        (item) => item.includes("Catering vendor quotation"),
      ),
    ).toBe(true);
  });
});