import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/lib/format-currency";

describe("shared currency formatter", () => {
  it("formats Indian rupees correctly", () => {
    const result = formatCurrency(10000, "INR", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    expect(result).toContain("\u20B9");
    expect(result).toContain("10,000");
  });

  it("formats pounds and euros using their selected currencies", () => {
    expect(formatCurrency(200, "GBP")).toContain("\u00A3");
    expect(formatCurrency(250, "EUR")).toContain("\u20AC");
  });

  it("supports Indian digit grouping without decimal places", () => {
    const result = formatCurrency(100000, "INR", {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    expect(result).toContain("1,00,000");
  });

  it("provides a readable fallback for invalid currency codes", () => {
    const result = formatCurrency(1000, "not-a-code");
    expect(result).toContain("NOT-A-CODE");
    expect(result).toContain("1,000");
  });

  it("rejects non-finite amounts", () => {
    expect(formatCurrency(Number.NaN, "INR")).toBe("Not available");
    expect(formatCurrency(Number.POSITIVE_INFINITY, "USD")).toBe("Not available");
  });
});
