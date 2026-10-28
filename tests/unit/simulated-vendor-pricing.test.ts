import { describe, expect, it } from "vitest";

import type { BudgetPlan } from "@/types/event-plan";
import type { VendorSuggestion } from "@/types/recommendation";

import {
  SIMULATED_PRICING_LABEL,
  simulateVendorPricing,
} from "@/lib/vendor-pricing/simulated-vendor-pricing";

function createBudget(): BudgetPlan {
  return {
    currency: "INR",
    spendingLimit: 20_000,
    contingencyPercent: 10,
    items: [
      {
        id: "catering-estimate",
        name: "Catering planning estimate",
        category: "catering",
        estimatedAmount: 4_000,
        costStatus: "ai_estimate",
      },
      {
        id: "venue-quote",
        name: "Venue quotation",
        category: "venue",
        estimatedAmount: 3_000,
        quotedAmount: 3_500,
        costStatus: "vendor_quote",
      },
      {
        id: "photo-actual",
        name: "Photography actual expense",
        category: "photography",
        estimatedAmount: 2_000,
        actualAmount: 2_200,
        costStatus: "actual",
      },
    ],
  };
}

function createVendor(
  overrides: Partial<VendorSuggestion> = {},
): VendorSuggestion {
  return {
    id: "vendor-catering-example",
    serviceCategory: "catering",
    displayName: "Catering service category",
    description: "Example service category for tests.",
    whyItFits: "This is a test fixture, not a real supplier.",
    sourceStatus: "illustrative",
    ...overrides,
  };
}

describe("simulated vendor pricing adapter", () => {
  it("generates the same clearly labelled range for the same input", () => {
    const input = {
      vendor: createVendor({
        estimatedCost: 10_000,
        currency: "INR",
      }),
      budget: createBudget(),
      guestCount: 40,
    };

    const first = simulateVendorPricing(input);
    const second = simulateVendorPricing(input);

    expect(first).toEqual(second);
    expect(first.lowEstimate).toBe(8_000);
    expect(first.typicalEstimate).toBe(10_000);
    expect(first.highEstimate).toBe(12_500);
    expect(first.baselineSource).toBe("suggestion_estimate");
    expect(first.provenanceLabel).toBe(SIMULATED_PRICING_LABEL);
  });

  it("uses eligible category estimates when the suggestion currency differs", () => {
    const result = simulateVendorPricing({
      vendor: createVendor({
        estimatedCost: 999,
        currency: "USD",
      }),
      budget: createBudget(),
      guestCount: 40,
    });

    expect(result.currency).toBe("INR");
    expect(result.baselineSource).toBe("budget_estimate");
    expect(result.baselineAmount).toBe(4_000);
    expect(result.lowEstimate).toBe(3_200);
    expect(result.highEstimate).toBe(5_000);
  });

  it("does not use vendor quotes or actual expenses as a baseline", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 20_000,
      contingencyPercent: 10,
      items: [
        {
          id: "venue-quote",
          name: "Venue quotation",
          category: "venue",
          estimatedAmount: 3_000,
          quotedAmount: 3_500,
          costStatus: "vendor_quote",
        },
        {
          id: "venue-actual",
          name: "Venue actual expense",
          category: "venue",
          estimatedAmount: 3_000,
          actualAmount: 3_800,
          costStatus: "actual",
        },
      ],
    };

    const result = simulateVendorPricing({
      vendor: createVendor({
        serviceCategory: "venue",
      }),
      budget,
      guestCount: 40,
    });

    // The fallback is the demo share of the spending limit (18%),
    // not either of the existing quote or actual-expense values.
    expect(result.baselineSource).toBe("budget_share_scenario");
    expect(result.baselineAmount).toBe(3_600);
    expect(result.baselineAmount).not.toBe(3_500);
    expect(result.baselineAmount).not.toBe(3_800);
  });

  it("scales the fallback scenario for guest-sensitive categories", () => {
    const budget: BudgetPlan = {
      ...createBudget(),
      items: [],
    };

    const baseResult = simulateVendorPricing({
      vendor: createVendor(),
      budget,
      guestCount: 40,
    });

    const scaledResult = simulateVendorPricing({
      vendor: createVendor(),
      budget,
      guestCount: 60,
    });

    // Catering uses the 28% illustrative share of the spending limit.
    // With no eligible estimate, the baseline scales from 40 to 60 guests.
    expect(baseResult.baselineSource).toBe("budget_share_scenario");
    expect(baseResult.baselineAmount).toBe(5_600);

    expect(scaledResult.baselineSource).toBe("budget_share_scenario");
    expect(scaledResult.baselineAmount).toBe(8_400);
    expect(scaledResult.baselineAmount).toBe(
      baseResult.baselineAmount * 1.5,
    );

    expect(scaledResult.lowEstimate).toBe(6_720);
    expect(scaledResult.highEstimate).toBe(10_500);
  });

  it("rejects invalid guest counts instead of silently guessing", () => {
    expect(() =>
      simulateVendorPricing({
        vendor: createVendor(),
        budget: createBudget(),
        guestCount: 0,
      }),
    ).toThrow(/Guest count/);
  });

  it("rejects a negative planning estimate", () => {
    expect(() =>
      simulateVendorPricing({
        vendor: createVendor({
          estimatedCost: -10,
          currency: "INR",
        }),
        budget: createBudget(),
        guestCount: 40,
      }),
    ).toThrow(/planning estimate is invalid/);
  });
});