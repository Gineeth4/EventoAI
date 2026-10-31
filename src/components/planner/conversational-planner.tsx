"use client";
import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flower2,
  Heart,
  Lightbulb,
  LoaderCircle,
  MapPin,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import StudioChoiceCard from "@/components/ui/studio-choice-card";
import ConversationReviewPanel from "@/components/planner/conversation-review-panel";
import ConversationBudgetStep from "@/components/planner/conversation-budget-step";

import EventConceptSelector from "@/components/planner/event-concept-selector";
import {
  createEventConcepts,
  type EventConcept,
} from "@/lib/event-concepts/create-event-concepts";
import PlanRefinementPanel from "@/components/planner/plan-refinement-panel";
import type { PlanResult } from "@/components/planner/event-planner";
import {
  inferEventBriefFromText,
  type InferredEventDetails,
} from "@/lib/event-brief-inference";
import { saveEventRecord } from "@/lib/saved-events";
import VendorPricingPanel from "@/components/planner/vendor-pricing-panel";
import { saveCloudEvent } from "@/lib/cloud-events";
import {
  analyzeEventBrief,
  type EventBriefForAnalysis,
} from "@/lib/planning-intelligence/analyze-event-brief";
import { eventInputSchema } from "@/lib/validation/event-input";
import type { SavedEventInput } from "@/types/saved-event";
import type { ConversationDraft } from "@/types/conversation-draft";

type Step =
  | "idea"
  | "occasion"
  | "date"
  | "guests"
  | "location"
  | "budget"
  | "style"
  | "review";



type PlanApiResponse = {
  success?: boolean;
  data?: PlanResult;
  error?: {
    message?: string;
  };
};

const DRAFT_KEY = "eventoai:conversation-draft:v1";
const SERVER_DRAFT_SNAPSHOT = "__eventoai_server_snapshot__";
const EMPTY_DRAFT_SNAPSHOT = "__eventoai_empty_snapshot__";
const REQUEST_TIMEOUT_MS = 12_000;

type RestoredConversationState = {
  draft: ConversationDraft;
  step: Step;
  history: Step[];
};

/**
 * Read the saved snapshot without modifying React state.
 *
 * During server rendering, useSyncExternalStore receives the stable
 * server snapshot. After hydration, React reads the browser snapshot
 * and mounts the planner with the saved conversation, if one exists.
 */
function getDraftSnapshot(): string {
  if (typeof window === "undefined") {
    return SERVER_DRAFT_SNAPSHOT;
  }

  try {
    return (
      window.sessionStorage.getItem(DRAFT_KEY) ??
      EMPTY_DRAFT_SNAPSHOT
    );
  } catch {
    return EMPTY_DRAFT_SNAPSHOT;
  }
}

function getServerDraftSnapshot(): string {
  return SERVER_DRAFT_SNAPSHOT;
}

/**
 * The draft is managed by React after the initial browser snapshot
 * has been read. No external subscription is needed for subsequent
 * local edits because they are represented by component state.
 */
function subscribeToDraftSnapshot(): () => void {
  return () => {};
}

const EVENT_TYPES = [
  {
    value: "birthday",
    label: "Birthday",
    description: "Make it personal, joyful and memorable.",
    icon: Sparkles,
  },
  {
    value: "wedding",
    label: "Wedding",
    description: "Bring your vision and the important details together.",
    icon: Heart,
  },
  {
    value: "anniversary",
    label: "Anniversary",
    description: "Celebrate a milestone or a relationship.",
    icon: Flower2,
  },
  {
    value: "community",
    label: "Community",
    description: "Bring people together around a shared purpose.",
    icon: Users,
  },
  {
    value: "corporate",
    label: "Corporate",
    description: "Plan a professional gathering or company event.",
    icon: CalendarDays,
  },
] as const;

const THEME_CHOICES = [
  {
    value: "botanical",
    label: "Botanical",
    description: "Natural textures and greenery.",
  },
  {
    value: "modern",
    label: "Modern",
    description: "Clean shapes and contemporary details.",
  },
  {
    value: "elegant",
    label: "Elegant",
    description: "Considered details and refined styling.",
  },
  {
    value: "rustic",
    label: "Rustic",
    description: "Warm materials and a relaxed atmosphere.",
  },
  {
    value: "playful",
    label: "Playful",
    description: "Colour, creativity and energy.",
  },
  {
    value: "cultural",
    label: "Cultural",
    description: "Traditions and meaningful rituals.",
  },
] as const;

const STYLE_CHOICES = [
  {
    value: "family-friendly",
    label: "Family-friendly",
    description: "Comfortable for different ages.",
  },
  {
    value: "relaxed",
    label: "Relaxed",
    description: "Informal and easygoing.",
  },
  {
    value: "practical",
    label: "Practical",
    description: "Simple to organize and manage.",
  },
  {
    value: "premium",
    label: "Premium",
    description: "More polished, elevated details.",
  },
  {
    value: "playful",
    label: "Fun and playful",
    description: "Lively, engaging and expressive.",
  },
  {
    value: "minimalist",
    label: "Minimalist",
    description: "Intentional, simple and uncluttered.",
  },
] as const;

const GUEST_OPTIONS = [
  { label: "1-10 people", value: 8 },
  { label: "11-25 people", value: 20 },
  { label: "26-50 people", value: 40 },
  { label: "51-100 people", value: 75 },
  { label: "100+ people", value: 120 },
];



function createEmptyDraft(): ConversationDraft {
  return {
    idea: "",
    eventType: "",
    title: "",
    eventDate: "",
    guestCount: "",
    city: "",
    country: "",
    venueType: "",
    currency: "",
    totalAmount: "",
    contingencyPercent: "10",
    contingencyChosen: false,
    themes: [],
    styles: [],
    notes: "",
    planningPriorities: [],
    assumptions: [],
  };
}

function isStep(value: unknown): value is Step {
  return [
    "idea",
    "occasion",
    "date",
    "guests",
    "location",
    "budget",
    "style",
    "review",
  ].includes(String(value));
}

function normalizeStoredDraft(
  value: unknown,
): ConversationDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  const stringValue = (key: string, fallback = "") =>
    typeof raw[key] === "string"
      ? (raw[key] as string)
      : fallback;

  const stringArray = (key: string): string[] =>
    Array.isArray(raw[key])
      ? raw[key]
          .filter(
            (item): item is string =>
              typeof item === "string",
          )
          .slice(0, 20)
      : [];

  const venueType = raw.venueType;

  return {
    ...createEmptyDraft(),
    idea: stringValue("idea").slice(0, 600),
    eventType: stringValue("eventType"),
    title: stringValue("title").slice(0, 160),
    eventDate: stringValue("eventDate"),
    guestCount: stringValue("guestCount"),
    city: stringValue("city").slice(0, 100),
    country: stringValue("country").slice(0, 100),
    venueType:
      venueType === "indoor" || venueType === "outdoor"
        ? venueType
        : "",
    currency: stringValue("currency"),
    totalAmount: stringValue("totalAmount"),
    contingencyPercent: stringValue(
      "contingencyPercent",
      "10",
    ),
    contingencyChosen: raw.contingencyChosen === true,
    themes: stringArray("themes"),
    styles: stringArray("styles"),
    notes: stringValue("notes").slice(0, 500),
    planningPriorities: stringArray("planningPriorities"),
    assumptions: stringArray("assumptions"),
  };
}

