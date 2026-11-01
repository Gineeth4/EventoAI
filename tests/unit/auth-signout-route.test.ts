import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { POST } from "@/app/auth/signout/route";

const endpoint = "https://eventoai.example/auth/signout";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request(endpoint, {
    method: "POST",
    headers,
  });
}

describe("POST /auth/signout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("VERCEL", "");

    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { signOut: mocks.signOut },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows a same-origin browser form submission", async () => {
    const response = await POST(
      makeRequest({ origin: "https://eventoai.example" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://eventoai.example/login?message=signed-out",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("allows a same-origin Referer when Origin is absent", async () => {
    const response = await POST(
      makeRequest({
        referer: "https://eventoai.example/events",
      }),
    );

    expect(response.status).toBe(303);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("uses the browser-facing Host when the framework URL is internal", async () => {
    const request = new Request(
      "http://internal-runtime:3000/auth/signout",
      {
        method: "POST",
        headers: {
          host: "127.0.0.1:3002",
          origin: "http://127.0.0.1:3002",
        },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("uses trusted Vercel forwarded host and protocol", async () => {
    vi.stubEnv("VERCEL", "1");

    const request = new Request(
      "http://internal-runtime:3000/auth/signout",
      {
        method: "POST",
        headers: {
          host: "internal-runtime:3000",
          "x-forwarded-host": "eventoai.example",
          "x-forwarded-proto": "https",
          origin: "https://eventoai.example",
        },
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("rejects requests without Origin or Referer", async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin Origin", async () => {
    const response = await POST(
      makeRequest({ origin: "https://attacker.example" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid Origin", async () => {
    const response = await POST(
      makeRequest({ origin: "not-a-url" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin Referer", async () => {
    const response = await POST(
      makeRequest({ referer: "https://attacker.example/page" }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects requests marked as cross-site", async () => {
    const response = await POST(
      makeRequest({
        origin: "https://eventoai.example",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
