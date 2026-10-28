/**
 * EventoAI — Budget reconciliation.
 *
 * Reconciliation calculates and reports budget feasibility.
 * It never silently alters an expense to force the plan under budget.
 */

import type {
  BudgetItem,
  BudgetPlan,
  BudgetSummary,
} from "@/types/event-plan";

import {
  calculateBudgetSummary,
} from "@/lib/budget-engine/calculate-budget";

export type ReconciliationResult = {
  /** Original item amounts, preserved without modification. */
  items: BudgetItem[];

  /** Summary calculated from the preserved amounts. */
  summary: BudgetSummary;

  /** True only when the projected total fits the spending limit. */
  withinBudget: boolean;

  /** Positive amount by which the projection exceeds the limit. */
  overBudgetAmount: number;
};

export function reconcileBudgetItems(input: {
  budget: Omit<BudgetPlan, "items">;
  items: BudgetItem[];
}): ReconciliationResult {
  // Copy items so the caller's objects are not modified.
  const items = input.items.map((item) => ({ ...item }));

  const summary = calculateBudgetSummary({
    ...input.budget,
    items,
  });

  return {
    items,
    summary,
    withinBudget: summary.isWithinBudget,
    overBudgetAmount: summary.overBudgetAmount,
  };
}