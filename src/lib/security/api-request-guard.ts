import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type LimitedBodyResult =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: "too_large" | "invalid_utf8" | "unreadable";
    };

type RateLimitOptions = {
  maxRequests?: number;
  windowMs?: number;
  maxClients?: number;
};

type WindowBucket = {
  count: number;
  resetAt: number;
};

/**
 * Browser POST requests should be same-origin. Requests without an
 * Origin header are allowed for non-browser callers; this is not auth.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/**
 * Use the first forwarded client address when the hosting proxy supplies
 * it. Configure the deployment proxy to sanitize these headers.
 * This identifier is not authentication and may be spoofable if the
 * application is reachable without a trusted proxy.
 */
/**
 * Derive a rate-limit key only from an explicitly trusted source.
 *
 * Vercel deployments use the platform-provided x-vercel-forwarded-for
 * header. Self-hosted deployments must explicitly configure
 * EVENTOAI_TRUSTED_PROXY_HEADER, and their proxy must sanitize that header.
 * Otherwise, use "unknown" rather than trust caller-controlled headers.
 */
export function getPlanApiClientKey(request: Request): string {
  let forwarded: string | null = null;

  if (process.env.VERCEL === "1") {
    forwarded = request.headers.get("x-vercel-forwarded-for");
  } else {
    const trustedHeader =
      process.env.EVENTOAI_TRUSTED_PROXY_HEADER?.trim().toLowerCase();

    if (
      trustedHeader === "x-forwarded-for" ||
      trustedHeader === "x-real-ip"
    ) {
      forwarded = request.headers.get(trustedHeader);
    }
  }

  const candidate = forwarded?.split(",")[0]?.trim();

  return candidate ? candidate.slice(0, 128) : "unknown";
}

/**
 * In-memory fixed-window limiter. It is bounded to avoid unbounded map
 * growth. Each process or serverless instance maintains its own counters;
 * production deployments still need a shared distributed limiter.
 */
export function createFixedWindowRateLimiter(
  options: RateLimitOptions = {},
): (key: string, now?: number) => RateLimitDecision {
  const maxRequests = Math.max(
    1,
    Math.floor(options.maxRequests ?? 20),
  );
  const windowMs = Math.max(1, options.windowMs ?? 60_000);
  const maxClients = Math.max(
    1,
    Math.floor(options.maxClients ?? 5_000),
  );

  const buckets = new Map<string, WindowBucket>();

  return (key: string, now = Date.now()): RateLimitDecision => {
    const safeKey = key.trim().slice(0, 128) || "unknown";
    let bucket = buckets.get(safeKey);

    if (!bucket || now >= bucket.resetAt) {
      if (buckets.size >= maxClients) {
        for (const [existingKey, value] of buckets) {
          if (now >= value.resetAt) {
            buckets.delete(existingKey);
          }
        }

        if (buckets.size >= maxClients) {
          const oldestKey = buckets.keys().next();

          if (!oldestKey.done) {
            buckets.delete(oldestKey.value);
          }
        }
      }

      bucket = {
        count: 0,
        resetAt: now + windowMs,
      };

      buckets.set(safeKey, bucket);
    }

    if (bucket.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1000),
        ),
      };
    }

    bucket.count += 1;

    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - bucket.count),
      retryAfterSeconds: 0,
    };
  };
}

const planApiLimiter = createFixedWindowRateLimiter({
  maxRequests: 20,
  windowMs: 60_000,
  maxClients: 5_000,
});

let upstashPlanApiLimiter: Ratelimit | undefined;

export type PlanApiRateLimitResult = RateLimitDecision & {
  configurationMissing?: boolean;
  serviceUnavailable?: boolean;
};

function getUpstashPlanApiLimiter(): Ratelimit {
  if (upstashPlanApiLimiter) {
    return upstashPlanApiLimiter;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new Error("Upstash rate-limiter configuration is incomplete.");
  }

  upstashPlanApiLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "eventoai:plan-api",
    timeout: 4_000,
  });

  return upstashPlanApiLimiter;
}

/**
 * Use the distributed Upstash limiter when configured.
 *
 * Development and test environments can use the bounded in-memory
 * limiter when neither Upstash credential is configured. Production
 * fails closed when Redis configuration is missing or Redis is unavailable.
 */
export async function consumePlanApiRateLimit(
  clientKey: string,
): Promise<PlanApiRateLimitResult> {
  const isProduction = process.env.NODE_ENV === "production";
  const isTest = process.env.NODE_ENV === "test";

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  // Tests must remain deterministic and must never contact Redis.
  if (isTest) {
    return planApiLimiter(clientKey);
  }

  // No Redis configuration: retain local development usability,
  // but never silently downgrade production protection.
  if (!url && !token) {
    if (!isProduction) {
      return planApiLimiter(clientKey);
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 0,
      configurationMissing: true,
    };
  }

  // Partial configuration should not silently fall back to memory.
  if (!url || !token) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 0,
      configurationMissing: true,
    };
  }

  try {
    const identifier = clientKey.trim().slice(0, 128) || "unknown";
    const result = await getUpstashPlanApiLimiter().limit(identifier);

    // Upstash can return a successful decision when its own timeout
    // is reached. Treat that specific result as unavailable so this
    // endpoint does not bypass rate limiting when Redis is slow.
    const reason = (result as unknown as { reason?: string }).reason;

    if (reason === "timeout") {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 1,
        serviceUnavailable: true,
      };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1_000),
    );

    return {
      allowed: result.success,
      remaining: Math.max(0, result.remaining),
      retryAfterSeconds: result.success ? 0 : retryAfterSeconds,
    };
  } catch (error) {
    // Never log credentials or raw provider/Redis error messages.
    console.error("[EventoAI] Distributed rate limiter unavailable.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1,
      serviceUnavailable: true,
    };
  }
}

/**
 * Read no more than maxBytes from the request stream. This protects
 * against oversized bodies even when Content-Length is missing.
 */
export async function readLimitedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<LimitedBodyResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error("The request body limit is invalid.");
  }

  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const part = await reader.read();

      if (part.done) {
        break;
      }

      totalBytes += part.value.byteLength;

      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size limit remains enforced if cancellation fails.
        }

        return { ok: false, reason: "too_large" };
      }

      chunks.push(part.value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      // Preserve the controlled error result.
    }

    return { ok: false, reason: "unreadable" };
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      ok: true,
      text: new TextDecoder("utf-8", { fatal: true }).decode(combined),
    };
  } catch {
    return { ok: false, reason: "invalid_utf8" };
  }
}
