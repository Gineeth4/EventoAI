/**
 * EventoAI — Model configuration.
 *
 * Environment configuration selects the model for the AI enhancement.
 * The allowlist prevents invalid or unintended model selections.
 */

import { EventoAIError } from "@/lib/ai/handle-ai-error";

export const FREE_TIER_MODEL_IDS = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;

export type FreeTierModelId =
  (typeof FREE_TIER_MODEL_IDS)[number];

export const THINKING_LEVELS = [
  "minimal",
  "low",
  "medium",
  "high",
] as const;

export type ThinkingLevel =
  (typeof THINKING_LEVELS)[number];

export type AIModelConfig = {
  primaryModel: FreeTierModelId;
  fallbackModel: FreeTierModelId;
  enableFreeFallback: boolean;
  primaryThinkingLevel: ThinkingLevel;
  fallbackThinkingLevel: ThinkingLevel;
  maxOutputTokens: number;
};

function readEnvironmentValue(
  name: string,
  defaultValue: string,
): string {
  return process.env[name]?.trim() || defaultValue;
}

function readFreeTierModel(
  name: string,
  defaultValue: FreeTierModelId,
): FreeTierModelId {
  const value = readEnvironmentValue(name, defaultValue);

  if (!FREE_TIER_MODEL_IDS.includes(value as FreeTierModelId)) {
    throw new EventoAIError(
      "AI_MODEL_NOT_APPROVED",
      `${name} must name an EventoAI-approved free-tier model.`,
      500,
      false,
    );
  }

  return value as FreeTierModelId;
}

function readThinkingLevel(
  name: string,
  defaultValue: ThinkingLevel,
): ThinkingLevel {
  const value = readEnvironmentValue(name, defaultValue);

  if (!THINKING_LEVELS.includes(value as ThinkingLevel)) {
    throw new EventoAIError(
      "AI_THINKING_LEVEL_INVALID",
      `${name} must be minimal, low, medium, or high.`,
      500,
      false,
    );
  }

  return value as ThinkingLevel;
}

function readBoolean(
  name: string,
  defaultValue: boolean,
): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new EventoAIError(
    "AI_BOOLEAN_CONFIGURATION_INVALID",
    `${name} must be true or false.`,
    500,
    false,
  );
}

function readOutputTokenLimit(): number {
  const raw = readEnvironmentValue(
    "GEMINI_MAX_OUTPUT_TOKENS",
    "8192",
  );

  const value = Number(raw);

  if (!Number.isInteger(value) || value < 1024 || value > 16384) {
    throw new EventoAIError(
      "AI_OUTPUT_LIMIT_INVALID",
      "GEMINI_MAX_OUTPUT_TOKENS must be an integer from 1024 to 16384.",
      500,
      false,
    );
  }

  return value;
}

export function getAIModelConfig(): AIModelConfig {
  return {
    // Keep existing defaults to preserve configuration compatibility.
    // The faster model is selected explicitly in .env.local.
    primaryModel: readFreeTierModel(
      "GEMINI_MODEL_PRIMARY",
      "gemini-3.8-flash",
    ),

    fallbackModel: readFreeTierModel(
      "GEMINI_MODEL_FAST",
      "gemini-3.1-flash-lite",
    ),

    enableFreeFallback: readBoolean(
      "GEMINI_ENABLE_FREE_FALLBACK",
      true,
    ),

    primaryThinkingLevel: readThinkingLevel(
      "GEMINI_PRIMARY_THINKING_LEVEL",
      "medium",
    ),

    fallbackThinkingLevel: readThinkingLevel(
      "GEMINI_FALLBACK_THINKING_LEVEL",
      "low",
    ),

    maxOutputTokens: readOutputTokenLimit(),
  };
}