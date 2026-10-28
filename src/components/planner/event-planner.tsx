"use client";
import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import styles from "./planner-classnames";
import { saveEventRecord } from "@/lib/saved-events";
import VendorPricingPanel from "@/components/planner/vendor-pricing-panel";
import { saveCloudEvent } from "@/lib/cloud-events";
import type { SavedEventInput } from "@/types/saved-event";

type BudgetItemView = {
  id: string;
  name: string;
  category: string;
  description?: string;
  estimatedAmount: number;
  quotedAmount?: number;
  actualAmount?: number;
  costStatus: string;
};

type TaskView = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  category: string;
  priority: string;
  status: string;
};

type RecommendationView = {
  id: string;
  title: string;
  category: string;
  description: string;
  whyItFits: string;
  tags: string[];
  estimatedCost?: number;
  currency?: string;
};

type VendorView = {
  id: string;
  displayName: string;
  serviceCategory: string;
  description: string;
  whyItFits: string;
  sourceStatus: string;
  estimatedCost?: number;
  currency?: string;
  locationLabel?: string;
};

type BudgetWarningView = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type PlanResult = {
  plan: {
    summary: string;
    budget: {
      currency: string;
      spendingLimit: number;
      contingencyPercent: number;
      items: BudgetItemView[];
    };
    tasks: TaskView[];
    recommendations: RecommendationView[];
    vendorSuggestions: VendorView[];
    assumptions: string[];
  };
  budgetSummary: {
    currency: string;
    spendingLimit: number;
    estimatedSubtotal: number;
    contingencyReserve: number;
    projectedTotal: number;
    remainingBudget: number;
    overBudgetAmount: number;
    isWithinBudget: boolean;
    byCategory: {
      category: string;
      amount: number;
      itemCount: number;
    }[];
  };
  budgetWarnings: BudgetWarningView[];
  model: string;
  generationMode: "ai_enhanced" | "local_fallback";
  generatedAt: string;
  generationMs: number;
  approval?: {
    status: "approved";
    approvedAt: string;
  };
};

type PlanApiResponse = {
  success?: boolean;
  data?: PlanResult;
  error?: {
    code?: string;
    message?: string;
  };
};

const REQUEST_TIMEOUT_MS = 12_000;

const EVENT_TYPES = [
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "community", label: "Community event" },
  { value: "anniversary", label: "Anniversary" },
  { value: "corporate", label: "Corporate event" },
];

function splitList(value: string, fallback: string[]): string[] {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  return items.length > 0 ? items : fallback;
}

