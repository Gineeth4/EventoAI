import { describe, expect, it } from "vitest";

import {
  aiEnhancementSchema,
} from "@/lib/ai/ai-enhancement-schema";

const validEnhancement = {
  summary:
    "A relaxed garden birthday with coordinated decorations, practical refreshments, and simple activities for guests.",

  recommendations: [
    {
      title: "Reusable garden decorations",
      description:
        "Use coordinated greenery and reusable table decorations.",
      whyItFits:
        "It supports the garden theme while avoiding unnecessary purchases.",
      tags: ["garden", "budget"],
    },
    {
      title: "Simple group activity",
      description:
        "Include an optional activity that guests can join comfortably.",
      whyItFits:
        "It encourages interaction without requiring expensive entertainment.",
      tags: ["activity", "guests"],
    },
  ],
};

describe("aiEnhancementSchema", () => {
  it("accepts a valid concise enhancement", () => {
    expect(
      aiEnhancementSchema.safeParse(validEnhancement).success,
    ).toBe(true);
  });

  it("rejects an enhancement with fewer than two recommendations", () => {
    const result = aiEnhancementSchema.safeParse({
      ...validEnhancement,
      recommendations: [validEnhancement.recommendations[0]],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty or excessively short summary", () => {
    const result = aiEnhancementSchema.safeParse({
      ...validEnhancement,
      summary: "Too short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unexpected fields", () => {
    const result = aiEnhancementSchema.safeParse({
      ...validEnhancement,
      budgetTotal: 25000,
    });

    expect(result.success).toBe(false);
  });

  it("rejects recommendations without a useful explanation", () => {
    const result = aiEnhancementSchema.safeParse({
      ...validEnhancement,
      recommendations: [
        {
          ...validEnhancement.recommendations[0],
          whyItFits: "No",
        },
        validEnhancement.recommendations[1],
      ],
    });

    expect(result.success).toBe(false);
  });
});