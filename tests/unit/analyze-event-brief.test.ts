import { describe, expect, it } from "vitest";

import {
  analyzeEventBrief,
  type EventBriefForAnalysis,
} from "@/lib/planning-intelligence/analyze-event-brief";

const FIXED_TODAY = new Date("2026-01-01T12:00:00.000Z");

const BASE_BRIEF: EventBriefForAnalysis = {
  eventType: "birthday",
  title: "Garden Birthday Celebration",
  eventDate: "2026-06-15",
  guestCount: 40,

  location: {
    city: "Chennai",
    country: "India",
    venueType: "indoor",
  },

  budget: {
    currency: "INR",
    totalAmount: 100000,
    contingencyPercent: 10,
  },

  preferences: {
    preferredThemes: ["botanical"],
    preferredStyles: ["relaxed"],
    notes: "",
  },

  planningPriorities: [
    "budget",
    "guest_experience",
  ],
};

function makeBrief(
  overrides: Partial<EventBriefForAnalysis> = {},
): EventBriefForAnalysis {
  return {
    ...BASE_BRIEF,
    ...overrides,
    location: {
      ...BASE_BRIEF.location,
      ...overrides.location,
    },
    budget: {
      ...BASE_BRIEF.budget,
      ...overrides.budget,
    },
    preferences: {
      ...BASE_BRIEF.preferences,
      ...overrides.preferences,
    },
  };
}

describe("analyzeEventBrief", () => {
  it("reports complete coverage for a well-specified future event", () => {
    const report = analyzeEventBrief(
      BASE_BRIEF,
      FIXED_TODAY,
    );

    expect(report.coverageScore).toBe(100);
    expect(report.planningWindowDays).toBe(165);
    expect(report.budgetPerGuest).toBe(2500);

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "event_date_in_past",
      ),
    ).toBe(false);
  });

  it("flags an event date that has already passed", () => {
    const brief = makeBrief({
      eventDate: "2025-12-31",
    });

    const report = analyzeEventBrief(
      brief,
      FIXED_TODAY,
    );

    expect(report.planningWindowDays).toBe(-1);
    expect(report.coverageScore).toBeLessThan(100);

    expect(report.insights[0]).toMatchObject({
      code: "event_date_in_past",
      severity: "critical",
    });

    expect(report.summary).toContain("critical");
  });

  it("flags an event happening within seven days", () => {
    const report = analyzeEventBrief(
      makeBrief({ eventDate: "2026-01-06" }),
      FIXED_TODAY,
    );

    expect(report.planningWindowDays).toBe(5);

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "compressed_timeline" &&
          insight.severity === "warning",
      ),
    ).toBe(true);

    expect(
      report.priorityActions.some((action) =>
        action.includes("availability"),
      ),
    ).toBe(true);
  });

  it("identifies a short but not immediate planning window", () => {
    const report = analyzeEventBrief(
      makeBrief({ eventDate: "2026-01-21" }),
      FIXED_TODAY,
    );

    expect(report.planningWindowDays).toBe(20);

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "short_lead_time",
      ),
    ).toBe(true);

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "compressed_timeline",
      ),
    ).toBe(false);
  });

  it("recommends a contingency for outdoor events", () => {
    const report = analyzeEventBrief(
      makeBrief({
        location: {
          city: "Chennai",
          country: "India",
          venueType: "outdoor",
        },
      }),
      FIXED_TODAY,
    );

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "outdoor_contingency",
      ),
    ).toBe(true);

    expect(
      report.priorityActions.some((action) =>
        action.includes("weather fallback"),
      ),
    ).toBe(true);
  });

  it("flags logistical considerations for large events", () => {
    const report = analyzeEventBrief(
      makeBrief({ guestCount: 150 }),
      FIXED_TODAY,
    );

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "large_guest_count" &&
          insight.severity === "warning",
      ),
    ).toBe(true);

    expect(
      report.priorityActions.some((action) =>
        action.includes("Guest flow"),
      ),
    ).toBe(true);
  });

  it("flags a reserve below the suggested ten percent", () => {
    const report = analyzeEventBrief(
      makeBrief({
        budget: {
          currency: "INR",
          totalAmount: 100000,
          contingencyPercent: 5,
        },
      }),
      FIXED_TODAY,
    );

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "low_contingency_reserve",
      ),
    ).toBe(true);
  });

  it("does not treat a ten percent reserve as a warning", () => {
    const report = analyzeEventBrief(
      makeBrief({
        budget: {
          currency: "INR",
          totalAmount: 100000,
          contingencyPercent: 10,
        },
      }),
      FIXED_TODAY,
    );

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "low_contingency_reserve",
      ),
    ).toBe(false);
  });

  it("suggests event-specific preparation actions", () => {
    const report = analyzeEventBrief(
      makeBrief({
        eventType: "corporate",
      }),
      FIXED_TODAY,
    );

    expect(
      report.priorityActions.some((action) =>
        action.includes("agenda"),
      ),
    ).toBe(true);
  });

  it("asks for explicit planning priorities when none are provided", () => {
    const report = analyzeEventBrief(
      makeBrief({ planningPriorities: [] }),
      FIXED_TODAY,
    );

    expect(report.coverageScore).toBeLessThan(100);

    expect(
      report.insights.some(
        (insight) =>
          insight.code === "set_planning_priorities",
      ),
    ).toBe(true);
  });

  it("keeps critical insights before warnings and informational notes", () => {
    const report = analyzeEventBrief(
      makeBrief({
        eventDate: "2025-12-31",
        location: {
          city: "Chennai",
          country: "India",
          venueType: "outdoor",
        },
        guestCount: 150,
        budget: {
          currency: "INR",
          totalAmount: 100000,
          contingencyPercent: 5,
        },
      }),
      FIXED_TODAY,
    );

    const ranks = report.insights.map((insight) => {
      if (insight.severity === "critical") return 0;
      if (insight.severity === "warning") return 1;
      return 2;
    });

    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("does not claim that planning allocations are verified prices", () => {
    const report = analyzeEventBrief(
      BASE_BRIEF,
      FIXED_TODAY,
    );

    const costInsight = report.insights.find(
      (insight) => insight.code === "verify_costs",
    );

    expect(costInsight).toBeDefined();
    expect(costInsight?.severity).toBe("info");
    expect(costInsight?.message).toContain(
      "do not establish current supplier prices",
    );
  });
});