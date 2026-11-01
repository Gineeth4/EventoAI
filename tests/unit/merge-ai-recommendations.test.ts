import { describe, expect, it } from "vitest";

import {
  mergeAIEnhancementRecommendations,
} from "@/lib/ai/merge-ai-recommendations";
import type { EventIdeaRecommendation } from "@/types/recommendation";
import type { AIEnhancement } from "@/lib/ai/ai-enhancement-schema";

function makeLocalRecommendation(
  id: string,
  title: string,
  tags: string[] = ["planning"],
): EventIdeaRecommendation {
  return {
    id,
    title,
    category: "guest_experience",
    description: `Local description for ${title}.`,
    whyItFits: `Local reason for ${title}.`,
    tags,
  };
}

function makeAIRecommendation(
  title: string,
): AIEnhancement["recommendations"][number] {
  return {
    title,
    description: `Enhanced description for ${title}.`,
    whyItFits: `Enhanced reason for ${title}.`,
    tags: ["enhanced", "practical"],
  };
}

describe("mergeAIEnhancementRecommendations", () => {
  it("enhances ordinary recommendations while preserving their local IDs", () => {
    const local = [
      makeLocalRecommendation("local-1", "Theme"),
      makeLocalRecommendation("local-2", "Food"),
      makeLocalRecommendation("local-3", "Activity"),
    ];

    const merged = mergeAIEnhancementRecommendations(local, [
      makeAIRecommendation("Enhanced theme"),
      makeAIRecommendation("Enhanced food"),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "local-1",
      title: "Enhanced theme",
      description: "Enhanced description for Enhanced theme.",
    });
    expect(merged[1]).toMatchObject({
      id: "local-2",
      title: "Enhanced food",
    });
  });

  it("always retains the requirement-verification recommendation unchanged", () => {
    const safeguard = makeLocalRecommendation(
      "requirements-1",
      "Guest needs and event constraints",
      ["requirements", "guest-experience", "verification"],
    );

    const local = [
      makeLocalRecommendation("local-1", "Theme"),
      makeLocalRecommendation("local-2", "Food"),
      makeLocalRecommendation("local-3", "Activity"),
      makeLocalRecommendation("local-4", "Venue backup"),
      safeguard,
    ];

    const merged = mergeAIEnhancementRecommendations(local, [
      makeAIRecommendation("Enhanced theme"),
      makeAIRecommendation("Enhanced food"),
      makeAIRecommendation("Enhanced activity"),
    ]);

    expect(merged).toHaveLength(4);
    expect(merged.slice(0, 3).map((item) => item.title)).toEqual([
      "Enhanced theme",
      "Enhanced food",
      "Enhanced activity",
    ]);
    expect(merged[3]).toEqual(safeguard);
    expect(merged[3].id).toBe("requirements-1");
    expect(merged[3].tags).toContain("verification");
  });

  it("rejects more AI recommendations than available enhancement candidates", () => {
    const local = [
      makeLocalRecommendation(
        "requirements-1",
        "Requirement check",
        ["requirements", "verification"],
      ),
    ];

    expect(() =>
      mergeAIEnhancementRecommendations(local, [
        makeAIRecommendation("Unexpected recommendation"),
        makeAIRecommendation("Another unexpected recommendation"),
      ]),
    ).toThrow(/too many recommendations/i);
  });
});
