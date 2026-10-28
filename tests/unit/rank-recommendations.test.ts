/**
 * Tests for EventoAI's recommendation ranking engine.
 */

import { describe, expect, it } from "vitest";

import type {
  EventIdeaRecommendation,
  VendorSuggestion,
} from "@/types/recommendation";

import type {
  RecommendationContext,
} from "@/lib/recommendation-engine/rank-recommendations";

import {
  rankIdeaRecommendations,
  rankVendorSuggestions,
} from "@/lib/recommendation-engine/rank-recommendations";

const ideas: EventIdeaRecommendation[] = [
  {
    id: "garden-theme",
    title: "Garden-inspired birthday theme",
    category: "theme",
    description:
      "A botanical outdoor celebration using plants and natural decorations.",
    whyItFits:
      "This option emphasizes outdoor scenery and a nature-inspired atmosphere.",
    estimatedCost: 4_000,
    currency: "INR",
    tags: ["garden", "outdoor", "botanical"],
  },
  {
    id: "fireworks-theme",
    title: "Fireworks birthday show",
    category: "entertainment",
    description:
      "A celebration featuring fireworks and loud explosive effects.",
    whyItFits:
      "This option focuses on a large entertainment display.",
    estimatedCost: 2_000,
    currency: "INR",
    tags: ["fireworks", "night", "entertainment"],
  },
];

const context: RecommendationContext = {
  eventType: "birthday",
  currency: "INR",
  availableBudget: 5_000,
  planningPriorities: ["creativity"],
  preferences: {
    preferredThemes: ["garden", "outdoor"],
    mustAvoid: ["fireworks"],
  },
};

describe("rankIdeaRecommendations", () => {
  it("ranks relevant ideas ahead of ideas conflicting with explicit exclusions", () => {
    const ranked = rankIdeaRecommendations(ideas, context);

    expect(ranked[0].item.id).toBe("garden-theme");

    const fireworks = ranked.find(
      (item) => item.item.id === "fireworks-theme",
    );

    expect(fireworks).toBeDefined();
    expect(fireworks?.hasPreferenceConflict).toBe(true);

    expect(
      fireworks?.reasons.some(
        (reason) => reason.toLowerCase().includes("conflict"),
      ),
    ).toBe(true);
  });

  it("returns scores within the documented range", () => {
    const ranked = rankIdeaRecommendations(ideas, context);

    for (const recommendation of ranked) {
      expect(recommendation.matchScore).toBeGreaterThanOrEqual(0);
      expect(recommendation.matchScore).toBeLessThanOrEqual(100);
      expect(recommendation.rank).toBeGreaterThan(0);
      expect(recommendation.reasons.length).toBeGreaterThan(0);
    }
  });

  it("does not claim budget compatibility when currencies differ", () => {
    const idea: EventIdeaRecommendation = {
      id: "international-package",
      title: "International event package",
      category: "theme",
      description: "A package priced in a foreign currency.",
      whyItFits: "A test recommendation.",
      estimatedCost: 100,
      currency: "USD",
      tags: [],
    };

    const ranked = rankIdeaRecommendations(
      [idea],
      {
        eventType: "birthday",
        currency: "INR",
        availableBudget: 10_000,
      },
    );

    expect(ranked[0].budgetFit).toBe("unknown");

    expect(
      ranked[0].reasons.some(
        (reason) => reason.toLowerCase().includes("different currency"),
      ),
    ).toBe(true);
  });
});

describe("rankVendorSuggestions", () => {
  it("marks expensive vendor options as over budget", () => {
    const vendors: VendorSuggestion[] = [
      {
        id: "vendor-1",
        serviceCategory: "catering",
        displayName: "Sample Catering Service",
        description: "A sample catering service.",
        whyItFits: "Included for a ranking test.",
        estimatedCost: 7_000,
        currency: "INR",
        sourceStatus: "illustrative",
      },
    ];

    const ranked = rankVendorSuggestions(vendors, {
      eventType: "birthday",
      currency: "INR",
      availableBudget: 5_000,
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].budgetFit).toBe("over_budget");
    expect(ranked[0].evidence).toBe("illustrative");
  });
});