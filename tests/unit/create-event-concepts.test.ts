import { describe, expect, it } from "vitest";

import type { PlanResult } from "@/components/planner/event-planner";
import type { SavedEventInput } from "@/types/saved-event";
import { createEventConcepts } from "@/lib/event-concepts/create-event-concepts";

function makeResult(): PlanResult {
  const items = [
    {
      id: "venue-1",
      name: "Venue and setup",
      category: "venue",
      estimatedAmount: 200,
      costStatus: "planning_allocation",
    },
    {
      id: "food-1",
      name: "Food and beverages",
      category: "catering",
      estimatedAmount: 300,
      costStatus: "planning_allocation",
    },
    {
      id: "decor-1",
      name: "Decorations",
      category: "decoration",
      estimatedAmount: 200,
      costStatus: "planning_allocation",
    },
    {
      id: "entertainment-1",
      name: "Entertainment",
      category: "entertainment",
      estimatedAmount: 150,
      costStatus: "planning_allocation",
    },
    {
      id: "photo-1",
      name: "Photography",
      category: "photography",
      estimatedAmount: 150,
      costStatus: "planning_allocation",
    },
  ];

  const result = {
    plan: {
      summary: "A practical celebration plan with a garden theme.",
      budget: {
        currency: "INR",
        spendingLimit: 1100,
        contingencyPercent: 10,
        items,
      },
      tasks: [],
      recommendations: [
        {
          id: "idea-budget",
          title: "Simple DIY decorations",
          category: "decoration",
          description: "Use reusable and handmade details.",
          whyItFits: "A thoughtful way to manage costs.",
          tags: ["budget", "DIY", "reuse"],
        },
        {
          id: "idea-music",
          title: "Interactive music experience",
          category: "entertainment",
          description: "Give guests a participatory music moment.",
          whyItFits: "Adds energy to the celebration.",
          tags: ["music", "experience", "interactive"],
        },
        {
          id: "idea-photo",
          title: "Photo memory corner",
          category: "decoration",
          description: "Create a shared photo moment.",
          whyItFits: "Gives guests a memorable activity.",
          tags: ["photo", "visual", "memory"],
        },
      ],
      vendorSuggestions: [],
      assumptions: ["Budget amounts are planning allocations."],
    },
    budgetSummary: {
      currency: "INR",
      spendingLimit: 1100,
      estimatedSubtotal: 1000,
      contingencyReserve: 100,
      projectedTotal: 1100,
      remainingBudget: 0,
      overBudgetAmount: 0,
      isWithinBudget: true,
      byCategory: [
        { category: "venue", amount: 200, itemCount: 1 },
        { category: "catering", amount: 300, itemCount: 1 },
        { category: "decoration", amount: 200, itemCount: 1 },
        { category: "entertainment", amount: 150, itemCount: 1 },
        { category: "photography", amount: 150, itemCount: 1 },
      ],
    },
    budgetWarnings: [],
    model: "local-planner",
    generationMode: "local_fallback",
    generatedAt: "2026-01-01T00:00:00.000Z",
    generationMs: 1,
  } as unknown as PlanResult;

  return result;
}

function makeInput(): SavedEventInput {
  return {
    eventType: "birthday",
    title: "Garden Birthday",
    eventDate: "2027-01-15",
    guestCount: 40,
    location: {
      city: "Chennai",
      country: "India",
      venueType: "outdoor",
    },
    budget: {
      currency: "INR",
      totalAmount: 1100,
      contingencyPercent: 10,
    },
    preferences: {
      preferredThemes: ["garden"],
      preferredStyles: ["family-friendly"],
      notes: "",
    },
    planningPriorities: ["budget", "guest_experience"],
  };
}

describe("createEventConcepts", () => {
  it("creates three distinct event directions", () => {
    const concepts = createEventConcepts(makeResult(), makeInput());

    expect(concepts).toHaveLength(3);
    expect(concepts.map((concept) => concept.id)).toEqual([
      "value",
      "balanced",
      "experience",
    ]);
    expect(new Set(concepts.map((concept) => concept.title)).size).toBe(3);
    expect(new Set(concepts.map((concept) => concept.result.plan.summary)).size).toBe(3);
  });

  it("preserves the total planning allocation in every concept", () => {
    const concepts = createEventConcepts(makeResult(), makeInput());

    for (const concept of concepts) {
      const subtotal = concept.result.plan.budget.items.reduce(
        (sum, item) => sum + Math.round(item.estimatedAmount * 100),
        0,
      );

      expect(subtotal).toBe(100000);
      expect(concept.result.budgetSummary.estimatedSubtotal).toBe(1000);
      expect(concept.result.budgetSummary.projectedTotal).toBe(1100);
    }
  });

  it("changes allocation mix between the value-led and experience-led concepts", () => {
    const concepts = createEventConcepts(makeResult(), makeInput());

    const value = concepts[0].result.plan.budget.items;
    const experience = concepts[2].result.plan.budget.items;

    expect(
      value.map((item) => item.estimatedAmount),
    ).not.toEqual(
      experience.map((item) => item.estimatedAmount),
    );

    const valueEntertainment = value.find(
      (item) => item.id === "entertainment-1",
    )?.estimatedAmount;

    const experienceEntertainment = experience.find(
      (item) => item.id === "entertainment-1",
    )?.estimatedAmount;

    expect(experienceEntertainment).toBeGreaterThan(valueEntertainment ?? 0);
  });

  it("does not mutate the original result", () => {
    const original = makeResult();
    const before = JSON.stringify(original);

    createEventConcepts(original, makeInput());

    expect(JSON.stringify(original)).toBe(before);
  });

  it("orders existing recommendations without inventing new ones", () => {
    const original = makeResult();
    const concepts = createEventConcepts(original, makeInput());

    for (const concept of concepts) {
      expect(concept.result.plan.recommendations).toHaveLength(
        original.plan.recommendations.length,
      );
      expect(
        new Set(concept.result.plan.recommendations.map((idea) => idea.id)).size,
      ).toBe(original.plan.recommendations.length);
    }
  });
});
