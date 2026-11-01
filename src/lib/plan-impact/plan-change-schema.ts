import { z } from "zod";

import type { EventInput } from "@/types/event";
import type {
  BudgetCategory,
  BudgetSummary,
  EventPlan,
} from "@/types/event-plan";

import {
  dateOnlySchema,
  eventInputSchema,
  eventLocationSchema,
} from "@/lib/validation/event-input";

import {
  eventPlanSchema,
} from "@/lib/validation/event-plan";
/* =========================================================
   1. CHANGE REQUEST VALIDATION
   ========================================================= */

/**
 * Every change is explicit and typed.
 *
 * A caller cannot request an arbitrary field mutation. It must
 * select one of these supported operations.
 */
export const planChangeSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("guest_count"),
      value: z.number().int().min(1).max(100_000),
    })
    .strict(),

  z
    .object({
      kind: z.literal("budget"),
      value: z.number().min(0).max(1_000_000_000),
    })
    .strict(),

  z
    .object({
      kind: z.literal("event_date"),
      value: dateOnlySchema,
    })
    .strict(),

  z
    .object({
      kind: z.literal("location"),
      value: eventLocationSchema,
    })
    .strict(),
]);

export type PlanChange = z.infer<typeof planChangeSchema>;

/**
 * Optional per-guest cost information.
 *
 * Keys are budget item IDs. Values are the marginal cost for each
 * additional guest, expressed in the event's existing currency.
 *
 * These rates must come from explicit user input or a suitable
 * cost source. The engine must not invent them.
 */
const guestUnitCostsSchema = z
  .record(
    z.string().trim().min(1),
    z.number().min(0).max(1_000_000_000),
  )
  .optional();

/** Complete input required for an impact assessment. */
export const assessPlanChangeInputSchema = z
  .object({
    currentEvent: eventInputSchema,
    currentPlan: eventPlanSchema,
    change: planChangeSchema,
    guestUnitCosts: guestUnitCostsSchema,
  })
  .strict();

export type AssessPlanChangeInput = z.input<
  typeof assessPlanChangeInputSchema
>;

/* =========================================================
   2. IMPACT RESULT TYPES
   ========================================================= */

export type PlanImpactSeverity =
  | "info"
  | "warning"
  | "critical";

export type PlanImpactArea =
  | "budget"
  | "guest_count"
  | "timeline"
  | "location"
  | "vendors"
  | "logistics";

export type PlanImpactNotice = {
  area: PlanImpactArea;
  severity: PlanImpactSeverity;
  title: string;
  message: string;
};

/** A budget line that changed or needs human review. */
export type AffectedBudgetItem = {
  itemId: string;
  name: string;
  category: BudgetCategory;

  /** Active cost before the proposed change. */
  previousAmount: number;

  /** Active cost after the proposed change. */
  proposedAmount: number;

  /** True only when the proposed estimate was recalculated. */
  updated: boolean;

  /** Explains why the item changed or why review is needed. */
  reason: string;
};

/** Complete preview returned to the future Plan Impact UI. */
export type PlanImpactAssessment = {
  change: PlanChange;

  /** Original event supplied to the assessment. */
  currentEvent: EventInput;

  /** Proposed event details. These have not been saved. */
  proposedEvent: EventInput;

  /** Proposed plan. These changes have not been saved. */
  proposedPlan: EventPlan;

  currentBudget: BudgetSummary;
  proposedBudget: BudgetSummary;

  /** Change in projected event expenses. */
  projectedCostChange: number;

  /** Change in remaining funds, including a changed spending limit. */
  remainingBudgetChange: number;

  affectedBudgetItems: AffectedBudgetItem[];

  /** Number of task dates shifted by a date change. */
  tasksRescheduled: number;

  /** Items or arrangements that need confirmation before acceptance. */
  reviewRequiredItems: string[];

  /** Human-readable summary of the impact. */
  impacts: PlanImpactNotice[];

  /** Whether the change should be reviewed before being applied. */
  requiresReview: boolean;
};
