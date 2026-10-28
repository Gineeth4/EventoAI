/**
 * Tests for EventoAI's deterministic budget engine.
 */

import { describe, expect, it } from "vitest";

import type { BudgetPlan } from "@/types/event-plan";

import {
  calculateBudgetSummary,
  getPlanningAmount,
} from "@/lib/budget-engine/calculate-budget";

import {
  assessBudgetHealth,
  getBudgetWarnings,
} from "@/lib/budget-engine/validate-budget";

describe("calculateBudgetSummary", () => {
  it("calculates expense totals, contingency, and remaining budget", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 100_000,
      contingencyPercent: 10,
      items: [
        {
          id: "venue-1",
          name: "Venue",
          category: "venue",
          estimatedAmount: 50_000,
          costStatus: "ai_estimate",
        },
        {
          id: "catering-1",
          name: "Catering",
          category: "catering",
          estimatedAmount: 30_000,
          costStatus: "market_estimate",
        },
      ],
    };

    const summary = calculateBudgetSummary(budget);

    expect(summary.estimatedSubtotal).toBe(80_000);
    expect(summary.contingencyReserve).toBe(8_000);
    expect(summary.projectedTotal).toBe(88_000);
    expect(summary.remainingBudget).toBe(12_000);
    expect(summary.overBudgetAmount).toBe(0);
    expect(summary.isWithinBudget).toBe(true);

    expect(summary.byCategory).toContainEqual({
      category: "venue",
      amount: 50_000,
      itemCount: 1,
    });

    expect(summary.byCategory).toContainEqual({
      category: "catering",
      amount: 30_000,
      itemCount: 1,
    });
  });

  it("reports an over-budget plan without hiding the excess", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 50_000,
      contingencyPercent: 0,
      items: [
        {
          id: "venue-1",
          name: "Venue",
          category: "venue",
          estimatedAmount: 60_000,
          costStatus: "ai_estimate",
        },
      ],
    };

    const summary = calculateBudgetSummary(budget);

    expect(summary.isWithinBudget).toBe(false);
    expect(summary.remainingBudget).toBe(-10_000);
    expect(summary.overBudgetAmount).toBe(10_000);

    const health = assessBudgetHealth(summary);

    expect(health.status).toBe("over_budget");
    expect(health.message).toContain("10,000");
  });

  it("uses a vendor quote instead of adding it to the estimate", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 20_000,
      contingencyPercent: 0,
      items: [
        {
          id: "catering-quote",
          name: "Catering",
          category: "catering",
          estimatedAmount: 10_000,
          quotedAmount: 12_000,
          costStatus: "vendor_quote",
        },
      ],
    };

    expect(getPlanningAmount(budget.items[0])).toBe(12_000);

    const summary = calculateBudgetSummary(budget);

    // The ₹10,000 estimate and ₹12,000 quotation are alternatives
    // for the same expense, not two separate expenses.
    expect(summary.estimatedSubtotal).toBe(12_000);
  });

  it("warns when estimated costs are not yet supported by quotations", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 100_000,
      contingencyPercent: 0,
      items: [
        {
          id: "decor-1",
          name: "Decorations",
          category: "decoration",
          estimatedAmount: 20_000,
          costStatus: "ai_estimate",
        },
      ],
    };

    const summary = calculateBudgetSummary(budget);
    const warnings = getBudgetWarnings(budget, summary);

    expect(
      warnings.some(
        (warning) => warning.code === "unverified_estimates",
      ),
    ).toBe(true);

    expect(
      warnings.some(
        (warning) => warning.code === "no_contingency",
      ),
    ).toBe(true);
  });

  it("flags a plan that has reached the near-limit threshold", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 100_000,
      contingencyPercent: 0,
      items: [
        {
          id: "venue-1",
          name: "Venue",
          category: "venue",
          estimatedAmount: 95_000,
          costStatus: "ai_estimate",
        },
      ],
    };

    const summary = calculateBudgetSummary(budget);

    expect(assessBudgetHealth(summary).status).toBe("near_limit");
  });
});