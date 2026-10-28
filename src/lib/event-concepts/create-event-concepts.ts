import type { PlanResult } from "@/components/planner/event-planner";
import type { SavedEventInput } from "@/types/saved-event";

export type EventConceptId = "value" | "balanced" | "experience";

export type EventConcept = {
  id: EventConceptId;
  badge: string;
  title: string;
  subtitle: string;
  direction: string;
  guestExperience: string;
  budgetStrategy: string;
  tradeoff: string;
  result: PlanResult;
};

type ConceptProfile = {
  id: EventConceptId;
  badge: string;
  subtitle: string;
  direction: string;
  guestExperience: string;
  budgetStrategy: string;
  tradeoff: string;
  summaryLine: string;
  multipliers: Record<string, number>;
  keywords: string[];
};

const PROFILES: ConceptProfile[] = [
  {
    id: "value",
    badge: "VALUE-LED",
    subtitle: "Make the essentials feel special.",
    direction:
      "A thoughtful celebration that favors meaningful details, simpler production, and deliberate spending.",
    guestExperience:
      "Personal touches and well-chosen activities take priority over expensive extras.",
    budgetStrategy:
      "Redistribute planned allocations toward essentials while simplifying optional production costs.",
    tradeoff:
      "Expect a more hands-on approach and fewer high-cost decorative or entertainment extras.",
    summaryLine:
      "Selected direction: a thoughtful, value-led celebration centered on essential needs and personal details.",
    multipliers: {
      venue: 1.04,
      catering: 1.15,
      decoration: 0.62,
      photography: 0.68,
      entertainment: 0.70,
      attire: 0.80,
      transportation: 0.92,
      invitations: 0.50,
      gifts: 0.70,
      equipment: 0.82,
      staffing: 0.88,
      accommodation: 0.86,
      permits: 1,
      contingency: 1,
      miscellaneous: 0.78,
      other: 0.82,
    },
    keywords: [
      "budget", "affordable", "simple", "diy", "reuse",
      "handmade", "value", "personal", "practical",
    ],
  },
  {
    id: "balanced",
    badge: "BALANCED",
    subtitle: "A considered mix of essentials and standout moments.",
    direction:
      "A balanced design direction combining practical event needs with personalized moments for guests.",
    guestExperience:
      "The overall plan shares attention across comfort, atmosphere, food, and memorable activities.",
    budgetStrategy:
      "Retain the original planning allocation mix as the baseline for comparison.",
    tradeoff:
      "The plan aims for balance rather than maximizing a single feature.",
    summaryLine:
      "Selected direction: a balanced celebration combining practical essentials with memorable personal details.",
    multipliers: {
      venue: 1,
      catering: 1,
      decoration: 1,
      photography: 1,
      entertainment: 1,
      attire: 1,
      transportation: 1,
      invitations: 1,
      gifts: 1,
      equipment: 1,
      staffing: 1,
      accommodation: 1,
      permits: 1,
      contingency: 1,
      miscellaneous: 1,
      other: 1,
    },
    keywords: [
      "guest", "personalization", "theme", "family",
      "interactive", "memorable", "comfort", "experience",
    ],
  },
  {
    id: "experience",
    badge: "EXPERIENCE-LED",
    subtitle: "Make the atmosphere part of the memory.",
    direction:
      "A more immersive celebration that gives additional planning attention to atmosphere, activities, and visual moments.",
    guestExperience:
      "The direction emphasizes engaging activities, cohesive styling, and memorable moments.",
    budgetStrategy:
      "Shift planned allocations toward entertainment, decor, photography, and experiential details.",
    tradeoff:
      "Some optional extras elsewhere may need to be simplified; actual supplier prices still require confirmation.",
    summaryLine:
      "Selected direction: an experience-led celebration prioritizing atmosphere, guest engagement, and distinctive moments.",
    multipliers: {
      venue: 0.92,
      catering: 1.08,
      decoration: 1.35,
      photography: 1.32,
      entertainment: 1.48,
      attire: 1.10,
      transportation: 0.95,
      invitations: 0.78,
      gifts: 1.12,
      equipment: 1.25,
      staffing: 1.12,
      accommodation: 1,
      permits: 1,
      contingency: 1,
      miscellaneous: 1.05,
      other: 1.08,
    },
    keywords: [
      "entertainment", "music", "photo", "immersive",
      "stage", "experience", "decor", "performance",
      "visual", "activity", "interactive",
    ],
  },
];

const TITLES: Record<string, [string, string, string]> = {
  birthday: [
    "Joyful & Personal",
    "The Signature Birthday",
    "A Birthday to Remember",
  ],
  wedding: [
    "Intimate & Intentional",
    "The Signature Wedding",
    "A Wedding to Remember",
  ],
  anniversary: [
    "Meaningful Moments",
    "The Signature Anniversary",
    "An Evening to Remember",
  ],
  community: [
    "Community First",
    "The Signature Gathering",
    "A Festival of Connection",
  ],
  corporate: [
    "Purposeful & Polished",
    "The Signature Experience",
    "High-Impact Experience",
  ],
};

function getTitles(eventType: string): [string, string, string] {
  const normalized = eventType.trim().toLowerCase();

  return TITLES[normalized] ?? [
    "Thoughtfully Planned",
    "The Signature Celebration",
    "An Experience to Remember",
  ];
}

