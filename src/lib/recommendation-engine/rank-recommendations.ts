/**
 * EventoAI — Recommendation Ranking Engine
 *
 * Ranks event ideas and vendor suggestions using deterministic
 * matching rules.
 *
 * IMPORTANT:
 * - A match score is a heuristic, not a probability or guarantee.
 * - This module does not verify that a vendor exists or is available.
 * - Prices are compared only when the currency is known to match.
 * - The engine never invents ratings, prices, or vendor credentials.
 */

import type {
  Currency,
  EventLocation,
  EventPreferences,
  EventType,
  PlanningPriority,
} from "@/types/event";

import type {
  EventIdeaRecommendation,
  VendorSuggestion,
} from "@/types/recommendation";

/** The information used to rank recommendations. */
export type RecommendationContext = {
  eventType: EventType;
  currency: Currency;

  /**
   * Amount of money currently available for the recommended option.
   * This is not necessarily the entire event budget.
   */
  availableBudget?: number;

  guestCount?: number;
  location?: EventLocation;
  preferences?: EventPreferences;
  planningPriorities?: PlanningPriority[];

  /**
   * Optional keywords supplied by the user or extracted from
   * a validated event request.
   */
  searchTerms?: string[];
};

/** Result of the budget-fit comparison. */
export type RecommendationBudgetFit =
  | "within_budget"
  | "over_budget"
  | "unknown";

/**
 * Vendor-source labels communicate provenance.
 * They do not claim that this module independently verified anything.
 */
export type RecommendationEvidence =
  | "illustrative"
  | "estimated"
  | "source_listed"
  | "marked_verified"
  | "not_applicable";

/** A ranked recommendation and the reasons behind its ranking. */
export type RankedRecommendation<T> = {
  item: T;

  /**
   * Deterministic suitability score from 0 to 100.
   * It is not an AI confidence score.
   */
  matchScore: number;

  /** Position in the returned, sorted list, starting at 1. */
  rank: number;

  /** Human-readable signals that contributed to the result. */
  reasons: string[];

  /** Whether the item's cost fits the available budget. */
  budgetFit: RecommendationBudgetFit;

  /** True when text conflicts with a user's mustAvoid preference. */
  hasPreferenceConflict: boolean;

  /** Evidence label for vendors; not applicable to creative ideas. */
  evidence: RecommendationEvidence;
};

/** Words that generally add little value to keyword matching. */
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "my",
  "our",
  "their",
  "this",
  "that",
  "event",
  "party",
  "plan",
  "planning",
]);

/**
 * Convert user input into searchable terms.
 *
 * This normalization helps compare phrases that differ in casing,
 * punctuation, or extra spaces.
 */
function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(
        (word) =>
          word.length > 1 &&
          !STOP_WORDS.has(word),
      ),
  );
}

/** Combine normalized, unique keywords from multiple fields. */
function collectTokens(values: Array<string | undefined>): Set<string> {
  const result = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    for (const token of tokenize(value)) {
      result.add(token);
    }
  }

  return result;
}

/**
 * Calculate how much of the user's search vocabulary appears
 * in the candidate text.
 *
 * This is deliberately a simple, explainable lexical heuristic.
 * It is not semantic understanding.
 */
function keywordMatchRatio(
  queryTokens: Set<string>,
  candidateTokens: Set<string>,
): number {
  if (queryTokens.size === 0) {
    return 0;
  }

  let matches = 0;

  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.size;
}

/** Gather the user's declared preferences into searchable text. */
function getPreferenceTokens(
  context: RecommendationContext,
): Set<string> {
  const preferences = context.preferences;

  return collectTokens([
    ...(preferences?.preferredThemes ?? []),
    ...(preferences?.preferredStyles ?? []),
    ...(preferences?.dietaryRequirements ?? []),
    ...(preferences?.accessibilityNeeds ?? []),
    ...(preferences?.mustHave ?? []),
    preferences?.culturalNotes,
    preferences?.notes,
    context.searchTerms?.join(" "),
  ]);
}