function formatMoney(amount: number, currency: string): string {
  return formatCurrencyShared(amount, currency);
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readableLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function amountProvenance(status: string): string {
  const labels: Record<string, string> = {
    planning_allocation: "Budget allocation",
    ai_estimate: "AI estimate",
    market_estimate: "Market estimate",
    vendor_quote: "Vendor quote",
    confirmed: "Confirmed",
    actual: "Actual spend",
  };

  return labels[status] ?? "Unspecified cost basis";
}

export default function EventPlanner() {
  const [eventType, setEventType] = useState("birthday");
  const [title, setTitle] = useState("Garden birthday celebration");
  const [eventDate, setEventDate] = useState("2027-01-15");
  const [guestCount, setGuestCount] = useState("40");

  const [city, setCity] = useState("Chennai");
  const [country, setCountry] = useState("India");
  const [venueType, setVenueType] = useState("outdoor");

  const [currency, setCurrency] = useState("INR");
  const [totalBudget, setTotalBudget] = useState("25000");
  const [contingencyPercent, setContingencyPercent] = useState("10");

  const [themes, setThemes] = useState("garden, botanical");
  const [preferredStyles, setPreferredStyles] = useState("simple, family-friendly");
  const [notes, setNotes] = useState(
    "An affordable outdoor celebration.",
  );

  const [priorities, setPriorities] = useState<string[]>([
    "budget",
    "guest_experience",
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [requestDurationMs, setRequestDurationMs] = useState<number | null>(
    null,
  );
  const [lastGeneratedInput, setLastGeneratedInput] =
    useState<SavedEventInput | null>(null);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  function togglePriority(priority: string) {
    setPriorities((current) =>
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority],
    );
  }

  async function handleSave() {
    if (!result || !lastGeneratedInput) {
      return;
    }

    try {
      const savedRecord = saveEventRecord({
        id: savedEventId ?? undefined,
        input: lastGeneratedInput,
        result,
      });

      setSavedEventId(savedRecord.id);
      setSaveError("");
      setSaveMessage("Saved in this browser. Syncing to your account...");

      try {
        await saveCloudEvent(savedRecord);
        setSaveMessage("Your event plan is saved to your account and synced.");
      } catch {
        setSaveMessage(
          "Saved in this browser, but cloud sync failed. Reopen My Events when online to retry.",
        );
      }
    } catch (error) {
      setSaveMessage("");
      setSaveError(
        error instanceof Error
          ? error.message
          : "The event plan could not be saved.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setResult(null);
    setRequestDurationMs(null);
    setLastGeneratedInput(null);
    setSavedEventId(null);
    setSaveMessage("");
    setSaveError("");
    setIsSubmitting(true);

    const controller = new AbortController();
    const timeoutHandle = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );

    const startedAt = performance.now();

    try {
      const payload = {
        eventType,
        title: title.trim(),
        eventDate,
        guestCount: Number(guestCount),

        location: {
          city: city.trim(),
          country: country.trim(),
          venueType,
        },

        budget: {
          currency,
          totalAmount: Number(totalBudget),
          contingencyPercent: Number(contingencyPercent),
        },

        preferences: {
          preferredThemes: splitList(themes, ["simple"]),
          preferredStyles: splitList(preferredStyles, ["practical"]),
          notes: notes.trim(),
        },

        planningPriorities: priorities,
      };

      const response = await fetch("/api/ai/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as PlanApiResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(
          body.error?.message ??
            "EventoAI could not generate this plan. Check the inputs and try again.",
        );
      }

      setResult(body.data);
      setLastGeneratedInput(payload);
      setRequestDurationMs(Math.round(performance.now() - startedAt));
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        setErrorMessage(
          "The request took longer than expected. Your plan may still be generated on the server. Please check the result before retrying.",
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while creating your plan.",
        );
      }
    } finally {
      window.clearTimeout(timeoutHandle);
      setIsSubmitting(false);
    }
  }

  const budgetPercent = result
    ? Math.max(
        0,
        Math.min(
          100,
          result.budgetSummary.spendingLimit > 0
            ? (result.budgetSummary.projectedTotal /
                result.budgetSummary.spendingLimit) *
                100
            : 0,
        ),
      )
    : 0;

  const orderedTasks = result
    ? [...result.plan.tasks].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      )
    : [];

  return (
    <div className={styles.planner}>
      <section className={styles.intro}>
        <span className={styles.eyebrow}>
          <Sparkles size={15} aria-hidden="true" />
          Your event, thoughtfully planned
        </span>

        <h2>Create your event plan</h2>

        <p>
          Enter your event details and generate a personalized plan with
          budget calculations, preparation tasks, recommendations, and
          transparent cost assumptions.
        </p>
      </section>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.formSection}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}>
              <CalendarDays size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Event details</h3>
              <p>Start with the basics of your celebration.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Event type</span>
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
                required
              >
                {EVENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Event name</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                placeholder="e.g. Garden birthday celebration"
                required
              />
            </label>

            <label className={styles.field}>
              <span>Event date</span>
              <input
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Number of guests</span>
              <input
                type="number"
                min="1"
                max="10000"
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value)}
                required
              />
            </label>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}>
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Location and venue</h3>
              <p>Set the context for the plan.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>City</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                maxLength={100}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Country</span>
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                maxLength={100}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Venue type</span>
              <select
                value={venueType}
                onChange={(event) => setVenueType(event.target.value)}
                required
              >
                <option value="outdoor">Outdoor</option>
                <option value="indoor">Indoor</option>
              </select>
            </label>
          </div>
        </section>

        <section className={styles.formSection}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}>
              <Wallet size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Budget and contingency</h3>
              <p>Choose your spending limit and reserve.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Currency</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
              >
                <option value="INR">INR - Indian Rupee</option>
