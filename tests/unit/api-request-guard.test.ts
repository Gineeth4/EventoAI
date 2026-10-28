import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumePlanApiRateLimit,
  createFixedWindowRateLimiter,
  getPlanApiClientKey,
  isSameOriginRequest,
  readLimitedRequestBody,
} from "@/lib/security/api-request-guard";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API request guard", () => {
  it("allows a same-origin browser request", () => {
    const request = new Request("http://localhost:3000/api/ai/plan", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
      },
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("rejects a cross-origin browser request", () => {
    const request = new Request("http://localhost:3000/api/ai/plan", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
      },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("rejects an invalid Origin header", () => {
    const request = new Request("http://localhost:3000/api/ai/plan", {
      method: "POST",
      headers: {
        origin: "not a URL",
      },
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("permits calls without an Origin header for non-browser clients", () => {
    const request = new Request("http://localhost:3000/api/ai/plan", {
      method: "POST",
    });

    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("allows requests within the byte limit", async () => {
    const request = new Request("http://localhost/api/ai/plan", {
      method: "POST",
      body: "abc",
    });

    await expect(readLimitedRequestBody(request, 3)).resolves.toEqual({
      ok: true,
      text: "abc",
    });
  });

  it("rejects a body that exceeds the byte limit", async () => {
    const request = new Request("http://localhost/api/ai/plan", {
      method: "POST",
      body: "abcd",
    });

    await expect(readLimitedRequestBody(request, 3)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("measures UTF-8 bytes rather than JavaScript character count", async () => {
    const request = new Request("http://localhost/api/ai/plan", {
      method: "POST",
      body: "ðŸ˜€",
    });

    await expect(readLimitedRequestBody(request, 3)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("uses the Vercel platform IP header on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("EVENTOAI_TRUSTED_PROXY_HEADER", "x-forwarded-for");

    const request = new Request("https://eventoai.example/api/ai/plan", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-forwarded-for": "198.51.100.9",
        "x-real-ip": "198.51.100.10",
      },
    });

    expect(getPlanApiClientKey(request)).toBe("203.0.113.10");
  });

  it("ignores forwarding headers on self-hosted deployments unless configured", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("EVENTOAI_TRUSTED_PROXY_HEADER", "");

    const request = new Request("https://eventoai.example/api/ai/plan", {
      headers: {
        "x-forwarded-for": "198.51.100.99",
        "x-real-ip": "198.51.100.100",
      },
    });

    expect(getPlanApiClientKey(request)).toBe("unknown");
  });

  it("uses the explicitly configured header for a trusted self-hosted proxy", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("EVENTOAI_TRUSTED_PROXY_HEADER", "x-forwarded-for");

    const request = new Request("https://eventoai.example/api/ai/plan", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "x-real-ip": "198.51.100.100",
      },
    });

    expect(getPlanApiClientKey(request)).toBe("203.0.113.7");
  });

  it("enforces a fixed-window request limit and resets the window", () => {
    const consume = createFixedWindowRateLimiter({
      maxRequests: 2,
      windowMs: 1_000,
      maxClients: 10,
    });

    expect(consume("client-a", 1_000).allowed).toBe(true);
    expect(consume("client-a", 1_001).allowed).toBe(true);

    expect(consume("client-a", 1_002)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
    });

    expect(consume("client-a", 2_000).allowed).toBe(true);
  });

  it("keeps rate-limit buckets separate by client key", () => {
    const consume = createFixedWindowRateLimiter({
      maxRequests: 1,
      windowMs: 1_000,
    });

    expect(consume("client-a", 5_000).allowed).toBe(true);
    expect(consume("client-b", 5_000).allowed).toBe(true);
    expect(consume("client-a", 5_001).allowed).toBe(false);
  });
  it("fails closed in production when both Redis credentials are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(
      consumePlanApiRateLimit("production-no-redis"),
    ).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      configurationMissing: true,
    });
  });

  it("fails closed in production when Redis configuration is partial", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv(
      "UPSTASH_REDIS_REST_URL",
      "https://example.upstash.io",
    );
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(
      consumePlanApiRateLimit("production-partial-redis"),
    ).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      configurationMissing: true,
    });
  });

  it("uses the in-memory limiter in development when both Redis credentials are absent", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(
      consumePlanApiRateLimit("development-no-redis"),
    ).resolves.toMatchObject({
      allowed: true,
      remaining: 19,
    });
  });

});
