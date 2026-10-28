/**
 * EventoAI — Budget validation
 *
 * These schemas validate financial data. They do not perform the
 * actual budget calculations; those will live in budget-engine.
 */

import { z } from "zod";

import { CURRENCY_CODES } from "@/types/event";

import {
  BUDGET_CATEGORIES,
  COST_STATUSES,
} from "@/types/event-plan";

/** All money values must be finite, non-negative and bounded. */
export const moneyAmountSchema = z
  .number()
  .min(0)
  .max(1_000_000_000);

/** Contingency reserve as a percentage of planned expenses. */
export const contingencyPercentSchema = z
  .number()
  .min(0)
  .max(50);

/** Validate one budget line item. */
export const budgetItemDraftSchema = z
  .object({
    id: z.string().trim().min(1).max(80),

    name: z.string().trim().min(1).max(160),

    category: z.enum(BUDGET_CATEGORIES),

    description: z
      .string()
      .trim()
      .max(1000)
      .optional(),

    estimatedAmount: moneyAmountSchema,

    quotedAmount: moneyAmountSchema.optional(),

    actualAmount: moneyAmountSchema.optional(),

    costStatus: z.enum(COST_STATUSES),

    sourceName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    sourceUrl: z
      .string()
      .url()
      .max(2048)
      .optional(),

    notes: z
      .string()
      .trim()
      .max(1000)
      .optional(),
  })
  .strict()
  .superRefine((item, context) => {
    // An actual expense must contain the amount that was spent.
    if (
      item.costStatus === "actual" &&
      item.actualAmount === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["actualAmount"],
        message: "An actual expense requires an actual amount.",
      });
    }

    // Quoted or confirmed prices must not be confused with estimates.
    if (
      (item.costStatus === "vendor_quote" ||
        item.costStatus === "confirmed") &&
      item.quotedAmount === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["quotedAmount"],
        message:
          "A quoted or confirmed expense requires a quoted amount.",
      });
    }
  });

/** Validate the full budget configuration for a proposed plan. */
export const budgetPlanDraftSchema = z
  .object({
    currency: z.enum(CURRENCY_CODES),

    spendingLimit: moneyAmountSchema,

    contingencyPercent: contingencyPercentSchema,

    items: z
      .array(budgetItemDraftSchema)
      .max(250),
  })
  .strict()
  .superRefine((budget, context) => {
    // Repeated IDs can make editing and expense tracking unreliable.
    const seenIds = new Set<string>();

    budget.items.forEach((item, index) => {
      if (seenIds.has(item.id)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "id"],
          message: "Budget item IDs must be unique.",
        });
      }

      seenIds.add(item.id);
    });
  });

/** Validated representation of a categorized budget total. */
const budgetCategoryTotalSchema = z
  .object({
    category: z.enum(BUDGET_CATEGORIES),
    amount: moneyAmountSchema,
    itemCount: z.number().int().min(0).max(250),
  })
  .strict();

/**
 * Summary produced by the deterministic budget engine.
 *
 * remainingBudget is allowed to be negative because an over-budget
 * result must be representable and clearly displayed to the user.
 */
export const budgetSummarySchema = z
  .object({
    currency: z.enum(CURRENCY_CODES),

    spendingLimit: moneyAmountSchema,

    estimatedSubtotal: moneyAmountSchema,

    contingencyReserve: moneyAmountSchema,

    projectedTotal: moneyAmountSchema,

    remainingBudget: z
      .number()
      .min(-1_000_000_000)
      .max(1_000_000_000),

    overBudgetAmount: moneyAmountSchema,

    isWithinBudget: z.boolean(),

    byCategory: z
      .array(budgetCategoryTotalSchema)
      .max(BUDGET_CATEGORIES.length),
  })
  .strict()
  .superRefine((summary, context) => {
    // Check that the projected total agrees with its two components.
    const expectedProjectedTotal =
      summary.estimatedSubtotal + summary.contingencyReserve;

    if (
      Math.abs(
        summary.projectedTotal - expectedProjectedTotal,
      ) > 0.01
    ) {
      context.addIssue({
        code: "custom",
        path: ["projectedTotal"],
        message:
          "Projected total must equal expenses plus contingency reserve.",
      });
    }

    // Remaining funds must match the spending limit minus projected costs.
    const expectedRemaining =
      summary.spendingLimit - summary.projectedTotal;

    if (
      Math.abs(
        summary.remainingBudget - expectedRemaining,
      ) > 0.01
    ) {
      context.addIssue({
        code: "custom",
        path: ["remainingBudget"],
        message:
          "Remaining budget does not match the projected total.",
      });
    }

    // The over-budget amount must never be negative.
    const expectedOverBudget = Math.max(
      0,
      summary.projectedTotal - summary.spendingLimit,
    );

    if (
      Math.abs(
        summary.overBudgetAmount - expectedOverBudget,
      ) > 0.01
    ) {
      context.addIssue({
        code: "custom",
        path: ["overBudgetAmount"],
        message:
          "Over-budget amount is inconsistent with the spending limit.",
      });
    }

    // Check the budget status independently of the supplied boolean.
    const expectedWithinBudget =
      summary.projectedTotal <= summary.spendingLimit + 0.01;

    if (summary.isWithinBudget !== expectedWithinBudget) {
      context.addIssue({
        code: "custom",
        path: ["isWithinBudget"],
        message:
          "Budget status does not match the calculated totals.",
      });
    }
  });

/** Export convenient TypeScript types inferred from the schemas. */
export type ValidatedBudgetItem = z.infer<
  typeof budgetItemDraftSchema
>;

export type ValidatedBudgetPlan = z.infer<
  typeof budgetPlanDraftSchema
>;

export type ValidatedBudgetSummary = z.infer<
  typeof budgetSummarySchema
>;