import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";
/**
 * EventoAI — Plan Impact Assessment Engine
 *
 * Previews the effects of changing an existing event plan.
 *
 * Supported changes:
 * - Guest count
 * - Spending limit
 * - Event date
 * - Event location
 *
 * This engine does not save or approve changes.
 *
 * Financial estimates are changed automatically only when an explicit
 * per-guest cost is supplied for an eligible estimated budget item.
 * Confirmed prices, vendor quotations, and actual expenses are never
 * silently changed.
 */

import { z } from "zod";

import type {
  Currency,
  EventInput,
  EventLocation,
} from "@/types/event";

import type {
  BudgetCategory,
  BudgetItem,
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

import {
  calculateBudgetSummary,
  getPlanningAmount,
  roundMoney,
} from "@/lib/budget-engine/calculate-budget";

import {
  validateTimeline,
} from "@/lib/timeline-engine/validate-timeline";

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
const assessPlanChangeInputSchema = z
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

/* =========================================================
   3. CONSTANTS AND DATE HELPERS
   ========================================================= */

/**
 * Expenses whose cost may depend on the number of guests.
 *
 * These categories are candidates for recalculation, not a promise
 * that every item in the category scales proportionally.
 */
const GUEST_SENSITIVE_CATEGORIES = new Set<BudgetCategory>([
  "catering",
  "invitations",
  "transportation",
  "accommodation",
  "staffing",
  "equipment",
  "miscellaneous",
  "other",
]);

/** Location changes can affect these expenses and arrangements. */
const LOCATION_SENSITIVE_CATEGORIES = new Set<BudgetCategory>([
  "venue",
  "catering",
  "transportation",
  "accommodation",
  "equipment",
  "permits",
  "staffing",
  "miscellaneous",
  "other",
]);

const ESTIMATE_STATUSES = new Set([
  "ai_estimate",
  "market_estimate",
]);

const MAX_SUPPORTED_AMOUNT = 1_000_000_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Format a monetary value using the event's currency. */
function formatMoney(
  amount: number,
  currency: Currency,
): string {
  return formatCurrencyShared(amount, currency);
}

/** Convert a date-only value into a UTC calendar date. */
function parseDateOnly(value: string): Date {
  return new Date(`${dateOnlySchema.parse(value)}T00:00:00.000Z`);
}

/** Return the calendar-day difference between two date-only values. */
function differenceInCalendarDays(
  from: string,
  to: string,
): number {
  const fromTime = parseDateOnly(from).getTime();
  const toTime = parseDateOnly(to).getTime();

  return Math.round(
    (toTime - fromTime) / MILLISECONDS_PER_DAY,
  );
}

/** Shift a date-only value by a number of calendar days. */
function shiftDate(
  value: string,
  days: number,
): string {
  const shifted = parseDateOnly(value);

  shifted.setUTCDate(shifted.getUTCDate() + days);

  return dateOnlySchema.parse(
    shifted.toISOString().slice(0, 10),
  );
}

/** Format a human-readable location without making assumptions. */
function formatLocation(
  location?: EventLocation,
): string {
  if (!location) {
    return "Not specified";
  }

  const parts = [
    location.venueName,
    location.city,
    location.region,
    location.country,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0
    ? parts.join(", ")
    : "Not specified";
}

/** Add a review item only once. */
function addReviewItem(
  items: string[],
  value: string,
): void {
  if (!items.includes(value)) {
    items.push(value);
  }
}

/** Add a structured, readable impact message. */
function addImpact(
  impacts: PlanImpactNotice[],
  impact: PlanImpactNotice,
): void {
  impacts.push(impact);
}

/* =========================================================
   4. PROPOSED PLAN HELPERS
   ========================================================= */

/**
 * Validate all supplied guest rates.
 *
 * We reject unknown IDs and rates attached to fixed-cost categories.
 * This avoids accidentally applying a per-person rate to an unrelated
 * expense such as a fixed venue rental.
 */
function validateGuestUnitCosts(
  plan: EventPlan,
  rates: Record<string, number> | undefined,
): void {
  if (!rates) {
    return;
  }

  const itemsById = new Map(
    plan.budget.items.map((item) => [item.id, item]),
  );

  for (const itemId of Object.keys(rates)) {
    const item = itemsById.get(itemId);

    if (!item) {
      throw new Error(
        `Guest unit cost references unknown budget item "${itemId}".`,
      );
    }

    if (!GUEST_SENSITIVE_CATEGORIES.has(item.category)) {
      throw new Error(
        `Budget item "${item.name}" is not configured as guest-sensitive.`,
      );
    }
  }
}

/** Calculate the active cost represented by a budget item. */
function activeCost(item: BudgetItem): number {
  return getPlanningAmount(item);
}

/**
 * Assess a guest-count change.
 *
 * Only estimated items with explicitly supplied per-guest rates
 * have their estimatedAmount adjusted.
 *
 * Vendor quotes, confirmed costs, and actual amounts remain unchanged
 * and are marked for review.
 */
function applyGuestCountChange(
  plan: EventPlan,
  previousGuestCount: number,
  proposedGuestCount: number,
  unitCosts: Record<string, number> | undefined,
  affectedItems: AffectedBudgetItem[],
  reviewRequiredItems: string[],
  impacts: PlanImpactNotice[],
): void {
  const guestDelta = proposedGuestCount - previousGuestCount;

  if (guestDelta === 0) {
    addImpact(impacts, {
      area: "guest_count",
      severity: "info",
      title: "Guest count unchanged",
      message:
        "The proposed guest count is the same as the current count. No guest-related costs need to be recalculated.",
    });

    return;
  }

  const direction =
    guestDelta > 0 ? "increased" : "decreased";

  const guestMagnitude = Math.abs(guestDelta);

  const changedItems: string[] = [];
  const reviewItems: string[] = [];

  plan.budget.items = plan.budget.items.map((item) => {
    if (!GUEST_SENSITIVE_CATEGORIES.has(item.category)) {
      return item;
    }

    const previousAmount = activeCost(item);
    const unitCost = unitCosts?.[item.id];

    const isEstimate = ESTIMATE_STATUSES.has(item.costStatus);

    // Explicit rate + an estimate = a permitted deterministic update.
    if (unitCost !== undefined && isEstimate) {
      const proposedAmount = roundMoney(
        Math.max(
          0,
          item.estimatedAmount + guestDelta * unitCost,
        ),
      );

      if (
        !Number.isFinite(proposedAmount) ||
        proposedAmount > MAX_SUPPORTED_AMOUNT
      ) {
        throw new RangeError(
          `Revised cost for "${item.name}" exceeds the supported range.`,
        );
      }

      const updatedItem: BudgetItem = {
        ...item,
        estimatedAmount: proposedAmount,
      };

      const newActiveAmount = activeCost(updatedItem);

      affectedItems.push({
        itemId: item.id,
        name: item.name,
        category: item.category,
        previousAmount,
        proposedAmount: newActiveAmount,
        updated: newActiveAmount !== previousAmount,
        reason:
          `Estimate adjusted by ${formatMoney(
            roundMoney(guestDelta * unitCost),
            plan.budget.currency,
          )} using the supplied marginal rate of ` +
          `${formatMoney(unitCost, plan.budget.currency)} per guest.`,
      });

      changedItems.push(item.name);

      return updatedItem;
    }

    // Do not silently alter quoted, confirmed, or actual costs.
    let reason: string;

    if (!isEstimate) {
      reason =
        "This item contains a vendor quote, confirmed price, or actual cost. Reconfirm it with the provider.";
    } else {
      reason =
        "No explicit per-guest cost was supplied. Review this estimate before accepting the plan.";
    }

    affectedItems.push({
      itemId: item.id,
      name: item.name,
      category: item.category,
      previousAmount,
      proposedAmount: previousAmount,
      updated: false,
      reason,
    });

    const reviewMessage = `${item.name}: ${reason}`;

    reviewItems.push(item.name);
    addReviewItem(reviewRequiredItems, reviewMessage);

    return item;
  });

  if (affectedItems.length === 0) {
    const message =
      "No guest-sensitive budget items were available to recalculate. Review catering, seating, transport, and any other expenses that may depend on guest count.";

    addReviewItem(reviewRequiredItems, message);

    addImpact(impacts, {
      area: "budget",
      severity: "warning",
      title: "Guest-related costs need review",
      message,
    });
  } else {
    addImpact(impacts, {
      area: "guest_count",
      severity: reviewItems.length > 0 ? "warning" : "info",
      title: "Guest count changed",
      message:
        `The guest count ${direction} by ${guestMagnitude}. ` +
        `${changedItems.length} estimated expense(s) were recalculated using explicit per-guest rates. ` +
        `${reviewItems.length} expense(s) need review.`,
    });
  }
}

/* =========================================================
   5. MAIN ASSESSMENT FUNCTION
   ========================================================= */

/**
 * Assess a proposed change without committing it.
 *
 * The function validates the incoming event and plan, makes an
 * isolated proposal, recalculates the budget, and reports changes
 * that need review.
 *
 * Invalid input or an impossible resulting schedule throws an error.
 * A future API route should catch these errors and return a useful
 * validation message to the user.
 */
export function assessPlanChange(
  input: AssessPlanChangeInput,
): PlanImpactAssessment {
  // Validate all incoming data before making a proposal.
  const parsed = assessPlanChangeInputSchema.parse(input);

  const currentEvent: EventInput = structuredClone(
    parsed.currentEvent,
  );

  const currentPlan: EventPlan = structuredClone(
    parsed.currentPlan,
  );

  // Never compare or combine plan costs in mismatched currencies.
  if (
    currentEvent.budget.currency !==
    currentPlan.budget.currency
  ) {
    throw new Error(
      "The event and plan use different currencies. Resolve the currency mismatch before assessing changes.",
    );
  }

  validateGuestUnitCosts(
    currentPlan,
    parsed.guestUnitCosts,
  );

  // Preserve the originals. Every requested change applies to clones.
  const proposedEvent: EventInput = structuredClone(
    currentEvent,
  );

  const proposedPlan: EventPlan = structuredClone(
    currentPlan,
  );

  const currentBudget = calculateBudgetSummary(
    currentPlan.budget,
  );

  const affectedBudgetItems: AffectedBudgetItem[] = [];
  const reviewRequiredItems: string[] = [];
  const impacts: PlanImpactNotice[] = [];

  let tasksRescheduled = 0;

  /* -------------------------------------------------------
     A. Guest count change
     ------------------------------------------------------- */

  if (parsed.change.kind === "guest_count") {
    const previousGuestCount = currentEvent.guestCount;

    if (previousGuestCount === undefined) {
      throw new Error(
        "The current guest count is unknown. Provide it before simulating a guest-count change.",
      );
    }

    proposedEvent.guestCount = parsed.change.value;

    applyGuestCountChange(
      proposedPlan,
      previousGuestCount,
      parsed.change.value,
      parsed.guestUnitCosts,
      affectedBudgetItems,
      reviewRequiredItems,
      impacts,
    );
  }

  /* -------------------------------------------------------
     B. Spending limit change
     ------------------------------------------------------- */

  if (parsed.change.kind === "budget") {
    const previousLimit = proposedPlan.budget.spendingLimit;
    const nextLimit = parsed.change.value;

    proposedPlan.budget.spendingLimit = nextLimit;

    proposedEvent.budget = {
      ...proposedEvent.budget,
      totalAmount: nextLimit,
    };

    if (previousLimit !== nextLimit) {
      addImpact(impacts, {
        area: "budget",
        severity: "info",
        title: "Spending limit changed",
        message:
          `The spending limit changed from ` +
          `${formatMoney(
            previousLimit,
            proposedPlan.budget.currency,
          )} to ` +
          `${formatMoney(
            nextLimit,
            proposedPlan.budget.currency,
          )}. Expense amounts were not automatically modified.`,
      });
    } else {
      addImpact(impacts, {
        area: "budget",
        severity: "info",
        title: "Spending limit unchanged",
        message:
          "The proposed spending limit is the same as the current limit.",
      });
    }
  }

  /* -------------------------------------------------------
     C. Event date change
     ------------------------------------------------------- */

  if (parsed.change.kind === "event_date") {
    const previousDate = currentEvent.eventDate;

    if (!previousDate) {
      throw new Error(
        "The current event date is unknown. Set it before simulating a date change.",
      );
    }

    const nextDate = parsed.change.value;

    const dayDelta = differenceInCalendarDays(
      previousDate,
      nextDate,
    );

    proposedEvent.eventDate = nextDate;

    // Shift each task by the same calendar-day offset.
    // This preserves the relative spacing between preparation tasks.
    if (dayDelta !== 0) {
      proposedPlan.tasks = proposedPlan.tasks.map((task) => ({
        ...task,
        dueDate: shiftDate(task.dueDate, dayDelta),
      }));

      tasksRescheduled = proposedPlan.tasks.length;

      addImpact(impacts, {
        area: "timeline",
        severity: "info",
        title: "Task dates shifted",
        message:
          `The event date moved by ${Math.abs(dayDelta)} calendar day(s). ` +
          `${tasksRescheduled} task date(s) were shifted by the same amount.`,
      });

      addReviewItem(
        reviewRequiredItems,
        "Recheck venue, vendor, catering, transport, and other reservations because the event date changed.",
      );

      addImpact(impacts, {
        area: "vendors",
        severity: "warning",
        title: "Confirm date-sensitive arrangements",
        message:
          "The new schedule does not confirm vendor availability. Contact providers and verify the revised dates before accepting the change.",
      });
    } else {
      addImpact(impacts, {
        area: "timeline",
        severity: "info",
        title: "Event date unchanged",
        message:
          "The proposed date is the same as the current date. No task dates were shifted.",
      });
    }

    // Date changes must result in a valid timeline.
    const timelineValidation = validateTimeline(
      proposedPlan.tasks,
      nextDate,
    );

    if (!timelineValidation.success) {
      const details = timelineValidation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ");

      throw new Error(
        `The proposed date produces an invalid timeline: ${details}`,
      );
    }

    proposedPlan.tasks = timelineValidation.data;
  }

  /* -------------------------------------------------------
     D. Location change
     ------------------------------------------------------- */

  if (parsed.change.kind === "location") {
    const previousLocation = currentEvent.location;
    const proposedLocation = parsed.change.value;

    const previousLabel = formatLocation(previousLocation);
    const proposedLabel = formatLocation(proposedLocation);

    proposedEvent.location = proposedLocation;

    const locationChanged =
      previousLabel !== proposedLabel ||
      JSON.stringify(previousLocation ?? {}) !==
        JSON.stringify(proposedLocation);

    if (locationChanged) {
      const locationSensitiveItems =
        proposedPlan.budget.items.filter((item) =>
          LOCATION_SENSITIVE_CATEGORIES.has(item.category),
        );

      for (const item of locationSensitiveItems) {
        addReviewItem(
          reviewRequiredItems,
          `${item.name}: review the cost and suitability for the proposed location.`,
        );

        affectedBudgetItems.push({
          itemId: item.id,
          name: item.name,
          category: item.category,
          previousAmount: activeCost(item),
          proposedAmount: activeCost(item),
          updated: false,
          reason:
            "Location-dependent cost not recalculated because no verified replacement price was supplied.",
        });
      }

      addReviewItem(
        reviewRequiredItems,
        "Recheck vendor service areas, travel charges, venue suitability, and availability for the proposed location.",
      );

      addImpact(impacts, {
        area: "location",
        severity: "warning",
        title: "Location changed",
        message:
          `The proposed location changed from "${previousLabel}" to "${proposedLabel}". ` +
          "Location-sensitive prices and service coverage have not been invented or automatically changed.",
      });

      addImpact(impacts, {
        area: "vendors",
        severity: "warning",
        title: "Review vendor suitability",
        message:
          "Confirm service areas, travel charges, venue suitability, and availability before accepting the new location.",
      });
    } else {
      addImpact(impacts, {
        area: "location",
        severity: "info",
        title: "Location unchanged",
        message:
          "The proposed location matches the current location. No location-dependent changes were identified.",
      });
    }
  }

  /* -------------------------------------------------------
     E. Validate and calculate the proposed plan
     ------------------------------------------------------- */

  // Schema parsing ensures the proposed modifications remain valid.
  const validatedProposedEvent = eventInputSchema.parse(
    proposedEvent,
  );

  const validatedProposedPlan = eventPlanSchema.parse(
    proposedPlan,
  );

  // Budget numbers are recalculated exclusively by the deterministic
  // engine, never copied from AI-generated prose.
  const proposedBudget = calculateBudgetSummary(
    validatedProposedPlan.budget,
  );

  if (!proposedBudget.isWithinBudget) {
    addReviewItem(
      reviewRequiredItems,
      "The projected event total exceeds the proposed spending limit.",
    );

    addImpact(impacts, {
      area: "budget",
      severity: "critical",
      title: "The proposed plan exceeds its budget",
      message:
        `The projected total is ` +
        `${formatMoney(
          proposedBudget.projectedTotal,
          proposedBudget.currency,
        )}, which exceeds the spending limit by ` +
        `${formatMoney(
          proposedBudget.overBudgetAmount,
          proposedBudget.currency,
        )}. Adjust expenses or the budget before accepting this proposal.`,
    });
  } else {
    addImpact(impacts, {
      area: "budget",
      severity: "info",
      title: "Budget recalculated",
      message:
        `${formatMoney(
          proposedBudget.remainingBudget,
          proposedBudget.currency,
        )} remains within the proposed spending limit.`,
    });
  }

  // Warn if the intake budget already disagrees with the saved plan.
  // The persisted plan is treated as the calculation baseline.
  if (
    currentEvent.budget.totalAmount !== undefined &&
    Math.abs(
      currentEvent.budget.totalAmount -
        currentPlan.budget.spendingLimit,
    ) > 0.01
  ) {
    addReviewItem(
      reviewRequiredItems,
      "The event intake budget differs from the saved plan's spending limit. Confirm which value should be authoritative.",
    );

    addImpact(impacts, {
      area: "budget",
      severity: "warning",
      title: "Existing budget values differ",
      message:
        "The event's intake budget and the saved plan's spending limit do not match. Review the difference before accepting the proposal.",
    });
  }

  const projectedCostChange = roundMoney(
    proposedBudget.projectedTotal -
      currentBudget.projectedTotal,
  );

  const remainingBudgetChange = roundMoney(
    proposedBudget.remainingBudget -
      currentBudget.remainingBudget,
  );

  const requiresReview =
    reviewRequiredItems.length > 0 ||
    impacts.some(
      (impact) =>
        impact.severity === "warning" ||
        impact.severity === "critical",
    );

  return {
    change: parsed.change,
    currentEvent,
    proposedEvent: validatedProposedEvent,
    proposedPlan: validatedProposedPlan,
    currentBudget,
    proposedBudget,
    projectedCostChange,
    remainingBudgetChange,
    affectedBudgetItems,
    tasksRescheduled,
    reviewRequiredItems,
    impacts,
    requiresReview,
  };
}