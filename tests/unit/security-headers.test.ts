import { describe, expect, it } from "vitest";

import { createSecurityHeaders } from "@/lib/security/security-headers";

function findHeader(
  headers: ReturnType<typeof createSecurityHeaders>,
  name: string,
): string | undefined {
  return headers.find(
    (header) => header.key.toLowerCase() === name.toLowerCase(),
  )?.value;
}

describe("response security headers", () => {
  it("retains the existing baseline security headers", () => {
    const headers = createSecurityHeaders({
      production: false,
    });

    expect(findHeader(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(findHeader(headers, "X-Frame-Options")).toBe("DENY");
    expect(findHeader(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(findHeader(headers, "Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(findHeader(headers, "Cross-Origin-Opener-Policy")).toBe(
      "same-origin",
    );
    expect(findHeader(headers, "X-Permitted-Cross-Domain-Policies")).toBe(
      "none",
    );
  });

  it("adds a report-only CSP without enforcing it", () => {
    const headers = createSecurityHeaders({
      production: false,
    });
    const csp = findHeader(headers, "Content-Security-Policy-Report-Only");

    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(findHeader(headers, "Content-Security-Policy")).toBeUndefined();
  });

  it("includes the configured Supabase origin and WebSocket origin", () => {
    const headers = createSecurityHeaders({
      production: true,
      supabaseUrl: "https://project.example-supabase.net/path",
    });
    const csp = findHeader(headers, "Content-Security-Policy-Report-Only");

    expect(csp).toContain("https://project.example-supabase.net");
    expect(csp).toContain("wss://project.example-supabase.net");
  });

  it("does not add HSTS outside production", () => {
    const headers = createSecurityHeaders({
      production: false,
    });

    expect(
      findHeader(headers, "Strict-Transport-Security"),
    ).toBeUndefined();
  });

  it("adds HSTS in production", () => {
    const headers = createSecurityHeaders({
      production: true,
    });

    expect(
      findHeader(headers, "Strict-Transport-Security"),
    ).toBe("max-age=31536000; includeSubDomains");
  });

  it("ignores an invalid Supabase URL rather than adding it to the policy", () => {
    const headers = createSecurityHeaders({
      production: true,
      supabaseUrl: "not a valid URL",
    });
    const csp = findHeader(headers, "Content-Security-Policy-Report-Only");

    expect(csp).toBeDefined();
    expect(csp).not.toContain("not a valid URL");
  });
});
