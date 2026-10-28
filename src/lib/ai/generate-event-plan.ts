/**
 * EventoAI — Deadline-first hybrid plan generation.
 *
 * 1. Validate input.
 * 2. Build the local plan immediately.
 * 3. Make one bounded Gemini enhancement request.
 * 4. Validate the AI result and preserve deterministic calculations.
 * 5. Return the enhanced plan or the local fallback.
 */

import type { EventInput } from "@/types/event";
import type { EventPlan } from "@/types/event-plan";

import { eventInputSchema } from "@/lib/validation/event-input";
import { eventPlanSchema } from "@/lib/validation/event-plan";

import {
  getAIModelConfig,
} from "@/lib/ai/model-config";
import {
  requestGeminiJson,
} from "@/lib/ai/gemini-client";
import {
  EventoAIError,
  getProviderStatus,
} from "@/lib/ai/handle-ai-error";

import {
  AI_ENHANCEMENT_JSON_SCHEMA,
  aiEnhancementSchema,
} from "@/lib/ai/ai-enhancement-schema";
import {
  buildEnhancementPrompt,
} from "@/lib/ai/event-knowledge-base";
import {
  generateLocalEventPlan,
} from "@/lib/ai/generate-local-event-plan";
import type {
  LocalEventPlanResult,
} from "@/lib/ai/generate-local-event-plan";
import {
  validatePlanQuality,
} from "@/lib/ai/validate-plan-quality";

export class MissingPlanningDetailsError extends EventoAIError {
  constructor(public readonly missingFields: string[]) {
    super(
      "MISSING_PLANNING_DETAILS",
      "Please provide the event date, guest count, and a positive total budget before generating a plan.",
      422,
      false,
    );

    this.name = "MissingPlanningDetailsError";
  }
}

export type GeneratedEventPlanResult =
  LocalEventPlanResult & {
    model: string;
    generationMode: "ai_enhanced" | "local_fallback";
    generatedAt: string;
    generationMs: number;
  };

// Reserve most of the response budget for planning and response overhead.
const AI_REQUEST_TIMEOUT_MS = 7_000;
const AI_ENHANCEMENT_OUTPUT_TOKEN_LIMIT = 650;

function validatePlanningReadiness(event: EventInput): void {
  const missingFields: string[] = [];

  if (!event.eventDate) {
    missingFields.push("eventDate");
  }

  if (event.guestCount === undefined) {
    missingFields.push("guestCount");
  }

  if (
    event.budget.totalAmount === undefined ||
    event.budget.totalAmount <= 0
  ) {
    missingFields.push("budget.totalAmount");
  }

  if (missingFields.length > 0) {
    throw new MissingPlanningDetailsError(missingFields);
  }
}

function createResult(
  local: LocalEventPlanResult,
  startedAt: number,
  generationMode: "ai_enhanced" | "local_fallback",
  model: string,
  plan: EventPlan = local.plan,
): GeneratedEventPlanResult {
  return {
    ...local,
    plan,
    model,
    generationMode,
    generatedAt: new Date().toISOString(),
    generationMs: Date.now() - startedAt,
  };
}

function logLocalFallback(
  error: unknown,
  model: string,
): void {
  console.warn(
    "[EventoAI] Returning the local plan because AI enhancement was unavailable.",
    {
      model,
      code:
        error instanceof EventoAIError
          ? error.code
          : "AI_PROVIDER_ERROR",
      status: getProviderStatus(error) ?? "unknown",
      errorName:
        error instanceof Error
          ? error.name
          : "UnknownError",
    },
  );
}

export async function generateEventPlan(
  rawEvent: unknown,
): Promise<GeneratedEventPlanResult> {
  const startedAt = Date.now();

  const inputResult = eventInputSchema.safeParse(rawEvent);

  if (!inputResult.success) {
    throw new EventoAIError(
      "INVALID_EVENT_INPUT",
      "Some event details are invalid. Review the information and try again.",
      400,
      false,
    );
  }

  const event = inputResult.data;
  validatePlanningReadiness(event);

  // Critical path: a complete plan exists before contacting Gemini.
  const local = generateLocalEventPlan(event);

  let config: ReturnType<typeof getAIModelConfig>;

  try {
    config = getAIModelConfig();
  } catch (error) {
    logLocalFallback(error, "configuration");

    return createResult(
      local,
      startedAt,
      "local_fallback",
      "local-planner",
    );
  }

  try {
    const prompt = buildEnhancementPrompt(event);

    // There is exactly one AI request and no chained fallback call.
    const outputText = await requestGeminiJson({
      model: config.primaryModel,
      input: prompt,
      schema:
        AI_ENHANCEMENT_JSON_SCHEMA as unknown as Record<
          string,
          unknown
        >,
      thinkingLevel: config.primaryThinkingLevel,
      maxOutputTokens: Math.min(
        config.maxOutputTokens,
        AI_ENHANCEMENT_OUTPUT_TOKEN_LIMIT,
      ),
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
    });

    let rawOutput: unknown;

    try {
      rawOutput = JSON.parse(outputText);
    } catch {
      throw new EventoAIError(
        "AI_ENHANCEMENT_INVALID_JSON",
        "Gemini returned invalid enhancement JSON.",
        502,
        false,
      );
    }

    const enhancementResult =
      aiEnhancementSchema.safeParse(rawOutput);

    if (!enhancementResult.success) {
      throw new EventoAIError(
        "AI_ENHANCEMENT_SCHEMA_INVALID",
        "Gemini's enhancement did not meet EventoAI's schema.",
        502,
        false,
      );
    }

    const enhancement = enhancementResult.data;

    // AI can improve descriptions, not budget, timeline, or vendor status.
    const recommendations = enhancement.recommendations.map(
      (recommendation, index) => {
        const localRecommendation =
          local.plan.recommendations[index];

        if (!localRecommendation) {
          throw new EventoAIError(
            "AI_ENHANCEMENT_COUNT_INVALID",
            "Gemini returned too many recommendations.",
            502,
            false,
          );
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

    const candidateResult = eventPlanSchema.safeParse({
      ...local.plan,
      summary: enhancement.summary,
      recommendations,
    });

    if (!candidateResult.success) {
      throw new EventoAIError(
        "AI_ENHANCED_PLAN_INVALID",
        "The enhanced plan did not meet EventoAI's validation rules.",
        502,
        false,
      );
    }

    const candidate = candidateResult.data;

    const qualityIssues = validatePlanQuality(
      candidate,
      local.budgetSummary,
    );

    if (qualityIssues.length > 0) {
      throw new EventoAIError(
        "AI_PLAN_QUALITY_REJECTED",
        "The enhancement did not pass EventoAI's quality checks.",
        502,
        false,
      );
    }

    return createResult(
      local,
      startedAt,
      "ai_enhanced",
      config.primaryModel,
      candidate,
    );
  } catch (error) {
    logLocalFallback(error, config.primaryModel);

    return createResult(
      local,
      startedAt,
      "local_fallback",
      "local-planner",
    );
  }
}