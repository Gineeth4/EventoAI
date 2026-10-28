/**
 * EventoAI — Plan quality gate.
 *
 * Checks plan structure, recommendation quality, IDs, and consistency
 * between the plan's budget and its supplied financial summary.
 */

import type {
  BudgetSummary,
  EventPlan,
} from "@/types/event-plan";

import {
  calculateBudgetSummary,
} from "@/lib/budget-engine/calculate-budget";

import {
  eventPlanSchema,
} from "@/lib/validation/event-plan";

function nearlyEqualMoney(
  left: number,
  right: number,
): boolean {
  return (
    Number.isFinite(left) &&
    Number.isFinite(right) &&
    Math.abs(left - right) < 0.01
  );
}

function summariesMatch(
  supplied: BudgetSummary,
  calculated: BudgetSummary,
): boolean {
  if (supplied.currency !== calculated.currency) {
    return false;
  }

  const numericFields: (keyof BudgetSummary)[] = [
    "spendingLimit",
    "estimatedSubtotal",
    "contingencyReserve",
    "projectedTotal",
    "remainingBudget",
    "overBudgetAmount",
  ];

  for (const field of numericFields) {
    const suppliedValue = supplied[field];
    const calculatedValue = calculated[field];

    if (
      typeof suppliedValue !== "number" ||
      typeof calculatedValue !== "number" ||
      !nearlyEqualMoney(suppliedValue, calculatedValue)
    ) {
      return false;
    }
  }

  if (supplied.isWithinBudget !== calculated.isWithinBudget) {
    return false;
  }

  // Category totals are also part of the dashboard contract.
  if (
    JSON.stringify(supplied.byCategory) !==
    JSON.stringify(calculated.byCategory)
  ) {
    return false;
  }

  return true;
}

export function validatePlanQuality(
  plan: EventPlan,
  budgetSummary: BudgetSummary,
): string[] {
  const issues: string[] = [];

  const schemaResult = eventPlanSchema.safeParse(plan);

  if (!schemaResult.success) {
    issues.push("PLAN_SCHEMA_INVALID");
    return issues;
  }

  if (!plan.summary.trim()) {
    issues.push("PLAN_SUMMARY_EMPTY");
  }

  if (plan.tasks.length === 0) {
    issues.push("PLAN_TIMELINE_EMPTY");
  }

  if (plan.budget.items.length === 0) {
    issues.push("PLAN_BUDGET_EMPTY");
  }

  if (plan.recommendations.length === 0) {
    issues.push("PLAN_RECOMMENDATIONS_EMPTY");
  }

  if (
    plan.budget.items.some(
      (item) =>
        !Number.isFinite(item.estimatedAmount) ||
        item.estimatedAmount < 0,
    )
  ) {
    issues.push("PLAN_BUDGET_AMOUNT_INVALID");
  }

  const budgetItemIds = plan.budget.items.map((item) => item.id);

  if (new Set(budgetItemIds).size !== budgetItemIds.length) {
    issues.push("PLAN_DUPLICATE_BUDGET_ITEM_IDS");
  }

  const recommendationTitles = plan.recommendations.map(
    (item) => item.title.trim().toLowerCase(),
  );

  if (
    new Set(recommendationTitles).size !==
    recommendationTitles.length
  ) {
    issues.push("PLAN_DUPLICATE_RECOMMENDATIONS");
  }

  let calculatedSummary: BudgetSummary;

  try {
    calculatedSummary = calculateBudgetSummary(plan.budget);
  } catch {
    issues.push("PLAN_BUDGET_CALCULATION_FAILED");
    return issues;
  }

  if (!summariesMatch(budgetSummary, calculatedSummary)) {
    issues.push("PLAN_BUDGET_SUMMARY_MISMATCH");
  }

  if (
    calculatedSummary.projectedTotal >
      plan.budget.spendingLimit
  ) {
    issues.push("PLAN_BUDGET_LIMIT_EXCEEDED");
  }

  return issues;
}