function restoreConversationState(
  snapshot: string,
): RestoredConversationState {
  const fallback: RestoredConversationState = {
    draft: createEmptyDraft(),
    step: "idea",
    history: ["idea"],
  };

  if (
    snapshot === EMPTY_DRAFT_SNAPSHOT ||
    snapshot === SERVER_DRAFT_SNAPSHOT
  ) {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(snapshot);

    if (typeof parsed !== "object" || parsed === null) {
      return fallback;
    }

    const raw = parsed as {
      draft?: unknown;
      step?: unknown;
      history?: unknown;
    };

    const normalizedDraft = normalizeStoredDraft(raw.draft);
    const restoredStep = isStep(raw.step) ? raw.step : "idea";

    const restoredHistory = Array.isArray(raw.history)
      ? raw.history.filter(isStep)
      : [];

    return {
      draft: normalizedDraft ?? createEmptyDraft(),
      step: restoredStep,
      history:
        restoredHistory.length > 0
          ? restoredHistory
          : [restoredStep],
    };
  } catch {
    return fallback;
  }
}

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function nextRequiredStep(draft: ConversationDraft): Step {
  if (!draft.eventType) return "occasion";
  if (!isValidDateOnly(draft.eventDate)) return "date";

  const guests = Number(draft.guestCount);

  if (
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 10_000
  ) {
    return "guests";
  }

  if (
    !draft.city.trim() ||
    !draft.country.trim() ||
    !draft.venueType
  ) {
    return "location";
  }

  const amount = Number(draft.totalAmount);

  if (
    !draft.currency ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return "budget";
  }

  if (!draft.themes.length || !draft.styles.length) {
    return "style";
  }

  return "review";
}

function currencyForCountry(
  country: string,
): string | undefined {
  const normalized = country.trim().toLowerCase();

  if (normalized === "india" || normalized === "in") {
    return "INR";
  }

  if (
    normalized === "united states" ||
    normalized === "united states of america" ||
    normalized === "usa" ||
    normalized === "us"
  ) {
    return "USD";
  }

  if (
    normalized === "united kingdom" ||
    normalized === "uk" ||
    normalized === "great britain"
  ) {
    return "GBP";
  }

  if (
    [
      "france",
      "germany",
      "italy",
      "spain",
      "netherlands",
      "ireland",
      "portugal",
      "belgium",
      "austria",
      "finland",
      "greece",
    ].includes(normalized)
  ) {
    return "EUR";
  }

  return undefined;
}

function formatMoney(amount: number, currency: string): string {
  return formatCurrencyShared(amount, currency);
}

