import { describe, expect, it } from "vitest";

import {
  CURRENCY_CODES,
  EVENT_TYPES,
} from "@/types/event";
import { eventInputSchema } from "@/lib/validation/event-input";

function validInput() {
  return {
    eventType: EVENT_TYPES[0]!,
    budget: {
      currency: CURRENCY_CODES[0]!,
    },
  };
}

describe("eventInputSchema security and boundaries", () => {
  it("accepts a minimal valid event", () => {
    expect(eventInputSchema.safeParse(validInput()).success).toBe(true);
  });

  it("accepts all structured guest requirements", () => {
    const result = eventInputSchema.safeParse({
      ...validInput(),
      preferences: {
        dietaryRequirements: ["Vegetarian", "Nut-free"],
        accessibilityNeeds: ["Step-free access"],
        mustHave: ["Quiet room"],
        mustAvoid: ["Fireworks"],
        culturalNotes: "Respect the hosts' stated traditions.",
      },
      specialRequirements: "Provide a quiet space for breaks.",
    });

    expect(result.success).toBe(true);
  });

  it("trims structured requirement text", () => {
    const result = eventInputSchema.safeParse({
      ...validInput(),
      preferences: {
        dietaryRequirements: ["  Vegetarian  "],
        culturalNotes: "  Respect the hosts' traditions.  ",
      },
      specialRequirements: "  A quiet space is required.  ",
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.preferences?.dietaryRequirements).toEqual([
        "Vegetarian",
      ]);
      expect(result.data.preferences?.culturalNotes).toBe(
        "Respect the hosts' traditions.",
      );
      expect(result.data.specialRequirements).toBe(
        "A quiet space is required.",
      );
    }
  });

  it("accepts a valid leap-day date", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        eventDate: "2024-02-29",
      }).success,
    ).toBe(true);
  });

  it("rejects an impossible calendar date", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        eventDate: "2025-02-29",
      }).success,
    ).toBe(false);
  });

  it("rejects dates outside YYYY-MM-DD format", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        eventDate: "29-02-2024",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown top-level properties", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        unexpected: "not allowed",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown preference properties", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        preferences: {
          dietaryRequirements: ["Vegetarian"],
          unexpected: "not allowed",
        },
      }).success,
    ).toBe(false);
  });

  it("limits every structured requirement list to 30 entries", () => {
    const fields = [
      "dietaryRequirements",
      "accessibilityNeeds",
      "mustHave",
      "mustAvoid",
    ] as const;

    for (const field of fields) {
      const result = eventInputSchema.safeParse({
        ...validInput(),
        preferences: {
          [field]: Array.from({ length: 31 }, (_, index) => `Item ${index}`),
        },
      });

      expect(result.success, `${field} should reject 31 entries`).toBe(false);
    }
  });

  it("rejects requirement entries longer than 120 characters", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        preferences: {
          dietaryRequirements: ["A".repeat(121)],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects empty requirement entries", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        preferences: {
          mustHave: ["   "],
        },
      }).success,
    ).toBe(false);
  });

  it("rejects cultural notes longer than 1000 characters", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        preferences: {
          culturalNotes: "A".repeat(1001),
        },
      }).success,
    ).toBe(false);
  });

  it("rejects special requirements longer than 3000 characters", () => {
    expect(
      eventInputSchema.safeParse({
        ...validInput(),
        specialRequirements: "A".repeat(3001),
      }).success,
    ).toBe(false);
  });

  it("rejects invalid guest counts", () => {
    for (const guestCount of [0, -1, 100001, 1.5]) {
      expect(
        eventInputSchema.safeParse({
          ...validInput(),
          guestCount,
        }).success,
      ).toBe(false);
    }
  });
});
