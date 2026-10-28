/**
 * EventoAI — Recommendation types
 *
 * Creative recommendations and vendor suggestions are different:
 * ideas may be AI-generated, but real vendor claims require evidence.
 */

import type { Currency } from "@/types/event";

/** Categories of personalized event ideas. */
export const IDEA_CATEGORIES = [
  "theme",
  "decoration",
  "food",
  "activity",
  "entertainment",
  "venue",
  "accessibility",
  "sustainability",
  "logistics",
  "guest_experience",
  "other",
] as const;

export type IdeaCategory =
  (typeof IDEA_CATEGORIES)[number];

/** Categories of services users may need for their events. */
export const VENDOR_CATEGORIES = [
  "venue",
  "catering",
  "decoration",
  "photography",
  "videography",
  "entertainment",
  "florist",
  "transportation",
  "rentals",
  "hair_and_makeup",
  "accommodation",
  "security",
  "accessibility",
  "other",
] as const;

export type VendorCategory =
  (typeof VENDOR_CATEGORIES)[number];

/**
 * Provenance of vendor information.
 *
 * "verified" describes the verification of supplied source information;
 * it does not automatically mean a vendor has current availability.
 */
export const VENDOR_SOURCE_STATUSES = [
  "illustrative",
  "estimated",
  "source_listed",
  "verified",
] as const;

export type VendorSourceStatus =
  (typeof VENDOR_SOURCE_STATUSES)[number];

/** A personalized creative idea suggested for an event. */
export type EventIdeaRecommendation = {
  id: string;
  title: string;
  category: IdeaCategory;
  description: string;
  whyItFits: string;

  /** Optional cost estimate for the idea. */
  estimatedCost?: number;
  currency?: Currency;

  /** Short searchable tags, such as "outdoor" or "family-friendly". */
  tags: string[];
};

/**
 * A possible vendor or service option.
 *
 * displayName can describe a service category instead of naming a
 * specific company. Real business names and claims will be supported
 * by a retrieved source in the vendor integration.
 */
export type VendorSuggestion = {
  id: string;
  serviceCategory: VendorCategory;
  displayName: string;
  description: string;
  whyItFits: string;

  estimatedCost?: number;
  currency?: Currency;

  sourceStatus: VendorSourceStatus;
  sourceLabel?: string;
  sourceUrl?: string;
  locationLabel?: string;
};