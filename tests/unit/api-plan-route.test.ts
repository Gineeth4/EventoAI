import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumePlanApiRateLimit: vi.fn(),
  getPlanApiClientKey: vi.fn(),
  isSameOriginRequest: vi.fn(),
  readLimitedRequestBody: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  eventInputSafeParse: vi.fn(),
  generateEventPlan: vi.fn(),
  toPublicAIError: vi.fn(),
}));

vi.mock("@/lib/security/api-request-guard", () => ({
  consumePlanApiRateLimit: mocks.consumePlanApiRateLimit,
  getPlanApiClientKey: mocks.getPlanApiClientKey,
  isSameOriginRequest: mocks.isSameOriginRequest,
  readLimitedRequestBody: mocks.readLimitedRequestBody,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/validation/event-input", () => ({
  eventInputSchema: {
    safeParse: mocks.eventInputSafeParse,
  },
}));

vi.mock("@/lib/ai/generate-event-plan", () => ({
  generateEventPlan: mocks.generateEventPlan,
  MissingPlanningDetailsError: class MissingPlanningDetailsError extends Error {
    code = "MISSING_PLANNING_DETAILS";
    statusCode = 422;
    missingFields: string[];

    constructor(missingFields: string[]) {
      super("Provide an event date.");
      this.missingFields = missingFields;
    }
  },
}));

vi.mock("@/lib/ai/handle-ai-error", () => ({
  toPublicAIError: mocks.toPublicAIError,
}));

import { MissingPlanningDetailsError } from "@/lib/ai/generate-event-plan";
import { POST } from "@/app/api/ai/plan/route";

const allowedRateLimit = {
  allowed: true,
  remaining: 10,
  retryAfterSeconds: 1,
};

function makeRequest(
  body: string,
  contentType = "application/json",
): Request {
  return new Request("http://localhost:3000/api/ai/plan", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": contentType,
    },
    body,
  });
}

async function getErrorCode(
  response: Response,
): Promise<string | undefined> {
  const body = (await response.json()) as {
    error?: { code?: string };
  };

  return body.error?.code;
}