function formatDate(value: string): string {
  if (!isValidDateOnly(value)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function readableLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferIntoDraft(
  draft: ConversationDraft,
  inferred: InferredEventDetails,
): ConversationDraft {
  return {
    ...draft,
    eventType: draft.eventType || inferred.eventType || "",
    title: draft.title || inferred.title,
    eventDate: draft.eventDate || inferred.eventDate || "",
    guestCount:
      draft.guestCount ||
      (inferred.guestCount
        ? String(inferred.guestCount)
        : ""),
    currency: draft.currency || inferred.currency || "",
    totalAmount:
      draft.totalAmount ||
      (inferred.totalAmount
        ? String(inferred.totalAmount)
        : ""),
    venueType:
      draft.venueType || inferred.venueType || "",
    themes: draft.themes.length
      ? draft.themes
      : inferred.themes,
    styles: draft.styles.length
      ? draft.styles
      : inferred.styles,
  };
}

function toggleItem(
  items: string[],
  value: string,
): string[] {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function buildPayload(
  draft: ConversationDraft,
): SavedEventInput {
  const assumptions = [...draft.assumptions];

  if (!draft.contingencyChosen) {
    assumptions.push(
      "A 10% contingency reserve is a starting assumption and can be changed.",
    );
  }

  const priorities = draft.planningPriorities.length
    ? draft.planningPriorities
    : ["budget", "guest_experience"];

  if (!draft.planningPriorities.length) {
    assumptions.push(
      "Budget control and guest experience are the initial planning priorities.",
    );
  }

  const notes = [
    draft.idea.trim(),
    draft.notes.trim(),
    assumptions.length
      ? `Planning assumptions: ${assumptions.join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 600);

  return {
    eventType: draft.eventType,
    title: draft.title.trim(),
    eventDate: draft.eventDate,
    guestCount: Number(draft.guestCount),
    location: {
      city: draft.city.trim(),
      country: draft.country.trim(),
      venueType: draft.venueType,
    },
    budget: {
      currency: draft.currency,
      totalAmount: Number(draft.totalAmount),
      contingencyPercent: Number(
        draft.contingencyPercent || "10",
      ),
    },
    preferences: {
      preferredThemes: draft.themes,
      preferredStyles: draft.styles,
      notes,
    },
    planningPriorities: [...new Set(priorities)],
  };
}

function buildPlanningBrief(
  draft: ConversationDraft,
): EventBriefForAnalysis {
  return {
    eventType: draft.eventType,
    title: draft.title,
    eventDate: draft.eventDate,
    guestCount: Number(draft.guestCount),
    location: {
      city: draft.city,
      country: draft.country,
      venueType: draft.venueType,
    },
    budget: {
      currency: draft.currency,
      totalAmount: Number(draft.totalAmount),
      contingencyPercent: Number(
        draft.contingencyPercent || "10",
      ),
    },
    preferences: {
      preferredThemes: draft.themes,
      preferredStyles: draft.styles,
      notes: draft.notes,
    },
    planningPriorities: draft.planningPriorities,
  };
}
function StepProgress({ step }: { step: Step }) {
  const progress =
    step === "idea"
      ? 14
      : step === "occasion" ||
          step === "date" ||
          step === "guests"
        ? 32
        : step === "location" || step === "budget"
          ? 54
          : step === "style"
            ? 73
            : 90;

  const labels = [
    { title: "Your idea", steps: ["idea"] },
    {
      title: "The essentials",
      steps: [
        "occasion",
        "date",
        "guests",
        "location",
        "budget",
      ],
    },
    { title: "Your direction", steps: ["style"] },
    { title: "Review", steps: ["review"] },
  ];

  return (
    <div className="conversation-progress">
      <div className="conversation-progress-top">
        <span>Your planning journey</span>
        <span>{progress}%</span>
      </div>

      <div
        className="conversation-progress-track"
        role="progressbar"
        aria-label="Planning brief progress"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="conversation-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="conversation-progress-labels">
        {labels.map((label) => {
          const active = label.steps.includes(step);

          return (
            <span
              className={active ? "is-active" : ""}
              key={label.title}
            >
              {active && (
                <Check size={11} aria-hidden="true" />
              )}
              {label.title}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PlanResultPanel({
  result,
  input,
  saved,
  saving,
  saveMessage,
  approved,
  onSave,
  onApprove,
  onPlanChange,
  onRevise,
  onStartOver,
}: {
  result: PlanResult;
  input: SavedEventInput;
  saved: boolean;
  saving: boolean;
  saveMessage: string;
  approved: boolean;
  onSave: () => void;
  onApprove: () => void;
  onPlanChange: (result: PlanResult, input: SavedEventInput) => void;
  onRevise: () => void;
  onStartOver: () => void;
}) {
  const categories = result.budgetSummary.byCategory;

  const maxCategoryAmount = Math.max(
    1,
    ...categories.map((category) => category.amount),
  );

  const orderedTasks = [...result.plan.tasks]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6);

  return (
    <div className="conversation-result">
      <div className="conversation-result-top">
        <div>
          <span className="conversation-eyebrow">
            <CheckCircle2 size={15} aria-hidden="true" />
            YOUR FIRST PLAN
          </span>

          <h1>{input.title}</h1>
          <p>{result.plan.summary}</p>
        </div>

        <span
          className={`conversation-result-status ${
            result.generationMode === "ai_enhanced"
              ? "is-ai"
              : "is-local"
          }`}
        >
          <Sparkles size={14} aria-hidden="true" />
          {result.generationMode === "ai_enhanced"
            ? "AI-enhanced"
            : "Local plan"}
        </span>
      </div>

      <div className="conversation-result-meta">
        <span>
          <CalendarDays size={14} aria-hidden="true" />
          {formatDate(input.eventDate)}
        </span>
        <span>
          <Users size={14} aria-hidden="true" />
          {input.guestCount} guests
        </span>
        <span>
          <MapPin size={14} aria-hidden="true" />
          {input.location.city}, {input.location.country}
        </span>
      </div>



      <section className="conversation-visual-overview" aria-label="Event workspace overview">
  <div className="conversation-visual-overview-heading">
    <div>
      <span className="conversation-eyebrow">YOUR EVENT WORKSPACE</span>
      <h2>Every important detail, in one place.</h2>
      <p>
        Review your budget, preparation schedule, ideas, and vendors.
        You can return to your plan before approving or saving it.
      </p>
    </div>

    <span
      className={`conversation-overview-approval ${
        approved ? "is-approved" : ""
      }`}
    >
      {approved ? "Plan approved" : "Approval needed"}
    </span>
  </div>

  <nav
    className="conversation-workspace-nav"
    aria-label="Jump to a section of your event plan"
  >
    <a href="#workspace-budget">Budget overview</a>
    <a href="#workspace-timeline">Preparation timeline</a>

    {result.plan.recommendations.length > 0 && (
      <a href="#workspace-ideas">Personalized ideas</a>
    )}

    {result.plan.vendorSuggestions.length > 0 && (
      <a href="#workspace-vendors">Vendor shortlist</a>
    )}
  </nav>

  <div className="conversation-overview-metrics">
    <article className="conversation-overview-card">
      <span>Budget utilization</span>
      <strong>
        {result.budgetSummary.spendingLimit > 0
          ? Math.round(
              (result.budgetSummary.projectedTotal /
                result.budgetSummary.spendingLimit) *
                100,
            )
          : 0}%
      </strong>
      <small>Based on the projected total</small>
    </article>

    <article className="conversation-overview-card">
      <span>Budget position</span>
      <strong
        className={
          result.budgetSummary.isWithinBudget
            ? "conversation-positive"
            : "conversation-negative"
        }
      >
        {result.budgetSummary.isWithinBudget
          ? "Within budget"
          : "Over budget"}
      </strong>
      <small>
        {formatMoney(
          Math.abs(result.budgetSummary.remainingBudget),
          result.budgetSummary.currency,
        )}{" "}
        {result.budgetSummary.isWithinBudget
          ? "remaining"
          : "over the limit"}
      </small>
    </article>

    <article className="conversation-overview-card">
      <span>Preparation tasks</span>
      <strong>{result.plan.tasks.length}</strong>
      <small>
        {orderedTasks.length} tasks shown in the preview below
      </small>
    </article>

    <article className="conversation-overview-card">
      <span>Ideas and vendors</span>
      <strong>
        {result.plan.recommendations.length +
          result.plan.vendorSuggestions.length}
      </strong>
      <small>Suggestions to explore and verify</small>
    </article>
  </div>
</section>

<section
        className={`conversation-approval-panel ${
          approved ? "is-approved" : ""
        }`}
        aria-label="Plan approval"
      >
        <div>
          <span className="conversation-eyebrow">
            {approved ? "APPROVAL RECORDED" : "YOUR DECISION"}
          </span>
          <h2>
            {approved
              ? "This plan is approved"
              : "Review your plan before approving"}
          </h2>
          <p>
            {approved
              ? "You can save this approved version. Any accepted change will require approval again."
              : "Inspect the budget, assumptions, and timeline below. Approval is required before the plan can be saved."}
          </p>
        </div>
        <button
          type="button"
          className="studio-button studio-button--primary"
          onClick={onApprove}
          disabled={approved}
        >
          {approved ? "Plan approved" : "Approve this plan"}
          <CheckCircle2 size={16} aria-hidden="true" />
        </button>
      </section>

      <PlanRefinementPanel
        result={result}
        input={input}
        onAccept={onPlanChange}
      />
      {result.generationMode === "local_fallback" && (
        <div className="conversation-result-notice">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            AI enhancement was unavailable, so the local planning
            rules created this plan. Planning allocations are not
            verified market prices.
          </p>
        </div>
      )}

      <section id="workspace-budget" className="conversation-result-section">
        <div className="conversation-result-section-heading">
          <div>
            <span className="conversation-eyebrow">
              THE NUMBERS
            </span>
            <h2>Your budget at a glance</h2>
          </div>

          <span className="conversation-result-icon">
            <Wallet size={19} aria-hidden="true" />
          </span>
        </div>

        <div className="conversation-metrics">
          <article>
            <span>Spending limit</span>
            <strong>
              {formatMoney(
                result.budgetSummary.spendingLimit,
                result.budgetSummary.currency,
              )}
            </strong>
          </article>

          <article>
            <span>Projected total</span>
            <strong>
              {formatMoney(
                result.budgetSummary.projectedTotal,
                result.budgetSummary.currency,
              )}
            </strong>
          </article>

          <article>
            <span>Reserve</span>
            <strong>
              {formatMoney(
                result.budgetSummary.contingencyReserve,
                result.budgetSummary.currency,
              )}
            </strong>
          </article>

          <article>
            <span>
              {result.budgetSummary.isWithinBudget
                ? "Remaining"
                : "Over budget"}
            </span>
            <strong
              className={
                result.budgetSummary.isWithinBudget
                  ? "conversation-positive"
                  : "conversation-negative"
              }
            >
              {formatMoney(
                Math.abs(
                  result.budgetSummary.remainingBudget,
                ),
                result.budgetSummary.currency,
              )}
            </strong>
          </article>
        </div>

        <div className="conversation-budget-progress">
          <div className="conversation-budget-progress-heading">
            <span>Budget utilization</span>
            <strong>
              {result.budgetSummary.spendingLimit > 0
                ? Math.round(
                    (result.budgetSummary.projectedTotal /
                      result.budgetSummary.spendingLimit) *
                      100,
                  )
                : 0}
              %
            </strong>
          </div>

          <div className="conversation-budget-track">
            <div
              className={
                result.budgetSummary.isWithinBudget
                  ? "conversation-budget-fill"
                  : "conversation-budget-fill is-over"
              }
              style={{
                width: `${
                  result.budgetSummary.spendingLimit > 0
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          (result.budgetSummary.projectedTotal /
                            result.budgetSummary.spendingLimit) *
                            100,
                        ),
                      )
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div className="conversation-category-chart">
            <h3>Where the budget goes</h3>

            {categories.map((category, index) => (
              <div
                className="conversation-category-row"
                key={category.category}
              >
                <div className="conversation-category-top">
                  <span>
                    {readableLabel(category.category)}
                  </span>
                  <strong>
                    {formatMoney(
                      category.amount,
                      result.budgetSummary.currency,
                    )}
                  </strong>
                </div>

                <div className="conversation-category-track">
                  <div
                    className={`conversation-category-fill tone-${index % 4}`}
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          (category.amount /
                            maxCategoryAmount) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="conversation-fineprint">
          Allocations, AI estimates, market estimates, quotes and
          actual spending are different things. Confirm prices
          before committing money.
        </p>
      </section>

      {result.budgetWarnings.length > 0 && (
        <section className="conversation-result-section">
          <div className="conversation-result-section-heading">
            <div>
              <span className="conversation-eyebrow">
                PLEASE REVIEW
              </span>
              <h2>Budget checks</h2>
            </div>
          </div>

          <div className="conversation-warning-list">
            {result.budgetWarnings.map((warning, index) => (
              <div
                className={`conversation-warning is-${warning.severity}`}
                key={`${warning.code}-${index}`}
              >
                <ShieldCheck size={16} aria-hidden="true" />
                <p>{warning.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="workspace-timeline" className="conversation-result-section">
        <div className="conversation-result-section-heading">
          <div>
            <span className="conversation-eyebrow">
              YOUR NEXT MOVES
            </span>
            <h2>Preparation timeline</h2>
          </div>

          <span className="conversation-result-icon">
            <Clock3 size={19} aria-hidden="true" />
          </span>
        </div>

        <div className="conversation-task-list">
          {orderedTasks.map((task, index) => (
            <article
              className="conversation-task"
              key={task.id}
            >
              <span className="conversation-task-number">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="conversation-task-body">
                <strong>{task.title}</strong>
                {task.description && (
                  <p>{task.description}</p>
                )}

                <div className="conversation-task-meta">
                  <span>{formatDate(task.dueDate)}</span>
                  <span>
                    {readableLabel(task.priority)} priority
                  </span>
                  <span>{readableLabel(task.status)}</span>
                </div>
              </div>
            </article>
          ))}

          {result.plan.tasks.length > orderedTasks.length && (
            <p className="conversation-fineprint">
              Showing the first {orderedTasks.length} of{" "}
              {result.plan.tasks.length} tasks. Save your plan
              to review the full timeline in My Events.
            </p>
          )}
        </div>
      </section>

      {result.plan.vendorSuggestions.length > 0 && (
  <section
    id="workspace-vendors"
    className="conversation-result-section conversation-vendor-section"
  >
    <div className="conversation-result-section-heading">
      <div>
        <span className="conversation-eyebrow">VENDOR DISCOVERY</span>
        <h2>Your vendor shortlist</h2>
      </div>

      <span className="conversation-vendor-count">
        {result.plan.vendorSuggestions.length} suggestions
      </span>
    </div>

    <div className="conversation-vendor-grid">
      {result.plan.vendorSuggestions.slice(0, 4).map((vendor) => (
        <article className="conversation-vendor-card" key={vendor.id}>
          <div className="conversation-vendor-card-top">
            <span className="conversation-vendor-category">
              {readableLabel(vendor.serviceCategory)}
            </span>

            <span className="conversation-vendor-status">
              {readableLabel(vendor.sourceStatus)}
            </span>
          </div>

          <h3>{vendor.displayName}</h3>
          <p>{vendor.description}</p>

          <p className="conversation-vendor-reason">
            <strong>Why it fits:</strong> {vendor.whyItFits}
          </p>

          <div className="conversation-vendor-meta">
            {vendor.locationLabel && (
              <span>{vendor.locationLabel}</span>
            )}

            {typeof vendor.estimatedCost === "number" &&
              Number.isFinite(vendor.estimatedCost) && (
                <span>
                  Estimated cost:{" "}
                  {formatMoney(
                    vendor.estimatedCost,
                    vendor.currency || result.budgetSummary.currency,
                  )}
                </span>
              )}
          </div>
        </article>
      ))}
    </div>

    <p className="conversation-fineprint">
      These are planning suggestions, not confirmed bookings. Verify
      vendor identity, availability, inclusions, and final pricing
      directly before making a commitment.
    </p>
  </section>
)}

      {result.plan.recommendations.length > 0 && (
        <section id="workspace-ideas" className="conversation-result-section">
          <div className="conversation-result-section-heading">
            <div>
              <span className="conversation-eyebrow">
                IDEAS TO EXPLORE
              </span>
              <h2>Personalized recommendations</h2>
            </div>

            <span className="conversation-result-icon">
              <Lightbulb size={19} aria-hidden="true" />
            </span>
          </div>

          <div className="conversation-recommendations">
            {result.plan.recommendations
              .slice(0, 3)
              .map((item) => (
                <article
                  className="conversation-recommendation"
                  key={item.id}
                >
                  <span>{readableLabel(item.category)}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <p className="conversation-recommendation-reason">
                    <strong>Why it fits:</strong>{" "}
                    {item.whyItFits}
                  </p>
                </article>
              ))}
          </div>
        </section>
      )}

      {result.plan.vendorSuggestions.length > 0 && (
        <VendorPricingPanel
          vendors={result.plan.vendorSuggestions}
          budget={result.plan.budget}
          guestCount={input.guestCount}
        />
      )}

      {result.plan.assumptions.length > 0 && (
        <section className="conversation-result-section">
          <h2>Planning assumptions</h2>
          <ul className="conversation-assumptions">
            {result.plan.assumptions.map(
              (assumption, index) => (
                <li key={`${index}-${assumption}`}>
                  {assumption}
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      <div className="conversation-result-actions">
        <div>
          <button
            className="studio-button studio-button--primary studio-button--lg"
            type="button"
            onClick={onSave}
            disabled={saving || !approved}
          >
            {saving ? (
              <LoaderCircle
                className="studio-button__spinner"
                size={16}
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2 size={17} aria-hidden="true" />
            )}
            {saved ? "Update saved event" : "Save this plan"}
          </button>

          {saveMessage && (
            <p
              className="conversation-save-message"
              role="status"
            >
              {saveMessage}
            </p>
          )}
        </div>

        <div className="conversation-result-secondary-actions">
          <button
            className="studio-button studio-button--secondary"
            type="button"
            onClick={onRevise}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Adjust my brief
          </button>

          <button
            className="studio-button studio-button--ghost"
            type="button"
            onClick={onStartOver}
          >
            New event
          </button>

          <Link
            className="studio-button studio-button--secondary"
            href="/events"
          >
            My Events
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The wrapper separates browser-only draft restoration from the
 * interactive planner. The server and first hydration render use
 * the same placeholder; React then reads sessionStorage and mounts
 * the planner with its restored state.
 */
export default function ConversationalPlanner() {
  const snapshot = useSyncExternalStore(
    subscribeToDraftSnapshot,
    getDraftSnapshot,
    getServerDraftSnapshot,
  );

  if (snapshot === SERVER_DRAFT_SNAPSHOT) {
    return (
      <div
        className="conversation-hydration"
        role="status"
        aria-live="polite"
      >
        Opening your planning studio...
      </div>
    );
  }

  return (
    <ConversationalPlannerFlow
      initialState={restoreConversationState(snapshot)}
    />
  );
}

function ConversationalPlannerFlow({
  initialState,
}: {
  initialState: RestoredConversationState;
}) {
  const [draft, setDraft] = useState<ConversationDraft>(
    () => initialState.draft,
  );

  const [step, setStep] = useState<Step>(
    () => initialState.step,
  );

  const [history, setHistory] = useState<Step[]>(
    () => initialState.history,
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [generatedInput, setGeneratedInput] =
    useState<SavedEventInput | null>(null);
  const [isPlanApproved, setIsPlanApproved] = useState(false);
  const [concepts, setConcepts] = useState<EventConcept[] | null>(null);
  const [savedEventId, setSavedEventId] =
    useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");

  /**
   * Persist only after the planner has been mounted with its initial
   * browser snapshot. The initial state is restored before this
   * component mounts, so this effect does not overwrite a saved draft
   * with an empty one.
   */
  useEffect(() => {
    if (result) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ draft, step, history }),
      );
    } catch {
      // Session persistence is best-effort; the active brief remains usable.
    }
  }, [draft, step, history, result]);

  function goBack() {
    setErrorMessage("");

    if (history.length <= 1) {
      setStep("idea");
      return;
    }

    const nextHistory = history.slice(0, -1);

    setHistory(nextHistory);
    setStep(nextHistory[nextHistory.length - 1]);
  }

  function goToStep(target: Step) {
    setErrorMessage("");
    setResult(null);

    setHistory((current) =>
      current[current.length - 1] === target
        ? current
        : [...current, target],
    );

    setStep(target);
  }

  function continueWith(
    patch: Partial<ConversationDraft>,
  ) {
    let updated: ConversationDraft = {
      ...draft,
      ...patch,
    };

    if (patch.country !== undefined && !updated.currency) {
      const inferredCurrency = currencyForCountry(
        updated.country,
      );

      if (inferredCurrency) {
        updated = {
          ...updated,
          currency: inferredCurrency,
          assumptions: [
            ...updated.assumptions,
            `Currency set to ${inferredCurrency} based on the selected country; change it if needed.`,
          ],
        };
      }
    }

    setDraft(updated);

    const next = nextRequiredStep(updated);

    setHistory((current) => [...current, next]);
    setStep(next);
    setErrorMessage("");
  }

  function handleIdeaSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const idea = draft.idea.trim();

    if (idea.length < 6) {
      setErrorMessage(
        "Tell us a little more about the event you imagine.",
      );
      return;
    }

    const inferred = inferEventBriefFromText(idea);
    const updated = inferIntoDraft(
      { ...draft, idea },
      inferred,
    );

    setDraft(updated);

    const next = nextRequiredStep(updated);

    setHistory(["idea", next]);
    setStep(next);
    setErrorMessage("");
  }

  function toggleTheme(value: string) {
    setDraft((current) => ({
      ...current,
      themes: toggleItem(current.themes, value),
    }));
  }

  function toggleStyle(value: string) {
    setDraft((current) => ({
      ...current,
      styles: toggleItem(current.styles, value),
    }));
  }

  function togglePriority(value: string) {
    setDraft((current) => ({
      ...current,
      planningPriorities: toggleItem(
        current.planningPriorities,
        value,
      ),
    }));
  }

  function chooseStartingDirection() {
    const updated: ConversationDraft = {
      ...draft,
      themes: draft.themes.length
        ? draft.themes
        : ["versatile"],
      styles: draft.styles.length
        ? draft.styles
        : ["practical"],
      assumptions: [
        ...draft.assumptions,
        "A versatile theme and practical styling were selected as a starting direction because no specific preference was provided.",
      ],
    };

    continueWith(updated);
  }

  async function generatePlan() {
    setErrorMessage("");
    setSaveMessage("");

    const payload = buildPayload(draft);
    const validation = eventInputSchema.safeParse(payload);

    if (!validation.success) {
      const details = validation.error.issues
        .slice(0, 4)
        .map((issue) => issue.message)
        .join(" ");

      setErrorMessage(
        `Please review the event details. ${details}`,
      );
      return;
    }

    const validatedPayload =
      validation.data as SavedEventInput;

    setIsGenerating(true);

    const controller = new AbortController();

    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(validatedPayload),
      });

      const body = (await response.json()) as PlanApiResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(
          body.error?.message ??
            "EventoAI could not generate this plan. Your brief has been preserved so you can try again.",
        );
      }

      setGeneratedInput(validatedPayload);
      setConcepts(createEventConcepts(body.data, validatedPayload));
      setResult(null);
      setIsPlanApproved(false);
      setErrorMessage("");

      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // A failed cleanup does not invalidate a successful result.
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The request took longer than expected. Your draft is still here. Please try again.",
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred. Your draft is still here.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      setIsGenerating(false);
    }
  }

  function handleApprovePlan() {
    if (!result || !generatedInput) {
      return;
    }

    setResult({
      ...result,
      approval: {
        status: "approved",
        approvedAt: new Date().toISOString(),
      },
    });
    setIsPlanApproved(true);
    setSaveMessage(
      "Plan approved. Save it to keep this approved version.",
    );
  }

  function handleAcceptedPlanChange(
    nextResult: PlanResult,
    nextInput: SavedEventInput,
  ) {
    setResult({
      ...nextResult,
      approval: undefined,
    });
    setGeneratedInput(nextInput);
    setIsPlanApproved(false);
    setSaveMessage(
      "Change accepted. Review the updated plan and approve it again before saving.",
    );
    setErrorMessage("");
  }

  async function handleSave() {
    if (!result || !generatedInput) {
      return;
    }

    if (!isPlanApproved || result.approval?.status !== "approved") {
      setSaveMessage("Approve the current plan before saving it.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const record = saveEventRecord({
        id: savedEventId ?? undefined,
        input: generatedInput,
        result,
      });

      setSavedEventId(record.id);

      try {
        await saveCloudEvent(record);
        setSaveMessage(
          "Saved to your account. Open My Events to revisit your plan on your devices.",
        );
      } catch {
        setSaveMessage(
          "Saved in this browser, but cloud sync failed. Reopen My Events when online to retry.",
        );
      }
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "The plan could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function revisePlan() {
    setResult(null);
    setConcepts(null);
    setIsPlanApproved(false);
    setSaveMessage("");
    setErrorMessage("");

    setHistory((current) =>
      current[current.length - 1] === "review"
        ? current
        : [...current, "review"],
    );

    setStep("review");
  }

  function startNewEvent() {
    const empty = createEmptyDraft();

    setDraft(empty);
    setStep("idea");
    setHistory(["idea"]);
    setResult(null);
    setConcepts(null);
    setIsPlanApproved(false);
    setGeneratedInput(null);
    setSavedEventId(null);
    setErrorMessage("");
    setSaveMessage("");

    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Start-over should still work if session storage is unavailable.
    }
  }

  const planningReport = useMemo(
    () => analyzeEventBrief(buildPlanningBrief(draft)),
    [draft],
  );
  if (concepts && generatedInput && !result) {
    return (
      <EventConceptSelector
        concepts={concepts}
        eventTitle={generatedInput.title}
        guestCount={generatedInput.guestCount}
        currency={generatedInput.budget.currency}
        onSelect={(concept) => {
          setResult({ ...concept.result, approval: undefined });
          setIsPlanApproved(false);
          setSaveMessage("");
          setErrorMessage("");
          setSavedEventId(null);
        }}
        onBack={() => {
          setConcepts(null);
          setErrorMessage("");
        }}
      />
    );
  }
  if (result && generatedInput) {
    return (
      <div className="event-concept-result-shell">
        <PlanResultPanel
          result={result}
          input={generatedInput}
          saved={
            Boolean(savedEventId) &&
            saveMessage.startsWith("Saved in this browser.") &&
            isPlanApproved
          }
          saving={isSaving}
          saveMessage={saveMessage}
          approved={isPlanApproved}
          onSave={handleSave}
          onApprove={handleApprovePlan}
          onPlanChange={handleAcceptedPlanChange}
          onRevise={revisePlan}
          onStartOver={startNewEvent}
        />

        {concepts && concepts.length === 3 ? (
          <div className="event-concept-switch">
            <p>
              Want to compare another creative direction before continuing?
            </p>
            <button
              type="button"
              className="event-concept-switch__button"
              onClick={() => {
                setResult(null);
                setIsPlanApproved(false);
                setSavedEventId(null);
                setSaveMessage("");
                setErrorMessage("");
              }}
            >
              Explore the other concepts
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const prompt = {
    idea: {
      eyebrow: "FIRST, THE BIG IDEA",
      title: "What are we celebrating?",
      description:
        "Tell us in your own words. A sentence is enough to get started. You don't need to know every detail yet.",
    },
    occasion: {
      eyebrow: "THE OCCASION",
      title: "What kind of event is it?",
      description:
        "Choose the closest match. You can still describe a different kind of event in your brief.",
    },
    date: {
      eyebrow: "WHEN IT HAPPENS",
      title: "When should it take place?",
      description:
        "Choose the date or your best planning target. You can change it later.",
    },
    guests: {
      eyebrow: "THE PEOPLE",
      title: "How many people are you imagining?",
      description:
        "An approximate count is fine. Choose a range or enter your own number.",
    },
    location: {
      eyebrow: "THE SETTING",
      title: "Where should it happen?",
      description:
        "Tell us the city and country, then choose the venue setting that best fits your idea.",
    },
    budget: {
      eyebrow: "YOUR COMFORT ZONE",
      title: "What spending limit feels comfortable?",
      description:
        "Choose a budget and currency. If you are unsure, select a useful starting point rather than treating it as a quote.",
    },
    style: {
      eyebrow: "THE FEELING",
      title: "How should the event feel?",
      description:
        "Choose the themes and atmosphere that feel right. Select more than one, or ask EventoAI to suggest a starting direction.",
    },
    review: {
      eyebrow: "YOUR BRIEF, CONNECTED",
      title: "Does this capture your idea?",
      description:
        "Review the essentials. Change any answer before generating your plan.",
    },
  }[step];

  const progressStep =
    step === "idea"
      ? 1
      : [
            "occasion",
            "date",
            "guests",
            "location",
            "budget",
          ].includes(step)
        ? 2
        : step === "style"
          ? 3
          : 4;


  return (
    <div className="conversation-workspace">
      <div className="conversation-workspace-heading">
        <div>
          <span className="conversation-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            EVENTOAI PLANNING STUDIO
          </span>

          <h1>Let&apos;s shape something memorable.</h1>

          <p>
            Start with the idea. We&apos;ll work out the details
            together.
          </p>
        </div>

        <Link className="conversation-back-home" href="/">
          <ArrowLeft size={15} aria-hidden="true" />
          Home
        </Link>
      </div>

      <StepProgress step={step} />

      <div className="conversation-shell">
        <section className="conversation-panel">
          <div className="conversation-panel-header">
            <span className="conversation-agent-avatar">
              <Sparkles size={19} aria-hidden="true" />
            </span>

            <div>
              <strong>Your planning companion</strong>
              <span>
                {step === "review"
                  ? "Brief ready for review"
                  : "One question at a time"}
              </span>
            </div>

            <span className="conversation-live-dot" />
          </div>

          <div className="conversation-thread">
            {step !== "idea" && (
              <>
                <div className="conversation-agent-message">
                  <span className="conversation-message-label">
                    <Sparkles size={12} aria-hidden="true" />
                    I picked up the idea
                  </span>
                  <p>{draft.idea}</p>
                </div>

                <div className="conversation-user-message">
                  <span>Your idea</span>
                  <p>{draft.title || "Your event brief"}</p>
                </div>
              </>
            )}

            <div
              className="conversation-current-question"
              aria-live="polite"
            >
              <span className="conversation-question-eyebrow">
                {prompt.eyebrow}
              </span>

              <h2>{prompt.title}</h2>

              <p className="conversation-question-description">
                {prompt.description}
              </p>

              {step === "idea" && (
                <form
                  className="conversation-idea-form"
                  onSubmit={handleIdeaSubmit}
                >
                  <label
                    className="conversation-sr-only"
                    htmlFor="event-idea"
                  >
                    Describe your event
                  </label>

                  <textarea
                    id="event-idea"
                    value={draft.idea}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        idea: event.target.value,
                      }))
                    }
                    maxLength={600}
                    minLength={6}
                    rows={4}
                    placeholder="e.g. A relaxed outdoor birthday for my mother, with around 40 guests and a warm botanical theme..."
                    required
                  />

                  <div className="conversation-input-footer">
                    <span>{draft.idea.length}/600 characters</span>
                    <span>No details need to be perfect yet.</span>
                  </div>

                  <div className="conversation-examples">
                    <span>Need a starting point?</span>

                    {[
                      "A relaxed birthday dinner with close family",
                      "An elegant outdoor wedding on a careful budget",
                      "A community gathering with activities for families",
                    ].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            idea: example,
                          }))
                        }
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                  <div className="conversation-question-actions">
                    <span className="conversation-trust-note">
                      <ShieldCheck size={14} aria-hidden="true" />
                      Your answers shape the plan.
                    </span>

                    <button
                      className="studio-button studio-button--primary"
                      type="submit"
                    >
                      Explore my idea
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}

              {step === "occasion" && (
                <div className="conversation-choice-grid">
                  {EVENT_TYPES.map((item) => {
                    const Icon = item.icon;

                    return (
                      <StudioChoiceCard
                        key={item.value}
                        title={item.label}
                        description={item.description}
                        leadingIcon={<Icon size={18} />}
                        onClick={() =>
                          continueWith({
                            eventType: item.value,
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}

              {step === "date" && (
                <form
                  className="conversation-single-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    continueWith({
                      eventDate: draft.eventDate,
                    });
                  }}
                >
                  <label className="conversation-field">
                    <span>Event date</span>
                    <input
                      type="date"
                      value={draft.eventDate}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          eventDate: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>

                  <p className="conversation-field-help">
                    Choose your current best date. We can revisit
                    the schedule later.
                  </p>

                  <div className="conversation-question-actions">
                    <button
                      className="studio-button studio-button--secondary"
                      type="button"
                      onClick={goBack}
                    >
                      Back
                    </button>

                    <button
                      className="studio-button studio-button--primary"
                      type="submit"
                      disabled={!isValidDateOnly(draft.eventDate)}
                    >
                      Continue
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}

              {step === "guests" && (
                <form
                  className="conversation-single-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    continueWith({
                      guestCount: draft.guestCount,
                    });
                  }}
                >
                  <label className="conversation-field">
                    <span>Expected guests</span>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={draft.guestCount}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          guestCount: event.target.value,
                        }))
                      }
                      placeholder="Enter an approximate number"
                      required
                    />
                  </label>

                  <div className="conversation-quick-choices">
                    {GUEST_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        className={
                          draft.guestCount === String(option.value)
                            ? "is-selected"
                            : ""
                        }
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            guestCount: String(option.value),
                          }))
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="conversation-question-actions">
                    <button
                      className="studio-button studio-button--secondary"
                      type="button"
                      onClick={goBack}
                    >
                      Back
                    </button>

                    <button
                      className="studio-button studio-button--primary"
                      type="submit"
                      disabled={
                        !Number.isInteger(
                          Number(draft.guestCount),
                        ) ||
                        Number(draft.guestCount) < 1 ||
                        Number(draft.guestCount) > 10000
                      }
                    >
                      Continue
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}

              {step === "location" && (
                <form
                  className="conversation-single-form"
                  onSubmit={(event) => {
                    event.preventDefault();

                    continueWith({
                      city: draft.city.trim(),
                      country: draft.country.trim(),
                      venueType: draft.venueType,
                    });
                  }}
                >
                  <div className="conversation-field-grid">
                    <label className="conversation-field">
                      <span>City</span>
                      <input
                        value={draft.city}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            city: event.target.value,
                          }))
                        }
                        maxLength={100}
                        placeholder="Where is the event?"
                        required
                      />
                    </label>

                    <label className="conversation-field">
                      <span>Country</span>
                      <input
                        value={draft.country}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            country: event.target.value,
                          }))
                        }
                        maxLength={100}
                        placeholder="Country"
                        required
                      />
                    </label>
                  </div>

                  <div className="conversation-choice-block">
                    <span>What kind of setting?</span>

                    <div className="conversation-choice-grid conversation-choice-grid--two">
                      <StudioChoiceCard
                        title="Outdoor"
                        description="Garden, beach, park or open air."
                        leadingIcon={<Flower2 size={18} />}
                        selected={draft.venueType === "outdoor"}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            venueType: "outdoor",
                          }))
                        }
                      />

                      <StudioChoiceCard
                        title="Indoor"
                        description="Home, hall, restaurant or venue."
                        leadingIcon={<MapPin size={18} />}
                        selected={draft.venueType === "indoor"}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            venueType: "indoor",
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="conversation-question-actions">
                    <button
                      className="studio-button studio-button--secondary"
                      type="button"
                      onClick={goBack}
                    >
                      Back
                    </button>

                    <button
                      className="studio-button studio-button--primary"
                      type="submit"
                      disabled={
                        !draft.city.trim() ||
                        !draft.country.trim() ||
                        !draft.venueType
                      }
                    >
                      Continue
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </form>
              )}

              {step === "budget" && (
                <ConversationBudgetStep
                  draft={draft}
                  setDraft={setDraft}
                  onBack={goBack}
                  onContinue={continueWith}
                />
              )}

              {step === "style" && (
                <div className="conversation-style-form">
                  <div className="conversation-choice-block">
                    <span>Choose themes</span>

                    <div className="conversation-choice-grid">
                      {THEME_CHOICES.map((item) => (
                        <StudioChoiceCard
                          key={item.value}
                          title={item.label}
                          description={item.description}
                          selected={draft.themes.includes(
                            item.value,
                          )}
                          onClick={() =>
                            toggleTheme(item.value)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="conversation-choice-block">
                    <span>Choose the overall atmosphere</span>

                    <div className="conversation-choice-grid">
                      {STYLE_CHOICES.map((item) => (
                        <StudioChoiceCard
                          key={item.value}
                          title={item.label}
                          description={item.description}
                          selected={draft.styles.includes(
                            item.value,
                          )}
                          onClick={() =>
                            toggleStyle(item.value)
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="conversation-choice-block">
                    <span>What matters most?</span>

                    <div className="conversation-quick-choices">
                      {[
                        {
                          value: "budget",
                          label: "Budget control",
                        },
                        {
                          value: "guest_experience",
                          label: "Guest experience",
                        },
                      ].map((item) => (
                        <button
                          key={item.value}
                          className={
                            draft.planningPriorities.includes(
                              item.value,
                            )
                              ? "is-selected"
                              : ""
                          }
                          type="button"
                          onClick={() =>
                            togglePriority(item.value)
                          }
                        >
                          {draft.planningPriorities.includes(
                            item.value,
                          ) && (
                            <Check
                              size={13}
                              aria-hidden="true"
                            />
                          )}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="conversation-question-actions">
                    <button
                      className="studio-button studio-button--secondary"
                      type="button"
                      onClick={goBack}
                    >
                      Back
                    </button>

                    <button
                      className="studio-button studio-button--primary"
                      type="button"
                      onClick={() => {
                        const updated: ConversationDraft = {
                          ...draft,
                          themes: draft.themes.length
                            ? draft.themes
                            : ["versatile"],
                          styles: draft.styles.length
                            ? draft.styles
                            : ["practical"],
                          assumptions: [...draft.assumptions],
                        };

                        if (
                          !draft.themes.length ||
                          !draft.styles.length
                        ) {
                          updated.assumptions.push(
                            "A versatile theme or practical style was used where no preference was selected.",
                          );
                        }

                        continueWith(updated);
                      }}
                      disabled={
                        !draft.themes.length &&
                        !draft.styles.length
                      }
                    >
                      Review my brief
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>

                  <button
                    className="conversation-suggest-button"
                    type="button"
                    onClick={chooseStartingDirection}
                  >
                    <Sparkles size={15} aria-hidden="true" />
                    Suggest a balanced starting direction
                  </button>
                </div>
              )}

              {step === "review" && (
                <ConversationReviewPanel
                  draft={draft}
                  setDraft={setDraft}
                  errorMessage={errorMessage}
                  isGenerating={isGenerating}
                  generatePlan={generatePlan}
                  goBack={goBack}
                  goToStep={goToStep}
                  planningReport={planningReport}
                  formatMoney={formatMoney}
                  formatDate={formatDate}
                  readableLabel={readableLabel}
                  isValidDateOnly={isValidDateOnly}
                />
              )}

              {step !== "idea" && (
                <button
                  className="conversation-back-step"
                  type="button"
                  onClick={goBack}
                  disabled={isGenerating}
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  Previous question
                </button>
              )}

              {errorMessage && step !== "review" && (
                <div
                  className="conversation-error"
                  role="alert"
                >
                  <p>{errorMessage}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="conversation-sidebar">
          <section className="conversation-brief-card">
            <div className="conversation-sidebar-title">
              <span className="conversation-sidebar-icon">
                <Lightbulb size={17} aria-hidden="true" />
              </span>

              <div>
                <strong>Your brief</strong>
                <span>Builds as you answer</span>
              </div>
            </div>

            {draft.idea ? (
              <p className="conversation-brief-idea">
                {draft.idea}
              </p>
            ) : (
              <p className="conversation-empty-note">
                Your initial idea will appear here. Nothing is
                prefilled.
              </p>
            )}

            <div className="conversation-brief-divider" />

            <div className="conversation-brief-line">
              <span>Occasion</span>
              <strong>
                {draft.eventType
                  ? readableLabel(draft.eventType)
                  : "To be decided"}
              </strong>
            </div>

            <div className="conversation-brief-line">
              <span>Event date</span>
              <strong>
                {draft.eventDate
                  ? formatDate(draft.eventDate)
                  : "Not provided yet"}
              </strong>
            </div>

            <div className="conversation-brief-line">
              <span>Guests</span>
              <strong>
                {draft.guestCount || "Not provided yet"}
              </strong>
            </div>

            <div className="conversation-brief-line">
              <span>Location</span>
              <strong>
                {draft.city && draft.country
                  ? `${draft.city}, ${draft.country}`
                  : "To be decided"}
              </strong>
            </div>

            <div className="conversation-brief-line">
              <span>Budget</span>
              <strong>
                {draft.totalAmount && draft.currency
                  ? formatMoney(
                      Number(draft.totalAmount),
                      draft.currency,
                    )
                  : "Not provided yet"}
              </strong>
            </div>

            {(draft.themes.length > 0 ||
              draft.styles.length > 0) && (
              <>
                <div className="conversation-brief-divider" />
                <div className="conversation-brief-tags">
                  {[
                    ...draft.themes.map((item) => ({ kind: "theme", item })),
                    ...draft.styles.map((item) => ({ kind: "style", item })),
                  ].map(({ item, kind }) => (
                    <span key={`${kind}-${item}`}>
                      {readableLabel(item)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="conversation-sidebar-note">
            <span>
              <ShieldCheck size={17} aria-hidden="true" />
            </span>

            <div>
              <strong>
                Clear assumptions. Your decisions.
              </strong>
              <p>
                Details you provided stay distinct from
                suggestions and planning assumptions. You review
                the brief before generating a plan.
              </p>
            </div>
          </section>

          <section className="conversation-sidebar-note conversation-sidebar-note--soft">
            <span>
              <MessageCircle size={17} aria-hidden="true" />
            </span>

            <div>
              <strong>Not sure about every detail?</strong>
              <p>
                Start with what you know. Choose a planning
                direction when needed, and refine the details
                later.
              </p>
            </div>
          </section>
        </aside>
      </div>

      <footer className="conversation-footer">
        <span>
          <ShieldCheck size={14} aria-hidden="true" />
          Your choices stay under your control.
        </span>

        <span>
          Step {progressStep} of 4  -  A thoughtful plan starts here
        </span>
      </footer>
    </div>
  );
}
