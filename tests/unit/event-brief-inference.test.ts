import { describe, expect, it } from "vitest";

import { inferEventBriefFromText } from "@/lib/event-brief-inference";

describe("inferEventBriefFromText", () => {
  it("recognizes the event type and guest count", () => {
    const result = inferEventBriefFromText(
      "Help me plan a birthday for 40 guests",
    );

    expect(result.eventType).toBe("birthday");
    expect(result.guestCount).toBe(40);
  });

  it("extracts a budget with an INR symbol", () => {
    const result = inferEventBriefFromText(
      "A garden birthday with a budget around ₹25,000",
    );

    expect(result.totalAmount).toBe(25_000);
    expect(result.currency).toBe("INR");
  });

  it("expands a budget expressed in thousands", () => {
    const result = inferEventBriefFromText(
      "A small birthday party with budget of 25k",
    );

    expect(result.totalAmount).toBe(25_000);
  });

  it("recognizes a valid ISO date", () => {
    const result = inferEventBriefFromText(
      "A birthday on 2027-01-15",
    );

    expect(result.eventDate).toBe("2027-01-15");
  });

  it("rejects invalid dates", () => {
    const result = inferEventBriefFromText(
      "A birthday on 2027-02-31",
    );

    expect(result.eventDate).toBeUndefined();
  });

  it("recognizes theme and venue preferences", () => {
    const result = inferEventBriefFromText(
      "An elegant botanical garden wedding outdoors",
    );

    expect(result.eventType).toBe("wedding");
    expect(result.venueType).toBe("outdoor");
    expect(result.themes).toContain("botanical");
    expect(result.styles).toContain("elegant");
  });

  it("does not invent missing guest count, date, or budget", () => {
    const result = inferEventBriefFromText(
      "I would like a modern anniversary celebration",
    );

    expect(result.eventType).toBe("anniversary");
    expect(result.eventDate).toBeUndefined();
    expect(result.guestCount).toBeUndefined();
    expect(result.totalAmount).toBeUndefined();
  });
});