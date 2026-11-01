import { describe, expect, it } from "vitest";

import { generateLocalEventPlan } from "@/lib/ai/generate-local-event-plan";
import type { EventInput } from "@/types/event";

const BASE_EVENT: EventInput = {
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
    totalAmount: 50000,
    contingencyPercent: 10,
  },
  preferences: {
    preferredThemes: ["garden"],
    preferredStyles: ["relaxed"],
  },
  planningPriorities: ["budget", "guest_experience"],
};

const CONSTRAINED_EVENT: EventInput = {
  ...BASE_EVENT,
  preferences: {
    ...BASE_EVENT.preferences,
    dietaryRequirements: ["Vegetarian", "Nut-free"],
    accessibilityNeeds: ["Step-free access"],
    mustHave: ["Quiet room"],
    mustAvoid: ["Fireworks"],
    culturalNotes: "Respect the hosts' stated traditions.",
  },
  specialRequirements: "Provide a quiet space for breaks.",
};

describe("generateLocalEventPlan requirement-aware recommendations", () => {
  it("retains the four standard recommendations when no extra requirements are supplied", () => {
    const result = generateLocalEventPlan(BASE_EVENT);

    expect(result.plan.recommendations).toHaveLength(4);
    expect(
      result.plan.recommendations.some(
        (item) => item.title === "Guest needs and event constraints",
      ),
    ).toBe(false);
  });

  it("adds an explicit verification recommendation for structured requirements", () => {
    const result = generateLocalEventPlan(CONSTRAINED_EVENT);

    expect(result.plan.recommendations).toHaveLength(5);

    const requirementRecommendation =
      result.plan.recommendations.find(
        (item) => item.title === "Guest needs and event constraints",
      );

    expect(requirementRecommendation).toBeDefined();
    expect(requirementRecommendation?.description).toContain(
      "Dietary: Vegetarian, Nut-free",
    );
    expect(requirementRecommendation?.description).toContain(
      "Accessibility: Step-free access",
    );
    expect(requirementRecommendation?.description).toContain(
      "Must-have: Quiet room",
    );
    expect(requirementRecommendation?.description).toContain(
      "Must-avoid: Fireworks",
    );
    expect(requirementRecommendation?.description).toContain(
      "Cultural guidance:",
    );
    expect(requirementRecommendation?.description).toContain(
      "Special requirements:",
    );
    expect(requirementRecommendation?.description).toContain(
      "Do not treat them as confirmed until verified",
    );
    expect(requirementRecommendation?.whyItFits).toContain(
      "without claiming that a venue or supplier can meet them",
    );
  });

  it("tailors food, activity, and venue recommendations to the supplied constraints", () => {
    const result = generateLocalEventPlan(CONSTRAINED_EVENT);

    const food = result.plan.recommendations.find(
      (item) => item.title === "Practical guest refreshments",
    );
    const activity = result.plan.recommendations.find(
      (item) => item.title === "An optional group activity",
    );
    const venue = result.plan.recommendations.find(
      (item) => item.title === "Venue-specific backup plan",
    );

    expect(food?.description).toContain("Vegetarian");
    expect(food?.description).toContain("cross-contact controls");
    expect(activity?.description).toContain("Step-free access");
    expect(activity?.description).toContain("different ways to participate");
    expect(venue?.description).toContain("Quiet room");
    expect(venue?.description).toContain("Fireworks");
  });

  it("does not alter budget allocations or timeline tasks when requirements are added", () => {
    const standard = generateLocalEventPlan(BASE_EVENT);
    const constrained = generateLocalEventPlan(CONSTRAINED_EVENT);

    expect(
      constrained.plan.budget.items.map((item) => ({
        name: item.name,
        category: item.category,
        estimatedAmount: item.estimatedAmount,
        costStatus: item.costStatus,
      })),
    ).toEqual(
      standard.plan.budget.items.map((item) => ({
        name: item.name,
        category: item.category,
        estimatedAmount: item.estimatedAmount,
        costStatus: item.costStatus,
      })),
    );

    expect(
      constrained.plan.tasks.map((task) => ({
        title: task.title,
        dueDate: task.dueDate,
        category: task.category,
        priority: task.priority,
      })),
    ).toEqual(
      standard.plan.tasks.map((task) => ({
        title: task.title,
        dueDate: task.dueDate,
        category: task.category,
        priority: task.priority,
      })),
    );

    expect(constrained.budgetSummary.projectedTotal).toBe(
      standard.budgetSummary.projectedTotal,
    );
  });
});
