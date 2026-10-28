/**
 * EventoAI — Deterministic local event planner.
 *
 * The planner creates a complete structural plan without requiring
 * the Gemini API. Budget line items are planning allocations, not
 * real-world market estimates.
 */

import type { EventInput } from "@/types/event";
import type {
  BudgetItem,
  BudgetSummary,
  EventPlan,
} from "@/types/event-plan";
import type {
  EventIdeaRecommendation,
  VendorSuggestion,
} from "@/types/recommendation";

import {
  calculateBudgetSummary,
} from "@/lib/budget-engine/calculate-budget";

import {
  getBudgetWarnings,
} from "@/lib/budget-engine/validate-budget";

import type {
  BudgetWarning,
} from "@/lib/budget-engine/validate-budget";

import {
  generateTimeline,
} from "@/lib/timeline-engine/generate-timeline";

import {
  eventPlanSchema,
} from "@/lib/validation/event-plan";

import {
  MODEL_PLAN_RESPONSE_JSON_SCHEMA,
} from "@/lib/ai/plan-output-schema";

import {
  reconcileBudgetItems,
} from "@/lib/budget-engine/reconcile-budget";

type JsonSchemaNode = {
  enum?: unknown[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
};

export type LocalEventPlanResult = {
  plan: EventPlan;
  budgetSummary: BudgetSummary;
  budgetWarnings: BudgetWarning[];
};

const modelSchema =
  MODEL_PLAN_RESPONSE_JSON_SCHEMA as unknown as JsonSchemaNode;

function getSchemaEnum(path: string[]): string[] {
  let current: JsonSchemaNode = modelSchema;

  for (const part of path) {
    if (part === "items") {
      current = current.items ?? {};
    } else {
      current = current.properties?.[part] ?? {};
    }
  }

  return Array.isArray(current.enum)
    ? current.enum.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
}

function chooseEnum(
  values: string[],
  keywords: string[],
): string {
  const normalizedKeywords = keywords.map((value) =>
    value.toLowerCase(),
  );

  const match = values.find((value) =>
    normalizedKeywords.some((keyword) =>
      value.toLowerCase().includes(keyword),
    ),
  );

  return match ?? values[0] ?? "other";
}

/**
 * Allocate available spending capacity across categories.
 *
 * These percentages are a budgeting heuristic only. They do not
 * represent market research, vendor prices, or confirmed costs.
 *
 * The reserve is calculated by the same deterministic budget engine
 * used to create the API's BudgetSummary.
 */
function createBudgetItems(
  event: EventInput,
  spendingLimit: number,
  contingencyPercent: number,
): BudgetItem[] {
  const allowedCategories = getSchemaEnum([
    "budgetItems",
    "items",
    "category",
  ]);

  const budgetLimitCents = Math.round(spendingLimit * 100);

  // Find the maximum subtotal whose rounded contingency reserve
  // remains within the supplied limit.
  let allocatableCents = Math.max(
    0,
    Math.floor(
      (
        spendingLimit /
        (1 + contingencyPercent / 100) +
        Number.EPSILON
      ) * 100,
    ),
  );

  while (
    allocatableCents > 0 &&
    allocatableCents +
      Math.round(
        (allocatableCents * contingencyPercent) / 100,
      ) > budgetLimitCents
  ) {
    allocatableCents -= 1;
  }

  const specifications = [
    {
      name: "Food and beverages",
      description:
        "Budget-based planning allocation for refreshments or catering. This is not a researched price; obtain local quotations.",
      weight: 0.36,
      hints: ["catering", "food", "meal", "beverage"],
    },
    {
      name: "Venue and setup",
      description:
        "Budget-based allocation for venue-related needs and basic setup. Confirm actual venue costs before booking.",
      weight: 0.14,
      hints: ["venue", "rental", "setup", "logistics"],
    },
    {
      name: "Decorations",
      description:
        "Budget-based allocation for theme decorations and reusable styling. Compare DIY and vendor quotations.",
      weight: 0.14,
      hints: ["decor", "theme", "styling", "flowers"],
    },
    {
      name: "Cake and dessert",
      description:
        "Budget-based allocation for cake and dessert options. Confirm portions and prices with a supplier.",
      weight: 0.08,
      hints: ["cake", "dessert", "food", "catering"],
    },
    {
      name: "Activities and entertainment",
      description:
        "Budget-based allocation for guest activities and simple entertainment. This is not a confirmed supplier price.",
      weight: 0.10,
      hints: ["entertainment", "activity", "music", "games"],
    },
    {
      name: "Photography",
      description:
        "Budget-based allocation for photographs or a lower-cost alternative. Confirm actual service prices.",
      weight: 0.10,
      hints: ["photography", "photo", "media"],
    },
    {
      name: "Invitations and supplies",
      description:
        "Budget-based allocation for invitations and small event supplies. Check actual quantities and prices.",
      weight: 0.08,
      hints: ["invitation", "supplies", "stationery", "other"],
    },
  ];

  let allocatedCents = 0;

  const items = specifications.map((specification, index) => {
    // Use integer minor units so fractional currency amounts add up
    // consistently without binary floating-point allocation drift.
    const amountCents =
      index === specifications.length - 1
        ? allocatableCents - allocatedCents
        : Math.floor(allocatableCents * specification.weight);

    allocatedCents += amountCents;

    return {
      id: globalThis.crypto.randomUUID(),
      name: specification.name,

      category: chooseEnum(
        allowedCategories,
        specification.hints,
      ) as BudgetItem["category"],

      description: specification.description,
      estimatedAmount: amountCents / 100,

      // This status makes the provenance explicit. It does not claim
      // the allocated amount is an AI estimate or a market price.
      costStatus: "planning_allocation" as const,

      notes:
        "Deterministic budget allocation. Validate against actual prices before making commitments.",
    };
  });

  // Remove zero-value lines; no artificial minimum price is introduced.
  return items.filter((item) => item.estimatedAmount > 0);
}

function createLocalRecommendations(
  event: EventInput,
): EventIdeaRecommendation[] {
  const allowedCategories = getSchemaEnum([
    "recommendations",
    "items",
    "category",
  ]);

  const theme =
    event.preferences?.preferredThemes?.[0] ?? "simple";

  const location =
    event.location?.venueType ?? "chosen";

  const candidates = [
    {
      title: "Coordinated theme styling",
      description:
        `Use a small set of coordinated details based on the ${theme} theme instead of buying many separate decorations.`,
      whyItFits:
        "Keeps the event visually consistent while leaving more of the budget for essentials.",
      tags: ["theme", "budget-conscious", "decor"],
      categoryHints: ["theme", "decor", "style"],
    },
    {
      title: "Practical guest refreshments",
      description:
        "Choose a manageable menu and plan service around the guest count and event duration.",
      whyItFits:
        "Food planning has a direct effect on guest comfort and budget control.",
      tags: ["food", "guest-experience", "planning"],
      categoryHints: ["food", "catering", "guest"],
    },
    {
      title: "An optional group activity",
      description:
        "Offer a low-cost group activity that guests can join without disrupting the main event.",
      whyItFits:
        "Creates opportunities for guest interaction without depending on expensive entertainment.",
      tags: ["activity", "social", "family-friendly"],
      categoryHints: ["activity", "entertainment", "guest"],
    },
    {
      title: "Venue-specific backup plan",
      description:
        location.toLowerCase().includes("outdoor")
          ? "Identify a sheltered alternative and plan for shade, rain, power, and safe guest movement."
          : "Prepare a simple backup for timing, equipment, and last-minute attendance changes.",
      whyItFits:
        "Prevents common logistical problems from forcing expensive last-minute changes.",
      tags: ["logistics", "contingency", "practical"],
      categoryHints: ["venue", "logistics", "planning"],
    },
  ];

  return candidates.map((candidate) => ({
    id: globalThis.crypto.randomUUID(),

    title: candidate.title,

    category: chooseEnum(
      allowedCategories,
      candidate.categoryHints,
    ) as EventIdeaRecommendation["category"],

    description: candidate.description,
    whyItFits: candidate.whyItFits,
    tags: candidate.tags,
  }));
}

function createLocalVendorSuggestions(): VendorSuggestion[] {
  const allowedCategories = getSchemaEnum([
    "vendorSuggestions",
    "items",
    "serviceCategory",
  ]);

  const candidates = [
    {
      displayName: "Local catering provider",
      hints: ["catering", "food"],
      description:
        "A service category to research and compare using local quotations.",
      whyItFits:
        "Food cost and service quality can materially affect the guest experience.",
    },
    {
      displayName: "Event decor provider",
      hints: ["decor", "styling", "flowers"],
      description:
        "A service category to compare against DIY and reusable decor options.",
      whyItFits:
        "Helps establish a theme without assuming a particular supplier's prices.",
    },
    {
      displayName: "Event photography provider",
      hints: ["photography", "photo", "media"],
      description:
        "A service category to compare with the available budget and event needs.",
      whyItFits:
        "Supports event memories while allowing the user to compare different service levels.",
    },
  ];

  return candidates.map((candidate) => ({
    id: globalThis.crypto.randomUUID(),

    serviceCategory: chooseEnum(
      allowedCategories,
      candidate.hints,
    ) as VendorSuggestion["serviceCategory"],

    displayName: candidate.displayName,
    description: candidate.description,
    whyItFits: candidate.whyItFits,
    sourceStatus: "estimated" as const,
  }));
}

export function generateLocalEventPlan(
  event: EventInput,
): LocalEventPlanResult {
  const currency = event.budget.currency;
  const spendingLimit = event.budget.totalAmount!;
  const eventDate = event.eventDate!;

  const contingencyPercent =
    event.budget.contingencyPercent ?? 10;

  const initialBudgetItems = createBudgetItems(
    event,
    spendingLimit,
    contingencyPercent,
  );

  const reconciliation = reconcileBudgetItems({
    budget: {
      currency,
      spendingLimit,
      contingencyPercent,
    },
    items: initialBudgetItems,
  });

  const tasks = generateTimeline({
    eventType: event.eventType,
    eventDate,
  });

  const preferredTheme =
    event.preferences?.preferredThemes?.[0] ?? "flexible";

  const preferredStyles =
    event.preferences?.preferredStyles?.join(", ") ?? "practical";

  const location = [
    event.location?.city,
    event.location?.country,
  ]
    .filter(Boolean)
    .join(", ") || "the selected location";

  const priorities =
    event.planningPriorities?.join(", ") || "overall event quality";

  const assumptions = [
    "The local plan is available without an AI provider request.",

    "Budget line items are deterministic allocations based on the user's spending limit, not researched market prices or AI-generated cost estimates.",

    "The allocations do not establish whether the requested budget is sufficient for the event at current local prices.",

    "The contingency reserve is calculated using the requested contingency percentage and is included in the projected event total.",

    "Obtain current local quotations for important costs before committing money.",

    "Suggested service categories do not confirm vendor identity, availability, or booking.",
  ];

  if (!reconciliation.withinBudget) {
    assumptions.push(
      `The calculated plan exceeds the spending limit by ${reconciliation.overBudgetAmount.toFixed(2)}. Expense amounts were preserved; review the plan and make explicit changes before booking.`,
    );
  }

  const plan = eventPlanSchema.parse({
    summary:
      `${event.title}: a ${preferredStyles} ${preferredTheme} ` +
      `${event.eventType} event for ${event.guestCount} guests in ${location}. ` +
      `The plan prioritizes ${priorities} using deterministic budget ` +
      `allocations and timeline generation. Allocations are not verified prices.`,

    budget: {
      currency,
      spendingLimit,
      contingencyPercent,
      items: reconciliation.items,
    },

    tasks,

    recommendations: createLocalRecommendations(event),

    vendorSuggestions: createLocalVendorSuggestions(),

    assumptions,
  });

  const budgetSummary = calculateBudgetSummary(plan.budget);

  const budgetWarnings = getBudgetWarnings(
    plan.budget,
    budgetSummary,
  );

  return {
    plan,
    budgetSummary,
    budgetWarnings,
  };
}