import type { BudgetCategory } from "@/types/event-plan";
import type { VendorCategory } from "@/types/recommendation";

export const SIMULATED_PRICING_LABEL =
  "SIMULATED SCENARIO — NOT A SUPPLIER QUOTE";

export type PricingBaselineSource =
  | "suggestion_estimate"
  | "budget_estimate"
  | "budget_share_scenario";

export type SimulatedVendorPricing = {
  vendorId: string;
  category: VendorCategory;
  currency: string;
  baselineAmount: number;
  lowEstimate: number;
  typicalEstimate: number;
  highEstimate: number;
  baselineSource: PricingBaselineSource;
  basisDescription: string;
  provenanceLabel: typeof SIMULATED_PRICING_LABEL;
};

/**
 * Minimal planner view-model fields used by the pricing demonstration.
 * These fields do not imply that a vendor or price has been verified.
 */
export type VendorPricingVendor = {
  id: string;
  serviceCategory: string;
  estimatedCost?: number;
  currency?: string;
};

export type VendorPricingBudget = {
  currency: string;
  spendingLimit: number;
  items: Array<{
    category: string;
    estimatedAmount: number;
    costStatus: string;
  }>;
};

type SimulateVendorPricingInput = {
  vendor: VendorPricingVendor;
  budget: VendorPricingBudget;
  guestCount: number;
};

/**
 * Vendor categories mapped to existing budget categories.
 * These mappings select planning inputs; they do not verify suppliers.
 */
const VENDOR_CATEGORIES = new Set<string>([
  "venue",
  "catering",
  "decoration",
  "photography",
  "videography",
  "entertainment",
  "florist",
  "transportation",
  "rentals",
  "hair_and_makeup",
  "accommodation",
  "security",
  "accessibility",
  "other",
]);

function isVendorCategory(value: string): value is VendorCategory {
  return VENDOR_CATEGORIES.has(value);
}

const BUDGET_CATEGORY_MAP: Record<VendorCategory, BudgetCategory> = {
  venue: "venue",
  catering: "catering",
  decoration: "decoration",
  photography: "photography",
  videography: "photography",
  entertainment: "entertainment",
  florist: "decoration",
  transportation: "transportation",
  rentals: "equipment",
  hair_and_makeup: "attire",
  accommodation: "accommodation",
  security: "staffing",
  accessibility: "equipment",
  other: "other",
};

/**
 * Demonstration-only shares used when the existing plan has no
 * eligible estimate for a vendor category.
 *
 * These values are not derived from market research, currency
 * exchange rates, supplier data, or verified quotations.
 */
const DEMO_BUDGET_SHARES: Record<VendorCategory, number> = {
  venue: 0.18,
  catering: 0.28,
  decoration: 0.12,
  photography: 0.08,
  videography: 0.07,
  entertainment: 0.09,
  florist: 0.05,
  transportation: 0.08,
  rentals: 0.07,
  hair_and_makeup: 0.04,
  accommodation: 0.12,
  security: 0.035,
  accessibility: 0.03,
  other: 0.06,
};

const GUEST_SENSITIVE_CATEGORIES = new Set<VendorCategory>([
  "catering",
  "transportation",
  "accommodation",
]);

const ELIGIBLE_ESTIMATE_STATUSES = new Set([
  "planning_allocation",
  "ai_estimate",
  "market_estimate",
]);

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertValidInput({
  vendor,
  budget,
  guestCount,
}: SimulateVendorPricingInput): void {
  if (!vendor || typeof vendor.id !== "string" || !vendor.id.trim()) {
    throw new Error("A valid vendor suggestion is required.");
  }

  if (
    !Number.isSafeInteger(guestCount) ||
    guestCount < 1 ||
    guestCount > 100_000
  ) {
    throw new Error("Guest count must be an integer between 1 and 100000.");
  }

  if (
    !budget ||
    !Number.isFinite(budget.spendingLimit) ||
    budget.spendingLimit < 0 ||
    !Array.isArray(budget.items)
  ) {
    throw new Error("A valid event budget is required.");
  }

  if (
    vendor.estimatedCost !== undefined &&
    (
      !Number.isFinite(vendor.estimatedCost) ||
      vendor.estimatedCost < 0
    )
  ) {
    throw new Error("The vendor's planning estimate is invalid.");
  }
}

/**
 * Generate an illustrative range from an existing planning amount or
 * from a transparent budget-share scenario.
 *
 * This is deliberately not a market-price lookup. It does not query
 * a supplier, verify availability, change the event budget, or mutate
 * quotations, confirmed prices, or actual expense records.
 */
export function simulateVendorPricing(
  input: SimulateVendorPricingInput,
): SimulatedVendorPricing {
  assertValidInput(input);

  const { vendor, budget, guestCount } = input;

  if (!isVendorCategory(vendor.serviceCategory)) {
    throw new Error("The vendor category is not supported for pricing scenarios.");
  }

  const category = vendor.serviceCategory;
  let baselineAmount: number;
  let baselineSource: PricingBaselineSource;
  let basisDescription: string;

  // Use a suggestion estimate only when it is already in the plan's
  // currency. This adapter never performs currency conversion.
  if (
    vendor.estimatedCost !== undefined &&
    vendor.currency === budget.currency
  ) {
    baselineAmount = vendor.estimatedCost;
    baselineSource = "suggestion_estimate";
    basisDescription =
      "Baseline: the existing vendor-suggestion planning estimate in the event currency. It is not a supplier quote.";
  } else {
    const targetCategory = BUDGET_CATEGORY_MAP[category];

    // Use only estimates and planning allocations as a baseline.
    // Never derive a simulated baseline from a quotation, confirmed
    // amount, or actual expense.
    const eligibleItems = budget.items.filter(
      (item) =>
        item.category === targetCategory &&
        ELIGIBLE_ESTIMATE_STATUSES.has(item.costStatus),
    );

    if (eligibleItems.length > 0) {
      baselineAmount = roundMoney(
        eligibleItems.reduce(
          (total, item) => total + item.estimatedAmount,
          0,
        ),
      );
      baselineSource = "budget_estimate";
      basisDescription =
        "Baseline: the sum of existing estimated or planning-allocation items in this budget category. Quotes and actual expenses are excluded.";
    } else {
      const share = DEMO_BUDGET_SHARES[category];
      const guestScale = GUEST_SENSITIVE_CATEGORIES.has(category)
        ? guestCount / 40
        : 1;

      baselineAmount = roundMoney(
        budget.spendingLimit * share * guestScale,
      );
      baselineSource = "budget_share_scenario";
      basisDescription =
        `Demonstration-only baseline: ${(share * 100).toFixed(1)}% of the spending limit` +
        (
          GUEST_SENSITIVE_CATEGORIES.has(category)
            ? `, scaled from an illustrative 40-guest baseline to ${guestCount} guests.`
            : "."
        ) +
        " This allocation is not market data.";
    }
  }

  // Fixed scenario multipliers make the adapter deterministic.
  // The band illustrates uncertainty; it is not a confidence interval.
  return {
    vendorId: vendor.id,
    category: category,
    currency: budget.currency,
    baselineAmount: roundMoney(baselineAmount),
    lowEstimate: roundMoney(baselineAmount * 0.8),
    typicalEstimate: roundMoney(baselineAmount),
    highEstimate: roundMoney(baselineAmount * 1.25),
    baselineSource,
    basisDescription,
    provenanceLabel: SIMULATED_PRICING_LABEL,
  };
}