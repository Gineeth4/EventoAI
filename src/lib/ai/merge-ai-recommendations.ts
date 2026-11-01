import type { AIEnhancement } from "@/lib/ai/ai-enhancement-schema";
import type { EventIdeaRecommendation } from "@/types/recommendation";

/**
 * Apply AI copy enhancements only to ordinary recommendations.
 * Requirement-verification recommendations are deterministic safeguards
 * and must survive even when Gemini returns fewer recommendations.
 *
 * This module intentionally has no server or provider dependencies so
 * the merge behavior can be tested independently.
 */
export function mergeAIEnhancementRecommendations(
  localRecommendations: EventIdeaRecommendation[],
  aiRecommendations: AIEnhancement["recommendations"],
): EventIdeaRecommendation[] {
  const protectedRecommendations = localRecommendations.filter(
    (recommendation) =>
      recommendation.tags.includes("requirements") &&
      recommendation.tags.includes("verification"),
  );

  const enhancementCandidates = localRecommendations.filter(
    (recommendation) => !protectedRecommendations.includes(recommendation),
  );

  const enhancedRecommendations = aiRecommendations.map(
    (recommendation, index) => {
      const localRecommendation = enhancementCandidates[index];

      if (!localRecommendation) {
        throw new Error("Gemini returned too many recommendations.");
      }

      return {
        ...localRecommendation,
        title: recommendation.title,
        description: recommendation.description,
        whyItFits: recommendation.whyItFits,
        tags: recommendation.tags,
      };
    },
  );

  return [
    ...enhancedRecommendations,
    ...protectedRecommendations,
  ];
}
