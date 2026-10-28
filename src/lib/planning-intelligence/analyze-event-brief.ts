/**
 * EventoAI — Structured Event Brief Intelligence
 *
 * This module provides deterministic planning checks before an
 * event plan is generated. It does not call an AI provider or
 * change the user's event inputs or budget.
 */

export type PlanningInsightSeverity =
  | "critical"
  | "warning"
  | "info";

export type PlanningInsightCode =
  | "event_date_in_past"
  | "compressed_timeline"
  | "short_lead_time"
  | "outdoor_contingency"
  | "large_guest_count"
  | "low_contingency_reserve"
  | "verify_costs"
  | "set_planning_priorities";

export type EventBriefForAnalysis = {
  eventType: string;
  title: string;
  eventDate: string;
  guestCount: number;

  location: {
    city: string;
    country: string;
    venueType: "indoor" | "outdoor" | string;
  };

  budget: {
    currency: string;
    totalAmount: number;
    contingencyPercent: number;
  };

  preferences: {
    preferredThemes: string[];
    preferredStyles: string[];
    notes?: string;
  };

  planningPriorities?: string[];
};

export type PlanningInsight = {
  code: PlanningInsightCode;
  severity: PlanningInsightSeverity;
  title: string;
  message: string;
  recommendedAction: string;
};

export type PlanningIntelligenceReport = {
  coverageScore: number;
  planningWindowDays: number | null;
  budgetPerGuest: number | null;
  summary: string;
  insights: PlanningInsight[];
  priorityActions: string[];
};

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const SEVERITY_ORDER: Record<PlanningInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function parseDateOnlyUtc(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function getPlanningWindowDays(
  eventDate: string,
  today: Date,
): number | null {
  const eventTimestamp = parseDateOnlyUtc(eventDate);

  if (
    eventTimestamp === null ||
    !Number.isFinite(today.getTime())
  ) {
    return null;
  }

  const todayTimestamp = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return Math.round(
    (eventTimestamp - todayTimestamp) / DAY_IN_MILLISECONDS,
  );
}

function isValidGuestCount(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10_000
  );
}

function isValidBudget(
  budget: EventBriefForAnalysis["budget"],
): boolean {
  return (
    budget.currency.trim().length > 0 &&
    Number.isFinite(budget.totalAmount) &&
    budget.totalAmount > 0 &&
    budget.totalAmount <= 1_000_000_000 &&
    Number.isFinite(budget.contingencyPercent) &&
    budget.contingencyPercent >= 0 &&
    budget.contingencyPercent <= 100
  );
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function createPriorityActions(
  brief: EventBriefForAnalysis,
  planningWindowDays: number | null,
): string[] {
  const actions: string[] = [
    "Confirm the venue scope, included services, capacity, and cancellation terms.",
    "Verify major expense estimates using current quotations before making commitments.",
    "Assign a responsible person and due date to each important preparation task.",
  ];

  const eventType = brief.eventType.trim().toLowerCase();

  switch (eventType) {
    case "wedding":
      actions.push(
        "Prioritize venue, catering, photography, and other essential supplier availability and written terms.",
      );
      break;

    case "birthday":
    case "anniversary":
      actions.push(
        "Create a simple run of show covering guest arrival, food, key celebration moments, and closing.",
      );
      break;

    case "community":
      actions.push(
        "Plan accessibility, guest check-in, volunteer coverage, and a clear emergency contact.",
      );
      break;

    case "corporate":
      actions.push(
        "Confirm the agenda, audiovisual equipment, connectivity, attendee communications, and decision owners.",
      );
      break;

    default:
      actions.push(
        "Create a run of show covering arrival, the main activity, breaks, and closing.",
      );
  }

  if (brief.location.venueType === "outdoor") {
    actions.push(
      "Prepare a weather fallback for outdoor conditions, including shade or shelter and a decision deadline for moving indoors.",
    );
  }

  if (brief.guestCount >= 100) {
    actions.push(
      "Guest flow: review venue capacity, entrances, accessible routes, and restroom arrangements for the expected attendance.",
    );
  }

  if (
    planningWindowDays !== null &&
    planningWindowDays >= 0 &&
    planningWindowDays <= 7
  ) {
    actions.push(
      "Immediately confirm essential supplier availability and prioritize decisions that could prevent the event from proceeding.",
    );
  }

  if (brief.budget.contingencyPercent < 10) {
    actions.push(
      "Review whether a contingency reserve around 10% is appropriate for this event; it is a planning guideline, not a guarantee.",
    );
  }

  return [...new Set(actions)];
}

function createInsights(
  brief: EventBriefForAnalysis,
  planningWindowDays: number | null,
): PlanningInsight[] {
  const insights: PlanningInsight[] = [];

  if (
    planningWindowDays !== null &&
    planningWindowDays < 0
  ) {
    insights.push({
      code: "event_date_in_past",
      severity: "critical",
      title: "The event date has passed",
      message:
        "The selected event date is earlier than today. The schedule cannot be treated as an upcoming event plan until the date is reviewed.",
      recommendedAction:
        "Choose the intended future event date before generating the plan.",
    });
  } else if (
    planningWindowDays !== null &&
    planningWindowDays <= 7
  ) {
    insights.push({
      code: "compressed_timeline",
      severity: "warning",
      title: "A compressed preparation window",
      message:
        planningWindowDays === 0
          ? "The event is scheduled for today. Many decisions may need immediate attention."
          : `Only ${planningWindowDays} ${
              planningWindowDays === 1 ? "day" : "days"
            } remain before the event. Supplier availability and preparation tasks may be difficult to change at short notice.`,
      recommendedAction:
        "Confirm essential bookings first, prioritize safety and guest needs, and defer optional details that cannot be completed reliably.",
    });
  } else if (
    planningWindowDays !== null &&
    planningWindowDays <= 30
  ) {
    insights.push({
      code: "short_lead_time",
      severity: "info",
      title: "Keep the preparation schedule focused",
      message:
        `${planningWindowDays} days remain before the event. Confirm major dependencies early and leave time to check the details that matter most.`,
      recommendedAction:
        "Finalize the venue, essential services, and major purchases before working through optional enhancements.",
    });
  }

  if (brief.location.venueType === "outdoor") {
    insights.push({
      code: "outdoor_contingency",
      severity: "warning",
      title: "Plan for outdoor conditions",
      message:
        "Outdoor events can be affected by weather, temperature, shade, and access to shelter. The brief should account for a practical alternative.",
      recommendedAction:
        "Identify a weather fallback and decide when the team would switch to it.",
    });
  }

  if (brief.guestCount >= 100) {
    insights.push({
      code: "large_guest_count",
      severity: "warning",
      title: "Guest logistics need attention",
      message:
        `The expected attendance is ${brief.guestCount} people. Guest movement, capacity, service timing, and accessibility should be explicitly planned.`,
      recommendedAction:
        "Review venue capacity, entry and exit arrangements, service queues, and accessibility before confirming the setup.",
    });
  }

  if (
    Number.isFinite(brief.budget.contingencyPercent) &&
    brief.budget.contingencyPercent >= 0 &&
    brief.budget.contingencyPercent < 10
  ) {
    insights.push({
      code: "low_contingency_reserve",
      severity: "warning",
      title: "Review the contingency reserve",
      message:
        `The current reserve is ${brief.budget.contingencyPercent}%. A reserve around 10% is a useful starting guideline, but the appropriate amount depends on the event and its uncertainties.`,
      recommendedAction:
        "Review likely unexpected costs and adjust the reserve if your circumstances justify it.",
    });
  }

  if (
    !brief.planningPriorities ||
    brief.planningPriorities.length === 0
  ) {
    insights.push({
      code: "set_planning_priorities",
      severity: "info",
      title: "Choose the main planning priorities",
      message:
        "The brief does not yet identify which outcomes matter most when trade-offs arise.",
      recommendedAction:
        "Choose the priorities that should guide decisions, such as budget control, guest experience, accessibility, or sustainability.",
    });
  }

  insights.push({
    code: "verify_costs",
    severity: "info",
    title: "Confirm costs before committing",
    message:
      "A structured plan and its budget allocations are planning aids. They do not establish current supplier prices, availability, or booking terms.",
    recommendedAction:
      "Obtain current quotations and confirm inclusions, taxes, payment terms, and cancellation conditions directly with suppliers.",
  });

  return insights.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] -
      SEVERITY_ORDER[right.severity],
  );
}

