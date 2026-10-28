/**
 * EventoAI — Core event types
 *
 * This file defines the common data structures shared by the
 * frontend, AI service, validation layer, and database layer.
 */

/** Supported event categories in the initial release. */
export const EVENT_TYPES = [
  "wedding",
  "birthday",
  "community",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Supported currency codes.
 *
 * Each event uses one primary currency for its budget.
 * This prevents accidental addition of values from different currencies.
 */
export const CURRENCY_CODES = [
  "INR",
  "USD",
  "GBP",
  "EUR",
  "AUD",
  "CAD",
  "SGD",
  "AED",
  "NZD",
  "ZAR",
] as const;

export type Currency = (typeof CURRENCY_CODES)[number];

/** Venue arrangements supported by the planning workflow. */
export const VENUE_TYPES = [
  "indoor",
  "outdoor",
  "hybrid",
  "undecided",
] as const;

export type VenueType = (typeof VENUE_TYPES)[number];

/** Lifecycle states for saved events. */
export const EVENT_STATUSES = [
  "draft",
  "planning",
  "in_progress",
  "completed",
  "archived",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Factors that users may prioritize while planning an event. */
export const PLANNING_PRIORITIES = [
  "budget",
  "guest_experience",
  "convenience",
  "accessibility",
  "creativity",
  "sustainability",
] as const;

export type PlanningPriority =
  (typeof PLANNING_PRIORITIES)[number];

/**
 * A date without a time component, represented as YYYY-MM-DD.
 *
 * This avoids confusing a local event date with a timestamp that
 * could shift when converted between time zones.
 */
export type DateOnly = string;

/** Optional geographical and venue details. */
export type EventLocation = {
  city?: string;
  region?: string;
  country?: string;
  venueName?: string;
  venueType?: VenueType;
};

/**
 * Budget information supplied when creating an event.
 *
 * totalAmount is optional at the intake stage because the assistant
 * should be able to ask the user for a budget when it is missing.
 */
export type EventBudgetInput = {
  currency: Currency;
  totalAmount?: number;
  contingencyPercent?: number;
};

/** Personalization preferences for the event. */
export type EventPreferences = {
  preferredThemes?: string[];
  preferredStyles?: string[];
  culturalNotes?: string;
  dietaryRequirements?: string[];
  accessibilityNeeds?: string[];
  mustHave?: string[];
  mustAvoid?: string[];
  notes?: string;
};

/**
 * Initial event intake data.
 *
 * Some fields remain optional because the assistant may need to
 * ask focused clarification questions before generating a complete
 * plan.
 */
export type EventInput = {
  eventType: EventType;
  title?: string;
  eventDate?: DateOnly;
  location?: EventLocation;
  guestCount?: number;
  budget: EventBudgetInput;
  preferences?: EventPreferences;
  planningPriorities?: PlanningPriority[];
  specialRequirements?: string;
};

/**
 * Persisted event record.
 *
 * The ownerId connects an event to its authenticated user.
 * Database policies will enforce that ownership when we integrate
 * Supabase.
 */
export type EventRecord = {
  id: string;
  ownerId: string;
  eventType: EventType;
  title: string;
  eventDate: DateOnly | null;
  location?: EventLocation;
  guestCount?: number;
  budget: EventBudgetInput;
  preferences?: EventPreferences;
  planningPriorities?: PlanningPriority[];
  specialRequirements?: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
};