describe("POST /api/ai/plan", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.getPlanApiClientKey.mockReturnValue("test-client");
    mocks.consumePlanApiRateLimit.mockResolvedValue(allowedRateLimit);

    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
    });

    mocks.readLimitedRequestBody.mockImplementation(
      async (request: Request) => ({
        ok: true,
        text: await request.text(),
      }),
    );

    mocks.eventInputSafeParse.mockReturnValue({
      success: false,
      error: {
        issues: [
          {
            path: ["title"],
            message: "Required",
          },
        ],
      },
    });

    mocks.generateEventPlan.mockResolvedValue({
      title: "Generated test plan",
    });

    mocks.toPublicAIError.mockReturnValue({
      code: "AI_GENERATION_FAILED",
      message: "The plan could not be generated.",
      statusCode: 500,
      retryable: false,
    });
  });

  it("rejects cross-origin requests before consuming rate limits", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(403);
    expect(await getErrorCode(response)).toBe("CROSS_ORIGIN_REQUEST");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.consumePlanApiRateLimit).not.toHaveBeenCalled();
  });

  it("returns a safe service error when rate-limit configuration is missing", async () => {
    mocks.consumePlanApiRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      configurationMissing: true,
    });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(503);
    expect(await getErrorCode(response)).toBe(
      "RATE_LIMITER_NOT_CONFIGURED",
    );
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("returns a safe service error when the rate limiter is unavailable", async () => {
    mocks.consumePlanApiRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      serviceUnavailable: true,
      retryAfterSeconds: 1,
    });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(503);
    expect(await getErrorCode(response)).toBe(
      "RATE_LIMITER_UNAVAILABLE",
    );
  });

  it("returns 429 with Retry-After when the IP rate limit is exceeded", async () => {
    mocks.consumePlanApiRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 17,
    });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(429);
    expect(await getErrorCode(response)).toBe("API_RATE_LIMITED");
    expect(response.headers.get("retry-after")).toBe("17");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("enforces the authenticated user's rate limit as well", async () => {
    mocks.consumePlanApiRateLimit
      .mockResolvedValueOnce(allowedRateLimit)
      .mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        serviceUnavailable: true,
        retryAfterSeconds: 1,
      });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(503);
    expect(await getErrorCode(response)).toBe(
      "RATE_LIMITER_UNAVAILABLE",
    );
    expect(mocks.consumePlanApiRateLimit).toHaveBeenCalledTimes(2);
    expect(mocks.consumePlanApiRateLimit).toHaveBeenLastCalledWith(
      "user:user-1",
    );
  });

  it("rejects unauthenticated users before reading the request body", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(401);
    expect(await getErrorCode(response)).toBe("AUTHENTICATION_REQUIRED");
    expect(mocks.readLimitedRequestBody).not.toHaveBeenCalled();
    expect(mocks.generateEventPlan).not.toHaveBeenCalled();
  });

  it("rejects unsupported content types", async () => {
    const response = await POST(makeRequest("{}", "text/plain"));

    expect(response.status).toBe(415);
    expect(await getErrorCode(response)).toBe("UNSUPPORTED_CONTENT_TYPE");
    expect(mocks.readLimitedRequestBody).not.toHaveBeenCalled();
    expect(mocks.generateEventPlan).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without calling the planning service", async () => {
    const response = await POST(makeRequest("{"));

    expect(response.status).toBe(400);
    expect(await getErrorCode(response)).toBe("INVALID_JSON");
    expect(mocks.eventInputSafeParse).not.toHaveBeenCalled();
    expect(mocks.generateEventPlan).not.toHaveBeenCalled();
  });

  it("returns structured validation errors for invalid event input", async () => {
    const response = await POST(makeRequest("{}"));

    const body = (await response.json()) as {
      error?: {
        code?: string;
        issues?: Array<{ path: string; message: string }>;
      };
    };

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("INVALID_EVENT_INPUT");
    expect(body.error?.issues).toEqual([
      { path: "title", message: "Required" },
    ]);
    expect(mocks.generateEventPlan).not.toHaveBeenCalled();
  });

  it("returns safe public errors when plan generation fails", async () => {
    mocks.eventInputSafeParse.mockReturnValueOnce({
      success: true,
      data: { title: "Test event" },
    });
    mocks.generateEventPlan.mockRejectedValueOnce(
      new Error("secret provider response"),
    );

    const response = await POST(makeRequest('{"title":"Test event"}'));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("AI_GENERATION_FAILED");
    expect(body).toContain("The plan could not be generated.");
    expect(body).not.toContain("secret provider response");
  });

  it("returns generated plan data for valid input", async () => {
    const validatedInput = { title: "Test event" };
    const generatedPlan = { title: "Generated test plan" };

    mocks.eventInputSafeParse.mockReturnValueOnce({
      success: true,
      data: validatedInput,
    });
    mocks.generateEventPlan.mockResolvedValueOnce(generatedPlan);

    const response = await POST(
      makeRequest(JSON.stringify(validatedInput)),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: generatedPlan,
    });
    expect(mocks.generateEventPlan).toHaveBeenCalledWith(validatedInput);
  });
  it("returns 503 when authentication verification reports a service error", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 500, name: "AuthServiceError" },
    });

    const response = await POST(makeRequest("{}"));

    expect(response.status).toBe(503);
    expect(await getErrorCode(response)).toBe("AUTH_SERVICE_UNAVAILABLE");
    expect(mocks.readLimitedRequestBody).not.toHaveBeenCalled();
  });

  it("returns 503 when authentication client creation fails", async () => {
    mocks.createSupabaseServerClient.mockRejectedValueOnce(
      new Error("private authentication service detail"),
    );

    const response = await POST(makeRequest("{}"));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain("AUTH_SERVICE_UNAVAILABLE");
    expect(body).not.toContain("private authentication service detail");
    expect(mocks.readLimitedRequestBody).not.toHaveBeenCalled();
  });

  it("rejects an invalid Content-Length header", async () => {
    const request = new Request(
      "http://localhost:3000/api/ai/plan",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "content-length": "invalid",
        },
        body: "{}",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await getErrorCode(response)).toBe("INVALID_CONTENT_LENGTH");
    expect(mocks.readLimitedRequestBody).not.toHaveBeenCalled();
  });

  it("rejects a declared body length above the configured limit", async () => {
    const request = new Request(
      "http://localhost:3000/api/ai/plan",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "content-length": "64001",
        },
        body: "{}",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await getErrorCode(response)).toBe("REQUEST_BODY_TOO_LARGE");
    expect(mocks.readLimitedRequestBody).not.toHaveBeenCalled();
  });

  it.each([
    {
      reason: "too_large",
      status: 413,
      code: "REQUEST_BODY_TOO_LARGE",
    },
    {
      reason: "invalid_utf8",
      status: 400,
      code: "INVALID_REQUEST_ENCODING",
    },
    {
      reason: "unreadable",
      status: 400,
      code: "REQUEST_BODY_UNREADABLE",
    },
  ] as const)(
    "handles body-reader failure: $reason",
    async ({ reason, status, code }) => {
      mocks.readLimitedRequestBody.mockResolvedValueOnce({
        ok: false,
        reason,
      });

      const response = await POST(makeRequest("{}"));

      expect(response.status).toBe(status);
      expect(await getErrorCode(response)).toBe(code);
      expect(mocks.eventInputSafeParse).not.toHaveBeenCalled();
      expect(mocks.generateEventPlan).not.toHaveBeenCalled();
    },
  );

  it("preserves missing planning details as a safe 422 response", async () => {
    mocks.eventInputSafeParse.mockReturnValueOnce({
      success: true,
      data: { title: "Test event" },
    });

    mocks.generateEventPlan.mockRejectedValueOnce(
      new MissingPlanningDetailsError(["eventDate"]),
    );

    const response = await POST(makeRequest('{"title":"Test event"}'));
    const body = (await response.json()) as {
      error?: {
        code?: string;
        message?: string;
        missingFields?: string[];
      };
    };

    expect(response.status).toBe(422);
    expect(body.error?.code).toBe("MISSING_PLANNING_DETAILS");
    expect(body.error?.message).toBe("Provide an event date.");
    expect(body.error?.missingFields).toEqual(["eventDate"]);
  });

});