function classifyBudgetItem(
  category: string,
  name: string,
): string {
  const text = `${category} ${name}`.toLowerCase();

  if (/cater|food|meal|beverage|refreshment/.test(text)) return "catering";
  if (/venue|rental|location/.test(text)) return "venue";
  if (/decor|flower|styling|theme/.test(text)) return "decoration";
  if (/photo|video|camera|media/.test(text)) return "photography";
  if (/entertain|music|perform|activity|game|dj/.test(text)) return "entertainment";
  if (/attire|clothing|dress|outfit/.test(text)) return "attire";
  if (/transport|travel|parking/.test(text)) return "transportation";
  if (/invitation|stationery|printing/.test(text)) return "invitations";
  if (/gift|favor|return gift/.test(text)) return "gifts";
  if (/equipment|sound|lighting|screen/.test(text)) return "equipment";
  if (/staff|security|service crew/.test(text)) return "staffing";
  if (/accommodation|hotel|lodging/.test(text)) return "accommodation";
  if (/permit|license/.test(text)) return "permits";
  if (/contingency|reserve/.test(text)) return "contingency";
  if (/miscellaneous|suppl|other/.test(text)) return "miscellaneous";

  return "other";
}

function rebalancePlanningAllocations(
  items: PlanResult["plan"]["budget"]["items"],
  profile: ConceptProfile,
) {
  const allocations = items.filter(
    (item) => item.costStatus === "planning_allocation",
  );

  if (allocations.length < 2) {
    return items.map((item) => ({ ...item }));
  }

  const originalCents = allocations.map((item) =>
    Math.max(0, Math.round(item.estimatedAmount * 100)),
  );

  const totalCents = originalCents.reduce(
    (sum, amount) => sum + amount,
    0,
  );

  if (totalCents <= 0) {
    return items.map((item) => ({ ...item }));
  }

  const weighted = allocations.map((item, index) => {
    const category = classifyBudgetItem(item.category, item.name);
    const multiplier = profile.multipliers[category] ?? 1;

    return {
      id: item.id,
      weight: originalCents[index] * multiplier,
    };
  });

  const weightTotal = weighted.reduce(
    (sum, item) => sum + item.weight,
    0,
  );

  if (weightTotal <= 0) {
    return items.map((item) => ({ ...item }));
  }

  let assignedCents = 0;

  const newAmounts = weighted.map((item, index) => {
    const amountCents =
      index === weighted.length - 1
        ? totalCents - assignedCents
        : Math.floor((totalCents * item.weight) / weightTotal);

    assignedCents += amountCents;

    return [item.id, amountCents / 100] as const;
  });

  const amountsById = new Map(newAmounts);

  return items.map((item) => {
    if (item.costStatus !== "planning_allocation") {
      // Do not modify quoted, confirmed, or actual financial records.
      return { ...item };
    }

    return {
      ...item,
      estimatedAmount: amountsById.get(item.id) ?? item.estimatedAmount,
    };
  });
}

function activeAmountCents(
  item: PlanResult["plan"]["budget"]["items"][number],
): number {
  let amount = item.estimatedAmount;

  if (item.costStatus === "actual") {
    amount = item.actualAmount ?? item.estimatedAmount;
  } else if (
    item.costStatus === "vendor_quote" ||
    item.costStatus === "confirmed"
  ) {
    amount = item.quotedAmount ?? item.estimatedAmount;
  }

  return Math.round(amount * 100);
}

function categoryTotals(
  items: PlanResult["plan"]["budget"]["items"],
  baseline: PlanResult["budgetSummary"]["byCategory"],
) {
  const totals = new Map<string, { cents: number; itemCount: number }>();

  for (const item of items) {
    const current = totals.get(item.category) ?? {
      cents: 0,
      itemCount: 0,
    };

    current.cents += activeAmountCents(item);
    current.itemCount += 1;
    totals.set(item.category, current);
  }

  const originalOrder = new Map(
    baseline.map((entry, index) => [entry.category, index]),
  );

  return [...totals.entries()]
    .sort(([a], [b]) => {
      const aIndex = originalOrder.get(a) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = originalOrder.get(b) ?? Number.MAX_SAFE_INTEGER;

      return aIndex - bIndex || a.localeCompare(b);
    })
    .map(([category, value]) => ({
      category,
      amount: value.cents / 100,
      itemCount: value.itemCount,
    }));
}

function rankRecommendations(
  result: PlanResult,
  keywords: string[],
) {
  return result.plan.recommendations
    .map((recommendation, index) => {
      const text = [
        recommendation.title,
        recommendation.category,
        recommendation.description,
        recommendation.whyItFits,
        ...recommendation.tags,
      ]
        .join(" ")
        .toLowerCase();

      const score = keywords.reduce(
        (sum, keyword) => sum + (text.includes(keyword) ? 1 : 0),
        0,
      );

      return { recommendation, index, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.index - b.index,
    )
    .map((entry) => entry.recommendation);
}

export function createEventConcepts(
  baseResult: PlanResult,
  input: SavedEventInput,
): EventConcept[] {
  const titles = getTitles(input.eventType);

  return PROFILES.map((profile, index) => {
    const items = rebalancePlanningAllocations(
      baseResult.plan.budget.items,
      profile,
    );

    const result: PlanResult = {
      ...baseResult,
      plan: {
        ...baseResult.plan,
        summary: `${profile.summaryLine}\n\n${baseResult.plan.summary}`,
        budget: {
          ...baseResult.plan.budget,
          items,
        },
        recommendations: rankRecommendations(
          baseResult,
          profile.keywords,
        ),
      },
      budgetSummary: {
        ...baseResult.budgetSummary,
        // Overall totals remain unchanged because the allocation pool is
        // conserved. Recalculate category totals to reflect the new mix.
        byCategory: categoryTotals(
          items,
          baseResult.budgetSummary.byCategory,
        ),
      },
    };

    return {
      id: profile.id,
      badge: profile.badge,
      title: titles[index],
      subtitle: profile.subtitle,
      direction: profile.direction,
      guestExperience: profile.guestExperience,
      budgetStrategy: profile.budgetStrategy,
      tradeoff: profile.tradeoff,
      result,
    };
  });
}
