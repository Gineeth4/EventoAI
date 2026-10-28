import { describe, expect, it } from "vitest";

import type { BudgetPlan } from "@/types/event-plan";

import {
  reconcileBudgetItems,
} from "@/lib/budget-engine/reconcile-budget";

describe("reconcileBudgetItems", () => {
  it("preserves amounts and reports an over-budget result", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 1_000,
      contingencyPercent: 0,
      items: [
        {
          id: "venue-1",
          name: "Venue",
          category: "venue",
          estimatedAmount: 1_500,
          costStatus: "planning_allocation",
        },
      ],
    };

    const result = reconcileBudgetItems({
      budget: {
        currency: budget.currency,
        spendingLimit: budget.spendingLimit,
        contingencyPercent: budget.contingencyPercent,
      },
      items: budget.items,
    });

    expect(result.items[0]?.estimatedAmount).toBe(1_500);
    expect(result.summary.projectedTotal).toBe(1_500);
    expect(result.withinBudget).toBe(false);
    expect(result.overBudgetAmount).toBe(500);

    // The caller's input is not modified either.
    expect(budget.items[0]?.estimatedAmount).toBe(1_500);
  });

  it("preserves valid allocations when a budget is within the limit", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 1_000,
      contingencyPercent: 10,
      items: [
        {
          id: "decor-1",
          name: "Decorations",
          category: "decoration",
          estimatedAmount: 500,
          costStatus: "planning_allocation",
        },
      ],
    };

    const result = reconcileBudgetItems({
      budget: {
        currency: budget.currency,
        spendingLimit: budget.spendingLimit,
        contingencyPercent: budget.contingencyPercent,
      },
      items: budget.items,
    });

    expect(result.items[0]?.estimatedAmount).toBe(500);
    expect(result.summary.estimatedSubtotal).toBe(500);
    expect(result.summary.contingencyReserve).toBe(50);
    expect(result.summary.projectedTotal).toBe(550);
    expect(result.summary.remainingBudget).toBe(450);
    expect(result.withinBudget).toBe(true);
    expect(result.overBudgetAmount).toBe(0);
  });

  it("does not overwrite a quotation when reporting budget feasibility", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 1_000,
      contingencyPercent: 0,
      items: [
        {
          id: "catering-1",
          name: "Catering",
          category: "catering",
          estimatedAmount: 400,
          quotedAmount: 1_200,
          costStatus: "vendor_quote",
        },
      ],
    };

    const result = reconcileBudgetItems({
      budget: {
        currency: budget.currency,
        spendingLimit: budget.spendingLimit,
        contingencyPercent: budget.contingencyPercent,
      },
      items: budget.items,
    });

    expect(result.items[0]?.estimatedAmount).toBe(400);
    expect(result.items[0]?.quotedAmount).toBe(1_200);
    expect(result.summary.projectedTotal).toBe(1_200);
    expect(result.withinBudget).toBe(false);
    expect(result.overBudgetAmount).toBe(200);
  });
});