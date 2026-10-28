/**
 * Unit tests for EventoAI's structured model-output schema.
 *
 * No Gemini API call is made; these tests consume no AI quota.
 */

import { describe, expect, it } from "vitest";

import {
  MODEL_PLAN_RESPONSE_JSON_SCHEMA,
  modelPlanResponseSchema,
} from "@/lib/ai/plan-output-schema";

function createValidModelResponse() {
  return {
    summary:
      "A simple garden birthday celebration with a practical budget and personalized activities.",

    budgetItems: [
      {
        name: "Venue",
        category: "venue",
        description: "An outdoor venue suitable for the guests.",
        estimatedAmount: 5_000,
      },
      {
        name: "Catering",
        category: "catering",
        description: "Food and refreshments for attendees.",
        estimatedAmount: 8_000,
      },
      {
        name: "Decorations",
        category: "decoration",
        description: "Simple botanical decorations.",
        estimatedAmount: 3_000,
      },
    ],

    recommendations: [
      {
        title: "Garden-inspired theme",
        category: "theme",
        description: "Use plants and natural colours.",
        whyItFits:
          "It matches the user's outdoor and botanical preferences.",
        tags: ["garden", "outdoor"],
        // estimatedCost is intentionally omitted.
      },
      {
        title: "Family-friendly games",
        category: "activity",
        description: "Organize inclusive group games.",
        whyItFits: "Suitable for a mixed-age guest group.",
        estimatedCost: 500,
        tags: ["family", "games"],
      },
      {
        title: "Simple refreshment station",
        category: "food",
        description: "Serve light refreshments.",
        whyItFits: "It complements the outdoor event setting.",
        tags: ["refreshments"],
      },
    ],

    vendorSuggestions: [
      {
        serviceCategory: "catering",
        displayName: "Local catering providers to compare",
        description: "Compare local catering options.",
        whyItFits: "Suitable for the stated guest count.",
        estimatedCost: 8_000,
      },
      {
        serviceCategory: "decoration",
        displayName: "Local decoration providers to investigate",
        description: "Explore simple botanical decoration services.",
        whyItFits: "Suitable for the preferred theme.",
        // estimatedCost is intentionally omitted.
      },
    ],

    assumptions: [
      "Costs are preliminary estimates.",
    ],
  };
}

describe("modelPlanResponseSchema", () => {
  it("accepts a valid structured event plan response", () => {
    const result = modelPlanResponseSchema.safeParse(
      createValidModelResponse(),
    );

    expect(result.success).toBe(true);
  });

  it("allows recommendation costs to be omitted", () => {
    const input = createValidModelResponse();

    const result = modelPlanResponseSchema.safeParse(input);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.data.recommendations[0].estimatedCost,
      ).toBeUndefined();
    }
  });

  it("rejects a response with too few budget items", () => {
    const input = createValidModelResponse();

    input.budgetItems = input.budgetItems.slice(0, 2);

    expect(
      modelPlanResponseSchema.safeParse(input).success,
    ).toBe(false);
  });

  it("rejects an unknown budget category", () => {
    const input = createValidModelResponse();

    input.budgetItems[0].category =
      "unrecognized-category" as "venue";

    expect(
      modelPlanResponseSchema.safeParse(input).success,
    ).toBe(false);
  });

  it("rejects a negative expense estimate", () => {
    const input = createValidModelResponse();

    input.budgetItems[0].estimatedAmount = -100;

    expect(
      modelPlanResponseSchema.safeParse(input).success,
    ).toBe(false);
  });

  it("rejects a response missing its summary", () => {
    const input = createValidModelResponse();

    const malformed = {
      ...input,
      summary: "",
    };

    expect(
      modelPlanResponseSchema.safeParse(malformed).success,
    ).toBe(false);
  });

  it("keeps optional estimate fields out of the required JSON Schema fields", () => {
    const ideaRequired = [
      ...MODEL_PLAN_RESPONSE_JSON_SCHEMA.properties
        .recommendations.items.required,
    ];

    const vendorRequired = [
      ...MODEL_PLAN_RESPONSE_JSON_SCHEMA.properties
        .vendorSuggestions.items.required,
    ];

    expect(ideaRequired).not.toContain("estimatedCost");
    expect(vendorRequired).not.toContain("estimatedCost");
  });
});