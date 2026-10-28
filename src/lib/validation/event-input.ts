/**
 * EventoAI — Event input validation
 *
 * Validate user-provided details before using them in AI requests
 * or storing them in the database.
 */

import { z } from "zod";

import {
  CURRENCY_CODES,
  EVENT_TYPES,
  PLANNING_PRIORITIES,
  VENUE_TYPES,
} from "@/types/event";

/**
 * Validate a date in YYYY-MM-DD format.
 *
 * A regular expression checks the format; the second check ensures
 * the date actually exists on the calendar.
 */
function isValidCalendarDate(value: string): boolean {
  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

export const dateOnlySchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Enter the date in YYYY-MM-DD format.",
  )
  .refine(
    isValidCalendarDate,
    "Enter a valid calendar date.",
  );

/** Reusable text validation for optional lists. */
const preferenceTextSchema = z
  .string()
  .trim()
  .min(1, "This value cannot be empty.")
  .max(120, "Keep this value under 120 characters.");

/** Optional location details supplied during event intake. */
export const eventLocationSchema = z
  .object({
    city: preferenceTextSchema.optional(),
    region: preferenceTextSchema.optional(),
    country: preferenceTextSchema.optional(),
    venueName: preferenceTextSchema.optional(),
    venueType: z.enum(VENUE_TYPES).optional(),
  })
  .strict();

/** Validate personalization preferences. */
export const eventPreferencesSchema = z
  .object({
    preferredThemes: z
      .array(preferenceTextSchema)
      .max(10)
      .optional(),

    preferredStyles: z
      .array(preferenceTextSchema)
      .max(10)
      .optional(),

    culturalNotes: z
      .string()
      .trim()
      .max(1000)
      .optional(),

    dietaryRequirements: z
      .array(preferenceTextSchema)
      .max(30)
      .optional(),

    accessibilityNeeds: z
      .array(preferenceTextSchema)
      .max(30)
      .optional(),

    mustHave: z
      .array(preferenceTextSchema)
      .max(30)
      .optional(),

    mustAvoid: z
      .array(preferenceTextSchema)
      .max(30)
      .optional(),

    notes: z
      .string()
      .trim()
      .max(3000)
      .optional(),
  })
  .strict();

/**
 * Event intake schema.
 *
 * eventDate, guestCount, totalAmount, and other details are optional
 * because the user may not know them when starting a conversation.
 *
 * The planning API will check whether sufficient information exists
 * before requesting generation of a complete event plan.
 */
export const eventInputSchema = z
  .object({
    eventType: z.enum(EVENT_TYPES),

    title: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .optional(),

    eventDate: dateOnlySchema.optional(),

    location: eventLocationSchema.optional(),

    guestCount: z
      .number()
      .int()
      .min(1)
      .max(100_000)
      .optional(),

    budget: z
      .object({
        currency: z.enum(CURRENCY_CODES),

        totalAmount: z
          .number()
          .min(0)
          .max(1_000_000_000)
          .optional(),

        contingencyPercent: z
          .number()
          .min(0)
          .max(50)
          .optional(),
      })
      .strict(),

    preferences: eventPreferencesSchema.optional(),

    planningPriorities: z
      .array(z.enum(PLANNING_PRIORITIES))
      .max(PLANNING_PRIORITIES.length)
      .optional(),

    specialRequirements: z
      .string()
      .trim()
      .max(3000)
      .optional(),
  })
  .strict();

/** Type inferred directly from the validated schema. */
export type ValidatedEventInput = z.infer<
  typeof eventInputSchema
>;