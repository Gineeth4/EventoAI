import { describe, expect, it } from "vitest";

import { parsePlanChangeRequest } from "@/lib/plan-impact/parse-plan-change-request";

describe("parsePlanChangeRequest", () => {
  it("parses a guest-count change", () => {
    expect(
      parsePlanChangeRequest("Increase guest count to 60"),
    ).toEqual({
      kind: "guest_count",
      value: 60,
    });
  });

  it("uses the final guest count in a from/to request", () => {
    expect(
      parsePlanChangeRequest("Change guests from 40 to 60 guests"),
    ).toEqual({
      kind: "guest_count",
      value: 60,
    });
  });

  it("parses an INR spending limit with comma separators", () => {
    expect(
      parsePlanChangeRequest("Set the budget to INR 1,00,000"),
    ).toEqual({
      kind: "budget",
      value: 100000,
    });
  });

  it("parses an ISO event date", () => {
    expect(
      parsePlanChangeRequest("Move the event date to 2027-03-20"),
    ).toEqual({
      kind: "event_date",
      value: "2027-03-20",
    });
  });

  it("converts DD/MM/YYYY into a calendar date", () => {
    expect(
      parsePlanChangeRequest("Reschedule the event to 20/03/2027"),
    ).toEqual({
      kind: "event_date",
      value: "2027-03-20",
    });
  });

  it("parses a city change", () => {
    expect(
      parsePlanChangeRequest("Change location to Coimbatore"),
    ).toEqual({
      kind: "location",
      value: { city: "Coimbatore" },
    });
  });

  it("rejects unsupported or ambiguous requests", () => {
    expect(
      parsePlanChangeRequest("Reduce decoration spending by 15%"),
    ).toBeNull();

    expect(
      parsePlanChangeRequest("Make it nicer"),
    ).toBeNull();

    expect(
      parsePlanChangeRequest("Move the event date to 2027-02-30"),
    ).toBeNull();
  });

  it("rejects invalid guest counts and budgets", () => {
    expect(
      parsePlanChangeRequest("Increase guest count to 0 guests"),
    ).toBeNull();

    expect(
      parsePlanChangeRequest("Set budget to 999999999999"),
    ).toBeNull();
  });
});