<option value="USD">USD - US Dollar</option>
<option value="GBP">GBP - Pound Sterling</option>
<option value="EUR">EUR - Euro</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Total budget</span>
              <input
                type="number"
                min="1"
                max="1000000000"
                step="0.01"
                value={totalBudget}
                onChange={(event) => setTotalBudget(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span>Contingency reserve (%)</span>
              <input
                type="number"
                min="0"
                max="50"
                step="1"
                value={contingencyPercent}
                onChange={(event) =>
                  setContingencyPercent(event.target.value)
                }
                required
              />
            </label>
          </div>

          <p className={styles.helper}>
            The contingency reserve is included in the projected total,
            so it is not additional money on top of your spending limit.
          </p>
        </section>

        <section className={styles.formSection}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}>
              <Sparkles size={19} aria-hidden="true" />
            </span>
            <div>
              <h3>Preferences and priorities</h3>
              <p>Give the planner useful context.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Preferred themes</span>
              <input
                value={themes}
                onChange={(event) => setThemes(event.target.value)}
                placeholder="garden, botanical"
              />
              <small>Separate multiple themes with commas.</small>
            </label>

            <label className={styles.field}>
              <span>Preferred styles</span>
              <input
                value={preferredStyles}
                onChange={(event) => setPreferredStyles(event.target.value)}
                placeholder="simple, family-friendly"
              />
              <small>Separate multiple styles with commas.</small>
            </label>
          </div>

          <label className={styles.field}>
            <span>Additional notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={600}
              rows={4}
              placeholder="Accessibility needs, dietary considerations, or anything else the plan should account for."
            />
          </label>

          <fieldset className={styles.priorityFieldset}>
            <legend>What matters most?</legend>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                checked={priorities.includes("budget")}
                onChange={() => togglePriority("budget")}
              />
              Budget control
            </label>

            <label className={styles.checkOption}>
              <input
                type="checkbox"
                checked={priorities.includes("guest_experience")}
                onChange={() => togglePriority("guest_experience")}
              />
              Guest experience
            </label>
          </fieldset>
        </section>

        {errorMessage && (
          <div className={styles.errorMessage} role="alert">
            <AlertTriangle size={19} aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        )}

        <div className={styles.submitRow}>
          <div className={styles.submitHint}>
            <ShieldCheck size={16} aria-hidden="true" />
            Your plan is validated before it is displayed.
          </div>

          <button
            className={styles.submitButton}
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle
                  size={18}
                  className={styles.spinner}
                  aria-hidden="true"
                />
                Generating your plan...
              </>
            ) : (
              <>
                Generate event plan
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        {isSubmitting && (
          <div className={styles.loadingPanel} role="status" aria-live="polite">
            <LoaderCircle
              size={22}
              className={styles.spinner}
              aria-hidden="true"
            />
            <div>
              <strong>Building your event plan</strong>
              <p>
                Calculating budget totals, preparing the timeline, and
                requesting personalized recommendations.
              </p>
            </div>
          </div>
        )}
      </form>

      {result && (
        <section
          className={styles.results}
          aria-labelledby="plan-results-heading"
        >
          <div className={styles.resultsHeading}>
            <div>
              <span className={styles.eyebrow}>
                <CheckCircle2 size={15} aria-hidden="true" />
                Your plan is ready
              </span>
              <h2 id="plan-results-heading">{title.trim()}</h2>
              <p>{result.plan.summary}</p>
            </div>

            <span
              className={
                result.generationMode === "ai_enhanced"
                  ? styles.aiStatus
                  : styles.localStatus
              }
            >
              {result.generationMode === "ai_enhanced" ? (
                <Sparkles size={15} aria-hidden="true" />
              ) : (
                <ShieldCheck size={15} aria-hidden="true" />
              )}
              {result.generationMode === "ai_enhanced"
                ? "AI-enhanced"
                : "Local plan"}
            </span>
          </div>

          <p className={styles.resultMeta}>
            Model: {result.model}  -  Service:{" "}
            {(result.generationMs / 1000).toFixed(2)} seconds
            {requestDurationMs !== null &&
              `  -  Total request: ${(requestDurationMs / 1000).toFixed(2)} seconds`}
          </p>

          {result.generationMode === "local_fallback" && (
            <div className={styles.infoMessage}>
              <ShieldCheck size={18} aria-hidden="true" />
              <p>
                Your plan was generated using EventoAI&apos;s local planning
                rules because AI enhancement was unavailable. Cost
                allocations are not verified market prices.
              </p>
            </div>
          )}

          <div className={styles.metrics}>
            <article className={styles.metric}>
              <span>Spending limit</span>
              <strong>
                {formatMoney(
                  result.budgetSummary.spendingLimit,
                  result.budgetSummary.currency,
                )}
              </strong>
            </article>

            <article className={styles.metric}>
              <span>Projected total</span>
              <strong>
                {formatMoney(
                  result.budgetSummary.projectedTotal,
                  result.budgetSummary.currency,
                )}
              </strong>
            </article>

            <article className={styles.metric}>
              <span>Contingency reserve</span>
              <strong>
                {formatMoney(
                  result.budgetSummary.contingencyReserve,
                  result.budgetSummary.currency,
                )}
              </strong>
            </article>

            <article className={styles.metric}>
              <span>
                {result.budgetSummary.remainingBudget >= 0
                  ? "Budget remaining"
                  : "Over budget"}
              </span>
              <strong
                className={
                  result.budgetSummary.isWithinBudget
                    ? styles.positiveValue
                    : styles.negativeValue
                }
              >
                {formatMoney(
                  Math.abs(result.budgetSummary.remainingBudget),
                  result.budgetSummary.currency,
                )}
              </strong>
            </article>
          </div>

          <div className={styles.progressPanel}>
            <div className={styles.progressHeading}>
              <strong>Budget utilization</strong>
              <span>{budgetPercent.toFixed(1)}%</span>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Budget utilization"
              aria-valuenow={Math.round(budgetPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={
                  result.budgetSummary.isWithinBudget
                    ? styles.progressFill
                    : styles.progressFillOver
                }
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <p>
              Allocations and estimates can differ from actual supplier
              prices. Confirm important prices before committing funds.
            </p>
          </div>

          {result.budgetWarnings.length > 0 && (
            <section className={styles.resultSection}>
              <h3>Budget checks and warnings</h3>
              <div className={styles.warningList}>
                {result.budgetWarnings.map((warning, index) => (
                  <div
                    className={`${styles.warning} ${
                      warning.severity === "critical"
                        ? styles.warningCritical
                        : warning.severity === "warning"
                          ? styles.warningAmber
                          : styles.warningInfo
                    }`}
                    key={`${warning.code}-${index}`}
                  >
                    <AlertTriangle size={17} aria-hidden="true" />
                    <p>{warning.message}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={styles.resultSection}>
            <div className={styles.resultSectionHeading}>
              <Wallet size={20} aria-hidden="true" />
              <h3>Budget breakdown</h3>
            </div>
            <p className={styles.sectionNote}>
              Values retain their stated cost basis. Planning allocations
              should not be interpreted as researched or quoted prices.
            </p>

            <div className={styles.budgetList}>
              {result.plan.budget.items.map((item) => (
                <article className={styles.budgetRow} key={item.id}>
                  <div className={styles.budgetItemDetails}>
                    <strong>{item.name}</strong>
                    <span>
                      {readableLabel(item.category)}  - {" "}
                      {amountProvenance(item.costStatus)}
                    </span>
                    {item.description && <p>{item.description}</p>}
                  </div>
                  <strong className={styles.budgetAmount}>
                    {formatMoney(
                      item.costStatus === "actual"
                        ? item.actualAmount ?? item.estimatedAmount
                        : item.costStatus === "vendor_quote" ||
                            item.costStatus === "confirmed"
                          ? item.quotedAmount ?? item.estimatedAmount
                          : item.estimatedAmount,
                      result.plan.budget.currency,
                    )}
                  </strong>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.resultSection}>
            <div className={styles.resultSectionHeading}>
              <Sparkles size={20} aria-hidden="true" />
              <h3>Personalized recommendations</h3>
            </div>

            <div className={styles.recommendationGrid}>
              {result.plan.recommendations.map((recommendation) => (
                <article
                  className={styles.recommendation}
                  key={recommendation.id}
                >
                  <span className={styles.recommendationCategory}>
                    {readableLabel(recommendation.category)}
                  </span>
                  <h4>{recommendation.title}</h4>
                  <p>{recommendation.description}</p>
                  <p className={styles.whyText}>
                    <strong>Why it fits: </strong>
                    {recommendation.whyItFits}
                  </p>

                  {recommendation.tags.length > 0 && (
                    <div className={styles.tags}>
                      {recommendation.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className={styles.resultSection}>
            <div className={styles.resultSectionHeading}>
              <Clock3 size={20} aria-hidden="true" />
              <h3>Preparation timeline</h3>
            </div>

            <div className={styles.timeline}>
              {orderedTasks.map((task, index) => (
                <article className={styles.timelineItem} key={task.id}>
                  <div className={styles.timelineMarker}>
                    {index + 1}
                  </div>
                  <div className={styles.timelineCard}>
                    <div className={styles.timelineTitleRow}>
                      <h4>{task.title}</h4>
                      <span className={styles.taskPriority}>
                        {readableLabel(task.priority)}
                      </span>
                    </div>
                    {task.description && <p>{task.description}</p>}
                    <div className={styles.taskMeta}>
                      <span>{formatDate(task.dueDate)}</span>
                      <span>{readableLabel(task.category)}</span>
                      <span>{readableLabel(task.status)}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {result.plan.vendorSuggestions.length > 0 && (
            <section className={styles.resultSection}>
              <div className={styles.resultSectionHeading}>
                <ShieldCheck size={20} aria-hidden="true" />
                <h3>Vendor categories to explore</h3>
              </div>

              <p className={styles.sectionNote}>
                These are suggestions for service categories, not verified
                businesses or confirmed quotes.
              </p>

              <div className={styles.recommendationGrid}>
                {result.plan.vendorSuggestions.map((vendor) => (
                  <article className={styles.recommendation} key={vendor.id}>
                    <span className={styles.recommendationCategory}>
                      {readableLabel(vendor.serviceCategory)}
                    </span>
                    <h4>{vendor.displayName}</h4>
                    <p>{vendor.description}</p>
                    <p className={styles.whyText}>
                      <strong>Why consider it: </strong>
                      {vendor.whyItFits}
                    </p>
                    <span className={styles.provenance}>
                      Status: {readableLabel(vendor.sourceStatus)}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}

          {lastGeneratedInput && result.plan.vendorSuggestions.length > 0 && (
            <VendorPricingPanel
              vendors={result.plan.vendorSuggestions}
              budget={result.plan.budget}
              guestCount={lastGeneratedInput.guestCount}
            />
          )}

          {result.plan.assumptions.length > 0 && (
            <section className={styles.resultSection}>
              <div className={styles.resultSectionHeading}>
                <ShieldCheck size={20} aria-hidden="true" />
                <h3>Important assumptions</h3>
              </div>

              <ul className={styles.assumptions}>
                {result.plan.assumptions.map((assumption, index) => (
                  <li key={`${index}-${assumption}`}>{assumption}</li>
                ))}
              </ul>
            </section>
          )}

          <div className={styles.resultActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleSave}
              disabled={!lastGeneratedInput}
            >
              {savedEventId ? "Update saved plan" : "Save event plan"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() =>
                window.print()
              }
            >
              Print or save as PDF
            </button>
            <Link className={styles.secondaryButton} href="/events">
              My saved events
            </Link>
            <Link className={styles.secondaryButton} href="/">
              Return home
            </Link>
          </div>

          {saveMessage && (
            <p className={styles.sectionNote} role="status">
              {saveMessage}{" "}
              <Link href="/events">View saved events</Link>
            </p>
          )}

          {saveError && (
            <div className={styles.errorMessage} role="alert">
              <AlertTriangle size={19} aria-hidden="true" />
              <p>{saveError}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
