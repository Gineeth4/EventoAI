export type SecurityHeader = {
  key: string;
  value: string;
};

type SecurityHeaderOptions = {
  production: boolean;
  supabaseUrl?: string;
};

/**
 * Derive the configured Supabase connection origins without trusting
 * arbitrary request input. The URL comes from application configuration.
 */
function getSupabaseConnectionOrigins(supabaseUrl?: string): string[] {
  if (!supabaseUrl?.trim()) {
    return [];
  }

  try {
    const url = new URL(supabaseUrl);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return [];
    }

    const websocketUrl = new URL(url.origin);
    websocketUrl.protocol =
      url.protocol === "https:" ? "wss:" : "ws:";

    return [url.origin, websocketUrl.origin];
  } catch {
    return [];
  }
}

/**
 * Shared response security headers.
 *
 * The CSP remains report-only until real-browser testing confirms that
 * the policy accommodates every required resource. This compatibility
 * baseline allows inline scripts/styles and is not a strict XSS policy.
 */
export function createSecurityHeaders({
  production,
  supabaseUrl,
}: SecurityHeaderOptions): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin",
    },
    {
      key: "X-Permitted-Cross-Domain-Policies",
      value: "none",
    },
  ];

  const connectSources = new Set<string>([
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    ...getSupabaseConnectionOrigins(supabaseUrl),
  ]);

  // Next.js development uses local HTTP and WebSocket connections.
  // These are report-only allowances for local development.
  if (!production) {
    connectSources.add("http://localhost:*");
    connectSources.add("ws://localhost:*");
    connectSources.add("http://127.0.0.1:*");
    connectSources.add("ws://127.0.0.1:*");
  }

  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src " + Array.from(connectSources).join(" "),
  ];

  headers.push({
    key: "Content-Security-Policy-Report-Only",
    value: cspDirectives.join("; "),
  });

  // HSTS is sent only in production; production must use HTTPS.
  if (production) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}
