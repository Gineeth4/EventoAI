/**
 * EventoAI — Deterministic Budget Calculation Engine.
 *
 * This module performs financial calculations using TypeScript.
 * It does not ask the AI model to calculate totals.
 *
 * Cost basis:
 * - planning_allocation: use the budget-based allocated amount.
 * - actual: use the recorded actual amount.
 * - vendor_quote / confirmed: use the quoted amount.
 * - ai_estimate / market_estimate: use the estimated amount.
 *
 * Quoted and actual values remain separate from the original estimate
 * so the application can preserve cost provenance.
 */

import type {
  BudgetCategory,
  BudgetItem,
  BudgetPlan,
  BudgetSummary,
} from "@/types/event-plan";

import {
  BUDGET_CATEGORIES,
} from "@/types/event-plan";

import {
  budgetPlanDraftSchema,
  budgetSummarySchema,
} from "@/lib/validation/budget";

/** Match the maximum supported amount in the financial schemas. */
const MAX_SUPPORTED_AMOUNT = 1_000_000_000;

/**
 * Round a monetary value to two decimal places.
 *
 * This matches the current financial schemas. Currency-specific minor
 * unit handling can be introduced in the internationalization phase.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("A monetary value must be finite.");
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Ensure a computed value fits within the supported financial range.
 */
function assertSupportedAmount(
  value: number,
  description: string,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_SUPPORTED_AMOUNT
  ) {
    throw new RangeError(
      `${description} exceeds EventoAI's supported financial range.`,
    );
  }
}

/**
 * Return the active amount used for planning an individual expense.
 *
 * A recorded actual amount or vendor quote takes precedence over the
 * original allocation or estimate when its status is selected.
 */
export function getPlanningAmount(
  item: BudgetItem,
): number {
  switch (item.costStatus) {
    case "actual":
      return roundMoney(
        item.actualAmount ?? item.estimatedAmount,
      );

    case "vendor_quote":
    case "confirmed":
      return roundMoney(
        item.quotedAmount ?? item.estimatedAmount,
      );

    case "planning_allocation":
    case "ai_estimate":
    case "market_estimate":
    default:
      return roundMoney(item.estimatedAmount);
  }
}

/**
 * Calculate the current budget summary.
 *
 * estimatedSubtotal is retained as the existing API field name.
 * It represents the total of the active amounts selected by costStatus.
 */
export function calculateBudgetSummary(
  input: BudgetPlan,
): BudgetSummary {
  const budget = budgetPlanDraftSchema.parse(input);

  const categoryAmounts = new Map<
    BudgetCategory,
    { amount: number; itemCount: number }
  >();

  let subtotal = 0;

  for (const item of budget.items) {
    const amount = getPlanningAmount(item);

    assertSupportedAmount(
      amount,
      `Budget item "${item.name}"`,
    );

    subtotal += amount;

    const currentCategory = categoryAmounts.get(item.category);

    if (currentCategory) {
      currentCategory.amount += amount;
      currentCategory.itemCount += 1;
    } else {
      categoryAmounts.set(item.category, {
        amount,
        itemCount: 1,
      });
    }
  }

  subtotal = roundMoney(subtotal);

  assertSupportedAmount(
    subtotal,
    "The planned expense subtotal",
  );

  const contingencyReserve = roundMoney(
    subtotal * (budget.contingencyPercent / 100),
  );

  assertSupportedAmount(
    contingencyReserve,
    "The contingency reserve",
  );

  const projectedTotal = roundMoney(
    subtotal + contingencyReserve,
  );

  assertSupportedAmount(
    projectedTotal,
    "The projected event total",
  );

  const remainingBudget = roundMoney(
    budget.spendingLimit - projectedTotal,
  );

  const overBudgetAmount = roundMoney(
    Math.max(0, projectedTotal - budget.spendingLimit),
  );

  const isWithinBudget = overBudgetAmount === 0;

  const byCategory = BUDGET_CATEGORIES
    .filter((category) => categoryAmounts.has(category))
    .map((category) => {
      const entry = categoryAmounts.get(category)!;

      return {
        category,
        amount: roundMoney(entry.amount),
        itemCount: entry.itemCount,
      };
    });

  const summary: BudgetSummary = {
    currency: budget.currency,
    spendingLimit: roundMoney(budget.spendingLimit),
    estimatedSubtotal: subtotal,
    contingencyReserve,
    projectedTotal,
    remainingBudget,
    overBudgetAmount,
    isWithinBudget,
    byCategory,
  };

  return budgetSummarySchema.parse(summary);
}