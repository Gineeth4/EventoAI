/**
 * Unit tests for EventoAI's error mapping and fallback eligibility.
 */

import { describe, expect, it } from "vitest";

import {
  EventoAIError,
  getProviderStatus,
  isFallbackEligible,
  toPublicAIError,
} from "@/lib/ai/handle-ai-error";

/** Construct a provider-like error without making a network request. */
function providerError(
  message: string,
  status: number,
): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

describe("getProviderStatus", () => {
  it("reads a numeric HTTP status", () => {
    expect(
      getProviderStatus(providerError("RESOURCE_EXHAUSTED", 429)),
    ).toBe(429);
  });

  it("preserves application error status codes", () => {
    expect(
      getProviderStatus(
        new EventoAIError("TEST", "Test failure", 422),
      ),
    ).toBe(422);
  });

  it("returns undefined when no status can be found", () => {
    expect(
      getProviderStatus(new Error("Unexpected failure")),
    ).toBeUndefined();
  });
});

describe("isFallbackEligible", () => {
  it.each([404, 429, 503])(
    "allows one fallback attempt for HTTP %i",
    (status) => {
      expect(
        isFallbackEligible(
          providerError("Provider failure", status),
        ),
      ).toBe(true);
    },
  );

  it("does not fallback on authentication or permission errors", () => {
    expect(
      isFallbackEligible(
        providerError("Permission denied", 403),
      ),
    ).toBe(false);
  });

  it("does not fallback on an application configuration error", () => {
    expect(
      isFallbackEligible(
        new EventoAIError(
          "AI_MODEL_NOT_APPROVED",
          "Invalid model setting",
          500,
        ),
      ),
    ).toBe(false);
  });

  it("does not fallback on arbitrary unknown errors", () => {
    expect(
      isFallbackEligible(new Error("Unexpected failure")),
    ).toBe(false);
  });
});

describe("toPublicAIError", () => {
  it("maps rate-limit responses without exposing raw provider messages", () => {
    const result = toPublicAIError(
      providerError(
        "429 RESOURCE_EXHAUSTED: internal provider details",
        429,
      ),
    );

    expect(result.code).toBe("AI_RATE_LIMITED");
    expect(result.statusCode).toBe(429);
    expect(result.retryable).toBe(true);
    expect(result.message).not.toContain("internal provider details");
  });

  it("identifies a daily quota message", () => {
    const result = toPublicAIError(
      providerError("Daily quota exceeded", 429),
    );

    expect(result.code).toBe("AI_DAILY_QUOTA_EXCEEDED");
    expect(result.retryable).toBe(false);
  });

  it("maps model-not-found responses", () => {
    const result = toPublicAIError(
      providerError("Model not found", 404),
    );

    expect(result.code).toBe("AI_MODEL_UNAVAILABLE");
  });

  it("maps access-denied responses", () => {
    const result = toPublicAIError(
      providerError("Permission denied", 403),
    );

    expect(result.code).toBe("AI_ACCESS_DENIED");
    expect(result.retryable).toBe(false);
  });

  it("maps timeout responses", () => {
    const result = toPublicAIError(
      providerError("Deadline exceeded", 504),
    );

    expect(result.code).toBe("AI_TIMEOUT");
    expect(result.statusCode).toBe(504);
  });

  it("preserves known EventoAI errors", () => {
    const error = new EventoAIError(
      "MISSING_PLANNING_DETAILS",
      "Provide an event date.",
      422,
    );

    expect(toPublicAIError(error)).toEqual({
      code: "MISSING_PLANNING_DETAILS",
      message: "Provide an event date.",
      statusCode: 422,
      retryable: false,
    });
  });

  it("returns a safe generic error for unknown failures", () => {
    const result = toPublicAIError(
      new Error("Private error information"),
    );

    expect(result.code).toBe("AI_GENERATION_FAILED");
    expect(result.message).not.toContain(
      "Private error information",
    );
  });
});