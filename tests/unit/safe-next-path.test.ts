import { describe, expect, it } from "vitest";

import { getSafeNextPath } from "@/lib/auth/safe-next-path";

describe("getSafeNextPath", () => {
  it("defaults to the planner", () => {
    expect(getSafeNextPath(null)).toBe("/plan");
    expect(getSafeNextPath("")).toBe("/plan");
  });

  it("preserves an internal path and query string", () => {
    expect(getSafeNextPath("/events?filter=recent")).toBe(
      "/events?filter=recent",
    );
  });

  it("rejects an external URL", () => {
    expect(getSafeNextPath("https://attacker.example")).toBe("/plan");
  });

  it("rejects protocol-relative redirects", () => {
    expect(getSafeNextPath("//attacker.example")).toBe("/plan");
  });

  it("rejects backslash-based redirect attempts", () => {
    expect(getSafeNextPath("/\\attacker.example")).toBe("/plan");
  });
});