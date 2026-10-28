/**
 * Unit tests for EventoAI's AI model configuration.
 *
 * These tests do not call the Gemini API or consume API quota.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  getAIModelConfig,
  FREE_TIER_MODEL_IDS,
} from "@/lib/ai/model-config";

describe("getAIModelConfig", () => {
  beforeEach(() => {
    // Explicitly clear settings so tests are independent of .env.local.
    vi.stubEnv("GEMINI_MODEL_PRIMARY", "");
    vi.stubEnv("GEMINI_MODEL_FAST", "");
    vi.stubEnv("GEMINI_ENABLE_FREE_FALLBACK", "");
    vi.stubEnv("GEMINI_PRIMARY_THINKING_LEVEL", "");
    vi.stubEnv("GEMINI_FALLBACK_THINKING_LEVEL", "");
    vi.stubEnv("GEMINI_MAX_OUTPUT_TOKENS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the intended free-tier model pair", () => {
    const config = getAIModelConfig();

    expect(config.primaryModel).toBe("gemini-3.8-flash");
    expect(config.fallbackModel).toBe("gemini-3.1-flash-lite");
    expect(config.enableFreeFallback).toBe(true);
  });

  it("only allows configured models from the approved allowlist", () => {
    const config = getAIModelConfig();

    expect(
      FREE_TIER_MODEL_IDS,
    ).toContain(config.primaryModel);

    expect(
      FREE_TIER_MODEL_IDS,
    ).toContain(config.fallbackModel);
  });

  it("uses medium reasoning for the primary and low for the fallback", () => {
    const config = getAIModelConfig();

    expect(config.primaryThinkingLevel).toBe("medium");
    expect(config.fallbackThinkingLevel).toBe("low");
  });

  it("uses a bounded output-token limit", () => {
    const config = getAIModelConfig();

    expect(config.maxOutputTokens).toBe(8192);
  });

  it("rejects a model outside the approved free-tier allowlist", () => {
    vi.stubEnv("GEMINI_MODEL_PRIMARY", "gemini-4-argon");

    expect(() => getAIModelConfig()).toThrow(
      /free-tier model/i,
    );
  });

  it("supports disabling fallback explicitly", () => {
    vi.stubEnv("GEMINI_ENABLE_FREE_FALLBACK", "false");

    const config = getAIModelConfig();

    expect(config.enableFreeFallback).toBe(false);
  });

  it("rejects invalid reasoning levels", () => {
    vi.stubEnv("GEMINI_PRIMARY_THINKING_LEVEL", "extreme");

    expect(() => getAIModelConfig()).toThrow(
      /must be minimal, low, medium, or high/i,
    );
  });

  it("rejects an unreasonable output-token limit", () => {
    vi.stubEnv("GEMINI_MAX_OUTPUT_TOKENS", "100000");

    expect(() => getAIModelConfig()).toThrow(
      /1024 to 16384/i,
    );
  });
});