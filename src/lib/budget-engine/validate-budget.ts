import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";
/**
 * EventoAI — Budget Validation and Budget Health.
 *
 * This module converts budget data into actionable validation results
 * and warnings that can be displayed to the user.
 *
 * Financial arithmetic remains in calculate-budget.ts.
 */

import type {
  BudgetPlan,
  BudgetSummary,
} from "@/types/event-plan";

import {
  budgetPlanDraftSchema,
} from "@/lib/validation/budget";

import type {
  ValidatedBudgetPlan,
} from "@/lib/validation/budget";

export type BudgetValidationIssue = {
  path: string;
  message: string;
};

export type BudgetPlanValidationResult =
  | {
      success: true;
      data: ValidatedBudgetPlan;
    }
  | {
      success: false;
      issues: BudgetValidationIssue[];
    };

export function validateBudgetPlan(
  input: unknown,
): BudgetPlanValidationResult {
  const result = budgetPlanDraftSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join(".") || "budget",
      message: issue.message,
    })),
  };
}

export type BudgetHealthStatus =
  | "within_budget"
  | "near_limit"
  | "over_budget";

export type BudgetHealthAssessment = {
  status: BudgetHealthStatus;
  spendingLimit: number;
  projectedTotal: number;
  remainingBudget: number;
  utilizationPercent: number | null;
  message: string;
};

function formatMoney(
  amount: number,
  currency: BudgetSummary["currency"],
): string {
  return formatCurrencyShared(amount, currency);
}

export function assessBudgetHealth(
  summary: BudgetSummary,
  warningThreshold = 0.9,
): BudgetHealthAssessment {
  if (
    !Number.isFinite(warningThreshold) ||
    warningThreshold <= 0 ||
    warningThreshold >= 1
  ) {
    throw new RangeError(
      "warningThreshold must be greater than 0 and less than 1.",
    );
  }

  const {
    spendingLimit,
    projectedTotal,
    remainingBudget,
    currency,
    overBudgetAmount,
  } = summary;

  let utilizationPercent: number | null = null;

  if (spendingLimit > 0) {
    utilizationPercent = Math.round(
      (projectedTotal / spendingLimit) * 10000,
    ) / 100;
  } else if (projectedTotal === 0) {
    utilizationPercent = 0;
  }

  if (overBudgetAmount > 0) {
    return {
      status: "over_budget",
      spendingLimit,
      projectedTotal,
      remainingBudget,
      utilizationPercent,
      message:
        `The projected event cost exceeds the budget by ` +
        `${formatMoney(overBudgetAmount, currency)}.`,
    };
  }

  if (
    spendingLimit > 0 &&
    projectedTotal / spendingLimit >= warningThreshold
  ) {
    return {
      status: "near_limit",
      spendingLimit,
      projectedTotal,
      remainingBudget,
      utilizationPercent,
      message:
        `The event is using ${utilizationPercent}% of its budget. ` +
        `${formatMoney(remainingBudget, currency)} remains.`,
    };
  }

  return {
    status: "within_budget",
    spendingLimit,
    projectedTotal,
    remainingBudget,
    utilizationPercent,
    message:
      `${formatMoney(remainingBudget, currency)} remains ` +
      `within the current spending limit.`,
  };
}

export type BudgetWarningSeverity =
  | "info"
  | "warning"
  | "critical";

export type BudgetWarning = {
  code:
    | "empty_budget"
    | "over_budget"
    | "near_limit"
    | "unverified_estimates"
    | "no_contingency";

  severity: BudgetWarningSeverity;
  message: string;
};

export function getBudgetWarnings(
  budget: BudgetPlan,
  summary: BudgetSummary,
  warningThreshold = 0.9,
): BudgetWarning[] {
  const warnings: BudgetWarning[] = [];

  if (budget.items.length === 0) {
    warnings.push({
      code: "empty_budget",
      severity: "warning",
      message:
        "No expenses have been added yet. Add the major event costs before relying on this budget.",
    });
  }

  const health = assessBudgetHealth(
    summary,
    warningThreshold,
  );

  if (health.status === "over_budget") {
    warnings.push({
      code: "over_budget",
      severity: "critical",
      message: health.message,
    });
  } else if (health.status === "near_limit") {
    warnings.push({
      code: "near_limit",
      severity: "warning",
      message: health.message,
    });
  }

  const planningAllocationCount = budget.items.filter(
    (item) => item.costStatus === "planning_allocation",
  ).length;

  const unverifiedEstimateCount = budget.items.filter(
    (item) =>
      item.costStatus === "ai_estimate" ||
      item.costStatus === "market_estimate",
  ).length;

  if (
    planningAllocationCount > 0 ||
    unverifiedEstimateCount > 0
  ) {
    const details: string[] = [];

    if (planningAllocationCount > 0) {
      details.push(
        `${planningAllocationCount} item(s) are deterministic allocations of the available budget, not researched prices`,
      );
    }

    if (unverifiedEstimateCount > 0) {
      details.push(
        `${unverifiedEstimateCount} item(s) use AI or market estimates that have not been confirmed by a vendor`,
      );
    }

    warnings.push({
      code: "unverified_estimates",
      severity: "info",
      message:
        `${details.join("; ")}. These amounts are not verified quotations. ` +
        "Check local prices and confirm important costs before making commitments.",
    });
  }

  if (
    budget.items.length > 0 &&
    budget.contingencyPercent === 0
  ) {
    warnings.push({
      code: "no_contingency",
      severity: "warning",
      message:
        "No contingency reserve is allocated. Consider setting aside funds for unexpected expenses.",
    });
  }

  return warnings;
}