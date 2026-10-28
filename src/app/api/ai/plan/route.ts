/**
 * EventoAI  -  Event-plan API
 *
 * POST /api/ai/plan
 *
 * This endpoint is for local development and integration testing.
 * Do not expose it publicly until authentication and distributed
 * server-side rate limiting are implemented.
 */

import { NextResponse } from "next/server";

import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

import {
  consumePlanApiRateLimit,
  getPlanApiClientKey,
  isSameOriginRequest,
  readLimitedRequestBody,
} from "@/lib/security/api-request-guard";

import {
  eventInputSchema,
} from "@/lib/validation/event-input";

import {
  generateEventPlan,
  MissingPlanningDetailsError,
} from "@/lib/ai/generate-event-plan";

import {
  toPublicAIError,
} from "@/lib/ai/handle-ai-error";

export const maxDuration = 60;

const MAX_BODY_LENGTH = 64_000;

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export async function POST(request: Request) {
  // Browser-origin check. Requests without Origin are handled as
  // non-browser calls and remain subject to rate limiting.
  if (!isSameOriginRequest(request)) {
    return jsonResponse(
      {
        error: {
          code: "CROSS_ORIGIN_REQUEST",
          message: "Cross-origin requests are not allowed.",
        },
      },
      403,
    );
  }

  const rateLimit = await consumePlanApiRateLimit(
    getPlanApiClientKey(request),
  );

  if (rateLimit.configurationMissing) {
    return jsonResponse(
      {
        error: {
          code: "RATE_LIMITER_NOT_CONFIGURED",
          message: "The planning service is temporarily unavailable. Please try again later.",
          retryable: true,
        },
      },
      503,
    );
  }

  if (rateLimit.serviceUnavailable) {
    return jsonResponse(
      {
        error: {
          code: "RATE_LIMITER_UNAVAILABLE",
          message: "The planning service is temporarily unavailable. Please try again later.",
          retryable: true,
        },
      },
      503,
    );
  }

  if (!rateLimit.allowed) {
    return jsonResponse(
      {
        error: {
          code: "API_RATE_LIMITED",
          message: "Too many planning requests. Please wait before trying again.",
          retryable: true,
        },
      },
      429,
      {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    );
  }

  let authenticatedUserId: string;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error && error.status !== 400 && error.status !== 401) {
      console.error("[EventoAI] Authentication verification unavailable.", {
        errorName: error.name || "AuthError",
        status: error.status ?? null,
      });

      return jsonResponse(
        {
          error: {
            code: "AUTH_SERVICE_UNAVAILABLE",
            message: "Authentication is temporarily unavailable. Please try again later.",
            retryable: true,
          },
        },
        503,
      );
    }

    if (!data.user) {
      return jsonResponse(
        {
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message: "Please sign in before creating an event plan.",
            retryable: false,
          },
        },
        401,
      );
    }

    authenticatedUserId = data.user.id;
  } catch (error) {
    console.error("[EventoAI] Authentication verification failed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return jsonResponse(
      {
        error: {
          code: "AUTH_SERVICE_UNAVAILABLE",
          message: "Authentication is temporarily unavailable. Please try again later.",
          retryable: true,
        },
      },
      503,
    );
  }

  const userRateLimit = await consumePlanApiRateLimit(
    `user:${authenticatedUserId}`,
  );

  if (userRateLimit.configurationMissing) {
    return jsonResponse(
      {
        error: {
          code: "RATE_LIMITER_NOT_CONFIGURED",
          message: "The planning service is temporarily unavailable. Please try again later.",
          retryable: true,
        },
      },
      503,
    );
  }

  if (userRateLimit.serviceUnavailable) {
    return jsonResponse(
      {
        error: {
          code: "RATE_LIMITER_UNAVAILABLE",
          message: "The planning service is temporarily unavailable. Please try again later.",
          retryable: true,
        },
      },
      503,
    );
  }

  if (!userRateLimit.allowed) {
    return jsonResponse(
      {
        error: {
          code: "API_RATE_LIMITED",
          message: "Too many planning requests. Please wait before trying again.",
          retryable: true,
        },
      },
      429,
      {
        "Retry-After": String(userRateLimit.retryAfterSeconds),
      },
    );
  }
  const contentType = request.headers.get("content-type") ?? "";

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return jsonResponse(
      {
        error: {
          code: "UNSUPPORTED_CONTENT_TYPE",
          message: "The request body must use application/json.",
        },
      },
      415,
    );
  }

  const declaredLength = request.headers.get("content-length");

  if (declaredLength !== null) {
    const length = Number(declaredLength);

    if (!Number.isSafeInteger(length) || length < 0) {
      return jsonResponse(
        {
          error: {
            code: "INVALID_CONTENT_LENGTH",
            message: "The request content length is invalid.",
          },
        },
        400,
      );
    }

    if (length > MAX_BODY_LENGTH) {
      return jsonResponse(
        {
          error: {
            code: "REQUEST_BODY_TOO_LARGE",
            message:
              "The event request is too large. Shorten the event description and try again.",
          },
        },
        413,
      );
    }
  }

  const bodyResult = await readLimitedRequestBody(
    request,
    MAX_BODY_LENGTH,
  );

  if (!bodyResult.ok) {
    if (bodyResult.reason === "too_large") {
      return jsonResponse(
        {
          error: {
            code: "REQUEST_BODY_TOO_LARGE",
            message:
              "The event request is too large. Shorten the event description and try again.",
          },
        },
        413,
      );
    }

    if (bodyResult.reason === "invalid_utf8") {
      return jsonResponse(
        {
          error: {
            code: "INVALID_REQUEST_ENCODING",
            message: "The request body must be valid UTF-8 JSON.",
          },
        },
        400,
      );
    }

    return jsonResponse(
      {
        error: {
          code: "REQUEST_BODY_UNREADABLE",
          message: "EventoAI could not read the request body.",
        },
      },
      400,
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return jsonResponse(
      {
        error: {
          code: "INVALID_JSON",
          message: "The request body must be valid JSON.",
        },
      },
      400,
    );
  }

  const inputResult = eventInputSchema.safeParse(body);

  if (!inputResult.success) {
    return jsonResponse(
      {
        error: {
          code: "INVALID_EVENT_INPUT",
          message:
            "Some event details are invalid. Please review the supplied fields.",
          issues: inputResult.error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }

  try {
    const result = await generateEventPlan(inputResult.data);

    return jsonResponse(
      {
        success: true,
        data: result,
      },
      200,
    );
  } catch (error) {
    if (error instanceof MissingPlanningDetailsError) {
      return jsonResponse(
        {
          error: {
            code: error.code,
            message: error.message,
            missingFields: error.missingFields,
          },
        },
        error.statusCode,
      );
    }

    const safeError = toPublicAIError(error);

    // Log only safe diagnostic identifiers, not prompts, API keys,
    // event details, or raw provider error messages.
    console.error(
      "[EventoAI] Plan generation failed.",
      {
        code: safeError.code,
        statusCode: safeError.statusCode,
        errorName:
          error instanceof Error
            ? error.name
            : "UnknownError",
      },
    );

    return jsonResponse(
      {
        error: {
          code: safeError.code,
          message: safeError.message,
          retryable: safeError.retryable,
        },
      },
      safeError.statusCode,
    );
  }
}
