import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";

import type {
  Currency,
  EventLocation,
} from "@/types/event";

import type {
  BudgetCategory,
  BudgetItem,
  EventPlan,
} from "@/types/event-plan";

import type {
  AffectedBudgetItem,
  PlanImpactNotice,
} from "./plan-change-schema";

import {
  dateOnlySchema,
} from "@/lib/validation/event-input";

import {
  getPlanningAmount,
  roundMoney,
} from "@/lib/budget-engine/calculate-budget";
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
export const LOCATION_SENSITIVE_CATEGORIES = new Set<BudgetCategory>([
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
export function formatMoney(
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
export function differenceInCalendarDays(
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
export function shiftDate(
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
export function formatLocation(
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
export function addReviewItem(
  items: string[],
  value: string,
): void {
  if (!items.includes(value)) {
    items.push(value);
  }
}

/** Add a structured, readable impact message. */
export function addImpact(
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
export function validateGuestUnitCosts(
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
export function activeCost(item: BudgetItem): number {
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
export function applyGuestCountChange(
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