/**
 * Analyze a structured event brief without modifying it.
 *
 * `today` is injectable so date-related behavior can be tested
 * deterministically. Production callers can omit it.
 */
export function analyzeEventBrief(
  brief: EventBriefForAnalysis,
  today: Date = new Date(),
): PlanningIntelligenceReport {
  const planningWindowDays = getPlanningWindowDays(
    brief.eventDate,
    today,
  );

  const validGuestCount = isValidGuestCount(
    brief.guestCount,
  );

  const validBudget = isValidBudget(brief.budget);

  const validVenue =
    brief.location.venueType === "indoor" ||
    brief.location.venueType === "outdoor";

  const validEventDate =
    planningWindowDays !== null &&
    planningWindowDays >= 0;

  const checks = [
    Boolean(brief.title.trim() && brief.eventType.trim()),
    validEventDate,
    validGuestCount,
    Boolean(
      brief.location.city.trim() &&
        brief.location.country.trim(),
    ),
    validVenue,
    validBudget,
    brief.preferences.preferredThemes.length > 0,
    brief.preferences.preferredStyles.length > 0,
    Boolean(brief.planningPriorities?.length),
  ];

  const completedChecks = checks.filter(Boolean).length;

  const coverageScore = Math.round(
    (completedChecks / checks.length) * 100,
  );

  const budgetPerGuest =
    validGuestCount &&
    Number.isFinite(brief.budget.totalAmount) &&
    brief.budget.totalAmount > 0
      ? roundToTwoDecimals(
          brief.budget.totalAmount / brief.guestCount,
        )
      : null;

  const insights = createInsights(
    brief,
    planningWindowDays,
  );

  const priorityActions = createPriorityActions(
    brief,
    planningWindowDays,
  );

  const criticalCount = insights.filter(
    (insight) => insight.severity === "critical",
  ).length;

  const warningCount = insights.filter(
    (insight) => insight.severity === "warning",
  ).length;

  let summary: string;

  if (criticalCount > 0) {
    summary =
      "Review the critical date or planning issue before relying on this brief.";
  } else if (coverageScore < 100) {
    summary =
      "The brief contains useful information, but some planning details need attention.";
  } else if (warningCount > 0) {
    summary =
      "The brief is well covered. Review the flagged logistics and contingency considerations before proceeding.";
  } else {
    summary =
      "The brief is well covered. Verify costs and confirm the remaining practical details as planning progresses.";
  }

  return {
    coverageScore,
    planningWindowDays,
    budgetPerGuest,
    summary,
    insights,
    priorityActions,
  };
}