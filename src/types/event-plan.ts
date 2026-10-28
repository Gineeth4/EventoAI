/**
 * EventoAI — Event plan types.
 *
 * Budget items and tasks are structured records rather than free-form
 * paragraphs. This makes them editable, testable, and suitable for
 * saving in a database.
 */

import type { Currency, DateOnly } from "@/types/event";
import type {
  EventIdeaRecommendation,
  VendorSuggestion,
} from "@/types/recommendation";

/** Categories used to classify event expenses. */
export const BUDGET_CATEGORIES = [
  "venue",
  "catering",
  "decoration",
  "photography",
  "entertainment",
  "attire",
  "transportation",
  "invitations",
  "gifts",
  "equipment",
  "permits",
  "staffing",
  "accommodation",
  "contingency",
  "miscellaneous",
  "other",
] as const;

export type BudgetCategory =
  (typeof BUDGET_CATEGORIES)[number];

/**
 * Indicates how an expense amount was established.
 *
 * planning_allocation:
 *   A deterministic share of the user's budget. It is not a researched
 *   price estimate and does not imply that the budget is sufficient.
 *
 * ai_estimate:
 *   An amount estimated by the AI model.
 *
 * market_estimate:
 *   An estimate derived from market information, not a confirmed quote.
 *
 * vendor_quote:
 *   A quoted amount. Its source and terms should be recorded separately.
 *
 * confirmed:
 *   An amount explicitly confirmed for the expense.
 *
 * actual:
 *   A recorded amount actually spent.
 */
export const COST_STATUSES = [
  "planning_allocation",
  "ai_estimate",
  "market_estimate",
  "vendor_quote",
  "confirmed",
  "actual",
] as const;

export type CostStatus = (typeof COST_STATUSES)[number];

/** Categories used to organize preparation tasks. */
export const TASK_CATEGORIES = [
  "venue",
  "catering",
  "decor",
  "guest_management",
  "vendors",
  "invitations",
  "entertainment",
  "transportation",
  "logistics",
  "legal_and_safety",
  "other",
] as const;

export type TaskCategory =
  (typeof TASK_CATEGORIES)[number];

/** Task urgency, used to organize the planning dashboard. */
export const TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type TaskPriority =
  (typeof TASK_PRIORITIES)[number];

/** Status of an individual preparation task. */
export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "completed",
  "blocked",
] as const;

export type TaskStatus =
  (typeof TASK_STATUSES)[number];

/** A single item in the event budget. */
export type BudgetItem = {
  id: string;
  name: string;
  category: BudgetCategory;
  description?: string;

  /**
   * Original AI estimate or deterministic planning allocation.
   * The costStatus field identifies which it is.
   */
  estimatedAmount: number;

  /** Amount stated in a vendor quotation, when available. */
  quotedAmount?: number;

  /** Amount actually spent, when known. */
  actualAmount?: number;

  /** Provenance or confirmation status of the amount. */
  costStatus: CostStatus;

  /** Optional reference to the source of a quote or actual cost. */
  sourceName?: string;
  sourceUrl?: string;

  notes?: string;
};

/** Budget configuration attached to a complete event plan. */
export type BudgetPlan = {
  currency: Currency;

  /** Maximum spending limit supplied or approved by the user. */
  spendingLimit: number;

  /** Reserve percentage for unexpected expenses, from 0 to 50. */
  contingencyPercent: number;

  items: BudgetItem[];
};

/** A preparation task with a real date and explicit dependencies. */
export type EventTask = {
  id: string;
  title: string;
  description?: string;
  dueDate: DateOnly;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;

  /**
   * IDs of tasks that must be completed before this task can proceed.
   * These relationships will be checked for missing references and cycles.
   */
  dependsOn: string[];

  estimatedDurationHours?: number;
  isMilestone?: boolean;
};

/**
 * The content of a generated event plan.
 *
 * Financial summaries are calculated by application code, not by AI.
 */
export type EventPlan = {
  summary: string;
  budget: BudgetPlan;
  tasks: EventTask[];
  recommendations: EventIdeaRecommendation[];
  vendorSuggestions: VendorSuggestion[];
  assumptions: string[];
};

/** A saved and versioned event plan. */
export type SavedEventPlan = EventPlan & {
  id: string;
  eventId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Aggregated budget information calculated by application code. */
export type BudgetCategoryTotal = {
  category: BudgetCategory;
  amount: number;
  itemCount: number;
};

/**
 * Financial summary consumed by the budget dashboard.
 *
 * remainingBudget may be negative when the plan exceeds the limit.
 * overBudgetAmount is always zero or positive.
 *
 * The field name estimatedSubtotal is retained for API compatibility.
 * The subtotal reflects the active amount for each cost status.
 */
export type BudgetSummary = {
  currency: Currency;
  spendingLimit: number;
  estimatedSubtotal: number;
  contingencyReserve: number;
  projectedTotal: number;
  remainingBudget: number;
  overBudgetAmount: number;
  isWithinBudget: boolean;
  byCategory: BudgetCategoryTotal[];
};