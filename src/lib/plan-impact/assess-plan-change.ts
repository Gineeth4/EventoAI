import type {
  EventInput,
} from "@/types/event";

import type {
  EventPlan,
} from "@/types/event-plan";

import {
  eventInputSchema,
} from "@/lib/validation/event-input";

import {
  eventPlanSchema,
} from "@/lib/validation/event-plan";

import {
  calculateBudgetSummary,
  roundMoney,
} from "@/lib/budget-engine/calculate-budget";

import {
  validateTimeline,
} from "@/lib/timeline-engine/validate-timeline";

import {
  assessPlanChangeInputSchema,
} from "./plan-change-schema";

import type {
  AssessPlanChangeInput,
  AffectedBudgetItem,
  PlanImpactAssessment,
  PlanImpactNotice,
} from "./plan-change-schema";

import {
  LOCATION_SENSITIVE_CATEGORIES,
  activeCost,
  addImpact,
  addReviewItem,
  applyGuestCountChange,
  differenceInCalendarDays,
  formatLocation,
  formatMoney,
  shiftDate,
  validateGuestUnitCosts,
} from "./plan-impact-helpers";

export {
  planChangeSchema,
} from "./plan-change-schema";

export type {
  AssessPlanChangeInput,
  PlanChange,
  PlanImpactSeverity,
  PlanImpactArea,
  PlanImpactNotice,
  AffectedBudgetItem,
  PlanImpactAssessment,
} from "./plan-change-schema";
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