/** Gather explicit exclusions separately so they can be penalized. */
function getMustAvoidTerms(
  context: RecommendationContext,
): string[] {
  return (context.preferences?.mustAvoid ?? [])
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check whether a candidate conflicts with an explicit exclusion.
 *
 * Matching is lexical, so this is a warning heuristic, not proof
 * that an option truly violates a user's requirement.
 */
function hasMustAvoidConflict(
  mustAvoid: string[],
  candidateText: string,
): boolean {
  const normalizedCandidate = candidateText
    .toLowerCase()
    .replace(/\s+/g, " ");

  return mustAvoid.some((term) =>
    normalizedCandidate.includes(
      term.replace(/\s+/g, " "),
    ),
  );
}

/** Event-specific idea categories that tend to be especially relevant. */
const EVENT_IDEA_CATEGORIES: Record<EventType, string[]> = {
  wedding: [
    "theme",
    "decoration",
    "food",
    "entertainment",
    "venue",
    "guest_experience",
    "logistics",
  ],

  birthday: [
    "theme",
    "decoration",
    "food",
    "activity",
    "entertainment",
    "guest_experience",
  ],

  community: [
    "activity",
    "entertainment",
    "accessibility",
    "sustainability",
    "logistics",
    "guest_experience",
  ],
};

/** Priority signals used to explain why a recommendation fits. */
const PRIORITY_CATEGORIES: Record<PlanningPriority, string[]> = {
  budget: [
    "budget",
    "logistics",
  ],

  guest_experience: [
    "food",
    "activity",
    "entertainment",
    "guest_experience",
    "theme",
  ],

  convenience: [
    "logistics",
    "venue",
  ],

  accessibility: [
    "accessibility",
    "venue",
    "transportation",
  ],

  creativity: [
    "theme",
    "decoration",
    "activity",
    "entertainment",
  ],

  sustainability: [
    "sustainability",
    "food",
    "decoration",
  ],
};

/** Give category matching a predictable score. */
function categoryFitScore(
  category: string,
  categories: string[],
): number {
  return categories.includes(category) ? 20 : 8;
}

/** Calculate a category relevance score from the user's priorities. */
function priorityFitScore(
  category: string,
  priorities: PlanningPriority[] | undefined,
): number {
  if (!priorities || priorities.length === 0) {
    return 5;
  }

  const matches = priorities.filter((priority) =>
    PRIORITY_CATEGORIES[priority].includes(category),
  ).length;

  return Math.min(10, matches * 5);
}

/**
 * Evaluate the cost of a candidate.
 *
 * A mismatched or missing currency is not silently converted.
 */
function evaluateBudgetFit(
  cost: number | undefined,
  currency: Currency | undefined,
  context: RecommendationContext,
): {
  fit: RecommendationBudgetFit;
  score: number;
  reason?: string;
} {
  if (
    cost === undefined ||
    context.availableBudget === undefined ||
    currency === undefined
  ) {
    return {
      fit: "unknown",
      score: 8,
      reason:
        "Budget fit cannot be determined from the available cost information.",
    };
  }

  if (currency !== context.currency) {
    return {
      fit: "unknown",
      score: 8,
      reason:
        "The candidate uses a different currency; compare costs only after an explicit conversion.",
    };
  }

  if (cost < 0 || !Number.isFinite(cost)) {
    return {
      fit: "unknown",
      score: 0,
      reason:
        "The candidate's cost is invalid and should be reviewed.",
    };
  }

  if (cost <= context.availableBudget) {
    return {
      fit: "within_budget",
      score: 20,
      reason:
        "The stated cost fits within the available budget for this option.",
    };
  }

  return {
    fit: "over_budget",
    score: 0,
    reason:
      "The stated cost exceeds the available budget for this option.",
  };
}

/** Keep calculated ranking scores inside the documented range. */
function clampScore(score: number): number {
  return Math.max(
    0,
    Math.min(100, Math.round(score)),
  );
}

/** Rank creative ideas for a particular event. */
export function rankIdeaRecommendations(
  recommendations: EventIdeaRecommendation[],
  context: RecommendationContext,
): RankedRecommendation<EventIdeaRecommendation>[] {
  const preferenceTokens = getPreferenceTokens(context);
  const mustAvoid = getMustAvoidTerms(context);

  const ranked = recommendations.map((item) => {
    const candidateText = [
      item.title,
      item.description,
      ...item.tags,
    ]
      .filter(Boolean)
      .join(" ");

    const candidateTokens = tokenize(candidateText);

    const preferenceRatio = keywordMatchRatio(
      preferenceTokens,
      candidateTokens,
    );

    const preferenceScore =
      preferenceTokens.size === 0
        ? 15
        : Math.round(preferenceRatio * 30);

    const eventScore = categoryFitScore(
      item.category,
      EVENT_IDEA_CATEGORIES[context.eventType],
    );

    const priorityScore = priorityFitScore(
      item.category,
      context.planningPriorities,
    );

    const budget = evaluateBudgetFit(
      item.estimatedCost,
      item.currency,
      context,
    );

    const conflict = hasMustAvoidConflict(
      mustAvoid,
      candidateText,
    );

    // Begin with a small baseline and add explicit ranking signals.
    let score =
      15 +
      eventScore +
      preferenceScore +
      priorityScore +
      budget.score;

    if (conflict) {
      // Explicit exclusions should outweigh ordinary category matches.
      score -= 35;
    }

    const reasons: string[] = [];

    if (eventScore >= 20) {
      reasons.push(
        `The "${item.category}" category is relevant to ${context.eventType} planning.`,
      );
    }

    if (preferenceTokens.size > 0 && preferenceRatio > 0) {
      reasons.push(
        "Some of the item's keywords match your stated preferences.",
      );
    }

    if (priorityScore >= 10) {
      reasons.push(
        "The idea aligns with one or more of your selected planning priorities.",
      );
    }

    if (budget.reason) {
      reasons.push(budget.reason);
    }

    if (conflict) {
      reasons.push(
        "Potential conflict: this idea contains wording that matches an item you asked to avoid. Review it before selecting.",
      );
    }

    if (reasons.length === 0) {
      reasons.push(
        "This is a general suggestion. Review its suitability for your event.",
      );
    }

    return {
      item,
      matchScore: clampScore(score),
      rank: 0,
      reasons,
      budgetFit: budget.fit,
      hasPreferenceConflict: conflict,
      evidence: "not_applicable" as const,
    };
  });

  // Sort by suitability; preserve original ordering for equal scores.
  ranked.sort(
    (a, b) => b.matchScore - a.matchScore,
  );

  return ranked.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/** Map the vendor service category to useful planning priorities. */
const VENDOR_PRIORITY_CATEGORIES: Record<string, string[]> = {
  venue: ["convenience", "accessibility"],
  catering: ["guest_experience", "budget"],
  decoration: ["creativity", "guest_experience"],
  photography: ["guest_experience"],
  videography: ["guest_experience"],
  entertainment: ["guest_experience", "creativity"],
  florist: ["creativity", "sustainability"],
  transportation: ["convenience", "accessibility"],
  rentals: ["budget", "convenience"],
  hair_and_makeup: ["guest_experience"],
  accommodation: ["convenience", "accessibility"],
  security: ["convenience", "accessibility"],
  accessibility: ["accessibility"],
  other: [],
};

/** Rank vendor/service suggestions without inventing business claims. */
export function rankVendorSuggestions(
  vendors: VendorSuggestion[],
  context: RecommendationContext,
): RankedRecommendation<VendorSuggestion>[] {
  const preferenceTokens = getPreferenceTokens(context);
  const mustAvoid = getMustAvoidTerms(context);

  const requestedLocation = collectTokens([
    context.location?.city,
    context.location?.region,
    context.location?.country,
  ]);

  const ranked = vendors.map((vendor) => {
    const candidateText = [
      vendor.displayName,
      vendor.description,
    ]
      .filter(Boolean)
      .join(" ");

    const candidateTokens = tokenize(candidateText);

    const preferenceRatio = keywordMatchRatio(
      preferenceTokens,
      candidateTokens,
    );

    const preferenceScore =
      preferenceTokens.size === 0
        ? 15
        : Math.round(preferenceRatio * 30);

    const vendorPriorityFit = (
      context.planningPriorities ?? []
    ).some((priority) =>
      (VENDOR_PRIORITY_CATEGORIES[vendor.serviceCategory] ?? [])
        .includes(priority),
    );

    const priorityScore = vendorPriorityFit ? 10 : 5;

    const budget = evaluateBudgetFit(
      vendor.estimatedCost,
      vendor.currency,
      context,
    );

    const locationTokens = tokenize(
      vendor.locationLabel ?? "",
    );

    const locationRatio = keywordMatchRatio(
      requestedLocation,
      locationTokens,
    );

    let locationScore = 5;
    let locationReason =
      "Location suitability is unknown or no location preference was supplied.";

    if (requestedLocation.size > 0) {
      if (locationRatio > 0) {
        locationScore = Math.round(locationRatio * 10);
        locationReason =
          "Some location terms match your requested area; confirm service coverage before booking.";
      } else if (vendor.locationLabel) {
        locationScore = 0;
        locationReason =
          "The listed location does not match your requested area; confirm whether the vendor serves your location.";
      }
    }

    const conflict = hasMustAvoidConflict(
      mustAvoid,
      candidateText,
    );

    let score =
      15 +
      preferenceScore +
      priorityScore +
      budget.score +
      locationScore;

    if (conflict) {
      score -= 35;
    }

    const reasons: string[] = [
      `Service category: ${vendor.serviceCategory.replace(/_/g, " ")}.`,
      locationReason,
    ];

    if (preferenceTokens.size > 0 && preferenceRatio > 0) {
      reasons.push(
        "Some vendor-description keywords match your stated preferences.",
      );
    }

    if (budget.reason) {
      reasons.push(budget.reason);
    }

    if (conflict) {
      reasons.push(
        "Potential conflict: this suggestion contains wording that matches an item you asked to avoid. Review it before selecting.",
      );
    }

    // Provenance is shown independently of suitability ranking.
    // The "verified" label means only that the input carries this
    // status; independent checks must be implemented elsewhere.
    let evidence: RecommendationEvidence;

    switch (vendor.sourceStatus) {
      case "verified":
        evidence = "marked_verified";
        break;
      case "source_listed":
        evidence = "source_listed";
        break;
      case "estimated":
        evidence = "estimated";
        break;
      case "illustrative":
      default:
        evidence = "illustrative";
        break;
    }

    return {
      item: vendor,
      matchScore: clampScore(score),
      rank: 0,
      reasons,
      budgetFit: budget.fit,
      hasPreferenceConflict: conflict,
      evidence,
    };
  });

  ranked.sort(
    (a, b) => b.matchScore - a.matchScore,
  );

  return ranked.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}