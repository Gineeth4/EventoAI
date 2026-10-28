/**
 * EventoAI — Safe AI error handling
 *
 * Never expose raw SDK messages, stack traces, request headers,
 * or API credentials to a public client.
 */

export class EventoAIError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 502,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "EventoAIError";
  }
}

export type PublicAIError = {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
};

type ProviderErrorLike = {
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  response?: {
    status?: unknown;
  };
};

/** Extract a numeric HTTP status from a provider error, if present. */
export function getProviderStatus(
  error: unknown,
): number | undefined {
  if (error instanceof EventoAIError) {
    return error.statusCode;
  }

  if (!error || typeof error !== "object") {
    return undefined;
  }

  const value = error as ProviderErrorLike;

  for (const candidate of [
    value.status,
    value.statusCode,
    value.response?.status,
  ]) {
    const parsed = Number(candidate);

    if (
      Number.isInteger(parsed) &&
      parsed >= 100 &&
      parsed <= 599
    ) {
      return parsed;
    }
  }

  // Some SDK errors include the status only in their message.
  if (typeof value.message === "string") {
    const match = value.message.match(
      /\b(400|401|403|404|408|429|500|502|503|504)\b/,
    );

    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}

/**
 * Only provider-level failures likely to be model-specific should
 * trigger the one-time fallback. Application configuration errors,
 * authentication failures, and timeouts must not automatically cause
 * another potentially expensive request.
 */
export function isFallbackEligible(
  error: unknown,
): boolean {
  if (error instanceof EventoAIError) {
    return false;
  }

  const status = getProviderStatus(error);

  return (
    status === 404 ||
    status === 429 ||
    status === 503
  );
}

/** Convert provider details to a safe user-facing error. */
export function toPublicAIError(
  error: unknown,
): PublicAIError {
  if (error instanceof EventoAIError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.retryable,
    };
  }

  const providerError =
    error && typeof error === "object"
      ? (error as ProviderErrorLike)
      : undefined;

  const message =
    typeof providerError?.message === "string"
      ? providerError.message.toLowerCase()
      : "";

  const status = getProviderStatus(error);

  if (status === 429) {
    const dailyQuota =
      /daily|per day|requests per day|tokens per day|daily quota/.test(
        message,
      );

    return {
      code: dailyQuota
        ? "AI_DAILY_QUOTA_EXCEEDED"
        : "AI_RATE_LIMITED",

      message: dailyQuota
        ? "The configured Gemini model quota appears to be exhausted for the day. Check Google AI Studio usage and quota information before retrying."
        : "Gemini's request-rate or usage quota has been reached. Check Google AI Studio limits and try again when the quota allows.",

      statusCode: 429,
      retryable: !dailyQuota,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    /invalid api key|permission denied|unauthorized|billing required/.test(
      message,
    )
  ) {
    return {
      code: "AI_ACCESS_DENIED",
      message:
        "EventoAI could not access the configured Gemini model. Check the API key, model permissions, and project configuration.",
      statusCode: 503,
      retryable: false,
    };
  }

  if (
    status === 404 ||
    /model not found|model.*not available/.test(message)
  ) {
    return {
      code: "AI_MODEL_UNAVAILABLE",
      message:
        "The configured Gemini model is unavailable. Verify the model ID and your project's access.",
      statusCode: 502,
      retryable: false,
    };
  }

  if (
    status === 504 ||
    /timeout|timed out|deadline exceeded|etimedout|aborterror/.test(
      message,
    )
  ) {
    return {
      code: "AI_TIMEOUT",
      message:
        "Event-plan generation took too long. Please try again.",
      statusCode: 504,
      retryable: true,
    };
  }

  if (status === 503) {
    return {
      code: "AI_TEMPORARILY_UNAVAILABLE",
      message:
        "Gemini is temporarily unavailable. Please try again shortly.",
      statusCode: 503,
      retryable: true,
    };
  }

  if (status === 400) {
    return {
      code: "AI_REQUEST_REJECTED",
      message:
        "Gemini rejected the request format. Review the model configuration and structured-output schema.",
      statusCode: 502,
      retryable: false,
    };
  }

  return {
    code: "AI_GENERATION_FAILED",
    message:
      "EventoAI could not generate a reliable plan. Please retry the request.",
    statusCode: 502,
    retryable: true,
  };
}