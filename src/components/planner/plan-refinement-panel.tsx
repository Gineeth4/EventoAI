"use client";
import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import type { EventInput } from "@/types/event";
import type { SavedEventInput } from "@/types/saved-event";
import type { PlanResult } from "@/components/planner/event-planner";

import { eventInputSchema } from "@/lib/validation/event-input";
import { eventPlanSchema } from "@/lib/validation/event-plan";
import {
  assessPlanChange,
  type PlanImpactAssessment,
} from "@/lib/plan-impact/assess-plan-change";
import { parsePlanChangeRequest } from "@/lib/plan-impact/parse-plan-change-request";

type PlanRefinementPanelProps = {
  result: PlanResult;
  input: SavedEventInput;
  onAccept: (result: PlanResult, input: SavedEventInput) => void;
};

function formatMoney(amount: number, currency: string): string {
  return formatCurrencyShared(amount, currency);
}

function formatDelta(amount: number, currency: string): string {
  if (amount > 0) {
    return `+${formatMoney(amount, currency)}`;
  }

  if (amount < 0) {
    return `−${formatMoney(Math.abs(amount), currency)}`;
  }

  return formatMoney(0, currency);
}

function toEventInput(input: SavedEventInput): EventInput {
  return eventInputSchema.parse({
    eventType: input.eventType,
    title: input.title,
    eventDate: input.eventDate,
    guestCount: input.guestCount,
    location: {
      city: input.location.city,
      country: input.location.country,
      venueType: input.location.venueType,
    },
    budget: {
      currency: input.budget.currency,
      totalAmount: input.budget.totalAmount,
      contingencyPercent: input.budget.contingencyPercent,
    },
    preferences: {
      preferredThemes: input.preferences.preferredThemes,
      preferredStyles: input.preferences.preferredStyles,
      notes: input.preferences.notes,
    },
    planningPriorities: input.planningPriorities,
  }) as EventInput;
}

function buildAcceptedResult(
  result: PlanResult,
  assessment: PlanImpactAssessment,
): PlanResult {
  const retainedWarnings = result.budgetWarnings.filter(
    (warning) =>
      !/(budget|spending|reserve|contingency)/i.test(
        `${warning.code} ${warning.message}`,
      ),
  );

  if (assessment.proposedBudget.overBudgetAmount > 0) {
    retainedWarnings.push({
      code: "PLAN_IMPACT_OVER_BUDGET",
      severity: "critical",
      message:
        `The proposed plan is ${formatMoney(
          assessment.proposedBudget.overBudgetAmount,
          assessment.proposedBudget.currency,
        )} over its spending limit. Expense amounts were not silently reduced.`,
    });
  }

  return {
    ...result,
    plan: assessment.proposedPlan as unknown as PlanResult["plan"],
    budgetSummary: assessment.proposedBudget,
    budgetWarnings: retainedWarnings,
    approval: undefined,
  };
}

function buildAcceptedInput(
  input: SavedEventInput,
  assessment: PlanImpactAssessment,
): SavedEventInput {
  const proposed = assessment.proposedEvent;

  return {
    ...input,
    eventDate: proposed.eventDate ?? input.eventDate,
    guestCount: proposed.guestCount ?? input.guestCount,
    location: {
      ...input.location,
      city: proposed.location?.city ?? input.location.city,
      country: proposed.location?.country ?? input.location.country,
      venueType: proposed.location?.venueType ?? input.location.venueType,
    },
    budget: {
      ...input.budget,
      totalAmount:
        proposed.budget.totalAmount ?? input.budget.totalAmount,
      contingencyPercent:
        proposed.budget.contingencyPercent ??
        input.budget.contingencyPercent,
    },
  };
}

function ChangeIcon({ area }: { area: string }) {
  if (area === "budget") {
    return <Wallet size={15} aria-hidden="true" />;
  }

  if (area === "timeline") {
    return <Clock3 size={15} aria-hidden="true" />;
  }

  if (area === "location") {
    return <MapPin size={15} aria-hidden="true" />;
  }

  return <ShieldCheck size={15} aria-hidden="true" />;
}

export default function PlanRefinementPanel({
  result,
  input,
  onAccept,
}: PlanRefinementPanelProps) {
  const [request, setRequest] = useState("");
  const [assessment, setAssessment] =
    useState<PlanImpactAssessment | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  function previewChange() {
    setErrorMessage("");
    setNotice("");
    setAssessment(null);

    const change = parsePlanChangeRequest(request);

    if (!change) {
      setErrorMessage(
        "I couldn't identify one supported change. Try changing the guest count, total spending limit, event date, or city. For example: Increase guest count to 60.",
      );
      return;
    }

    try {
      const currentEvent = toEventInput(input);
      const currentPlan = eventPlanSchema.parse(result.plan);

      const preview = assessPlanChange({
        currentEvent,
        currentPlan,
        change,
      });

      setAssessment(preview);
    } catch {
      setErrorMessage(
        "The change could not be assessed against the current plan. No changes were applied. Review the event details and try again.",
      );
    }
  }

  function acceptChange() {
    if (!assessment) {
      return;
    }

    const nextResult = buildAcceptedResult(result, assessment);
    const nextInput = buildAcceptedInput(input, assessment);

    // The parent replaces the active plan only after explicit acceptance.
    onAccept(nextResult, nextInput);

    setAssessment(null);
    setRequest("");
    setErrorMessage("");
    setNotice(
      "Change accepted. Review the updated plan and approve it again before saving.",
    );
  }

  function rejectChange() {
    setAssessment(null);
    setErrorMessage("");
    setNotice("Proposal rejected. Your current plan remains unchanged.");
  }

  const currentCurrency = result.budgetSummary.currency;

  return (
    <section
      className="plan-refinement-panel"
      aria-labelledby="plan-refinement-title"
    >
      <div className="plan-refinement-heading">
        <div>
          <span className="conversation-eyebrow">PLAN IMPACT STUDIO</span>
          <h2 id="plan-refinement-title">What would you like to change?</h2>
          <p>
            Describe the adjustment in your own words. EventoAI will
            preview the impact before applying anything.
          </p>
        </div>
        <span className="plan-refinement-icon">
          <RotateCcw size={19} aria-hidden="true" />
        </span>
      </div>

      <label
        className="plan-refinement-label"
        htmlFor="plan-refinement-request"
      >
        Your change request
      </label>

      <textarea
        id="plan-refinement-request"
        className="plan-refinement-textarea"
        rows={3}
        maxLength={1000}
        value={request}
        onChange={(event) => {
          setRequest(event.target.value);
          setAssessment(null);
          setErrorMessage("");
          setNotice("");
        }}
        placeholder="For example: Increase guest count to 60."
      />

      <div className="plan-refinement-examples">
        <span>Try one of these:</span>
        <button
          type="button"
          onClick={() => {
            setRequest("Increase guest count to 60");
            setAssessment(null);
            setErrorMessage("");
            setNotice("");
          }}
        >
          Increase guests
        </button>
        <button
          type="button"
          onClick={() => {
            setRequest("Set the budget to INR 75000");
            setAssessment(null);
            setErrorMessage("");
            setNotice("");
          }}
        >
          Change budget
        </button>
        <button
          type="button"
          onClick={() => {
            setRequest("Move the event date to 2027-03-20");
            setAssessment(null);
            setErrorMessage("");
            setNotice("");
          }}
        >
          Move date
        </button>
        <button
          type="button"
          onClick={() => {
            setRequest("Change location to Coimbatore");
            setAssessment(null);
            setErrorMessage("");
            setNotice("");
          }}
        >
          Change city
        </button>
      </div>

      <div className="plan-refinement-actions">
        <button
          type="button"
          className="studio-button studio-button--primary"
          onClick={previewChange}
          disabled={!request.trim()}
        >
          Preview impact
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      {errorMessage ? (
        <p className="plan-refinement-message is-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          {errorMessage}
        </p>
      ) : null}

      {notice ? (
        <p className="plan-refinement-message is-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {notice}
        </p>
      ) : null}

      {assessment ? (
        <div className="plan-impact-preview" aria-live="polite">
          <div className="plan-impact-preview-heading">
            <div>
              <span className="conversation-eyebrow">PROPOSED CHANGE</span>
              <h3>Review the impact before accepting</h3>
            </div>
            <span
              className={`plan-impact-review-tag ${
                assessment.requiresReview ? "is-warning" : "is-ready"
              }`}
            >
              {assessment.requiresReview
                ? "Review recommended"
                : "Preview ready"}
            </span>
          </div>

          <div
            className="plan-impact-comparison"
            aria-label="Current and proposed event comparison"
          >
            <article className="plan-impact-comparison-card is-before">
              <span className="plan-impact-comparison-eyebrow">
                CURRENT PLAN
              </span>
              <h4>Before</h4>

              <dl>
                <div>
                  <dt>Guests</dt>
                  <dd>{assessment.currentEvent.guestCount ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Event date</dt>
                  <dd>{assessment.currentEvent.eventDate ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {[
                      assessment.currentEvent.location?.city,
                      assessment.currentEvent.location?.country,
                    ].filter(Boolean).join(", ") || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt>Spending limit</dt>
                  <dd>
                    {formatMoney(
                      assessment.currentBudget.spendingLimit,
                      currentCurrency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Projected total</dt>
                  <dd>
                    {formatMoney(
                      assessment.currentBudget.projectedTotal,
                      currentCurrency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Remaining funds</dt>
                  <dd>
                    {formatMoney(
                      assessment.currentBudget.remainingBudget,
                      currentCurrency,
                    )}
                  </dd>
                </div>
              </dl>
            </article>

            <article className="plan-impact-comparison-card is-after">
              <span className="plan-impact-comparison-eyebrow">
                PROPOSED PLAN
              </span>
              <h4>After</h4>

              <dl>
                <div>
                  <dt>Guests</dt>
                  <dd>{assessment.proposedEvent.guestCount ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Event date</dt>
                  <dd>{assessment.proposedEvent.eventDate ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>
                    {[
                      assessment.proposedEvent.location?.city,
                      assessment.proposedEvent.location?.country,
                    ].filter(Boolean).join(", ") || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt>Spending limit</dt>
                  <dd>
                    {formatMoney(
                      assessment.proposedBudget.spendingLimit,
                      currentCurrency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Projected total</dt>
                  <dd>
                    {formatMoney(
                      assessment.proposedBudget.projectedTotal,
                      currentCurrency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Remaining funds</dt>
                  <dd>
                    {formatMoney(
                      assessment.proposedBudget.remainingBudget,
                      currentCurrency,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </div>

          <div className="plan-impact-delta-strip">
            <article>
              <span>Projected total change</span>
              <strong
                className={
                  assessment.projectedCostChange > 0
                    ? "is-negative"
                    : assessment.projectedCostChange < 0
                      ? "is-positive"
                      : ""
                }
              >
                {formatDelta(
                  assessment.projectedCostChange,
                  currentCurrency,
                )}
              </strong>
            </article>

            <article>
              <span>Spending limit change</span>
              <strong>
                {formatDelta(
                  assessment.proposedBudget.spendingLimit -
                    assessment.currentBudget.spendingLimit,
                  currentCurrency,
                )}
              </strong>
            </article>

            <article>
              <span>Remaining funds change</span>
              <strong
                className={
                  assessment.remainingBudgetChange > 0
                    ? "is-positive"
                    : assessment.remainingBudgetChange < 0
                      ? "is-negative"
                      : ""
                }
              >
                {formatDelta(
                  assessment.remainingBudgetChange,
                  currentCurrency,
                )}
              </strong>
            </article>
          </div>

          <div className="plan-impact-budget-grid">
            <article>
              <span>Current projected total</span>
              <strong>
                {formatMoney(
                  assessment.currentBudget.projectedTotal,
                  currentCurrency,
                )}
              </strong>
            </article>
            <article>
              <span>Proposed projected total</span>
              <strong>
                {formatMoney(
                  assessment.proposedBudget.projectedTotal,
                  currentCurrency,
                )}
              </strong>
            </article>
            <article>
              <span>Projected total change</span>
              <strong
                className={
                  assessment.projectedCostChange > 0
                    ? "is-negative"
                    : assessment.projectedCostChange < 0
                      ? "is-positive"
                      : ""
                }
              >
                {assessment.projectedCostChange > 0 ? "+" : ""}
                {formatMoney(
                  assessment.projectedCostChange,
                  currentCurrency,
                )}
              </strong>
            </article>
            <article>
              <span>Proposed remaining funds</span>
              <strong>
                {formatMoney(
                  assessment.proposedBudget.remainingBudget,
                  currentCurrency,
                )}
              </strong>
            </article>
          </div>

          <div className="plan-impact-summary">
            <div>
              <h4>What changes</h4>
              <p>
                {assessment.change.kind === "guest_count"
                  ? `Guest count: ${assessment.currentEvent.guestCount ?? "Not set"} -> ${assessment.proposedEvent.guestCount ?? "Not set"}`
                  : assessment.change.kind === "budget"
                    ? `Spending limit: ${formatMoney(
                        assessment.currentBudget.spendingLimit,
                        currentCurrency,
                      )} -> ${formatMoney(
                        assessment.proposedBudget.spendingLimit,
                        currentCurrency,
                      )}`
                    : assessment.change.kind === "event_date"
                      ? `Event date: ${assessment.currentEvent.eventDate ?? "Not set"} -> ${assessment.proposedEvent.eventDate ?? "Not set"}`
                      : `Location: ${assessment.currentEvent.location?.city ?? "Not set"} -> ${assessment.proposedEvent.location?.city ?? "Not set"}`}
              </p>
            </div>

            {assessment.tasksRescheduled > 0 ? (
              <div>
                <h4>Timeline effect</h4>
                <p>
                  {assessment.tasksRescheduled} task date(s) will shift.
                </p>
              </div>
            ) : null}
          </div>

          {assessment.affectedBudgetItems.length > 0 ? (
            <div className="plan-impact-items">
              <h4>Affected budget items</h4>
              <div className="plan-impact-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col">Current</th>
                      <th scope="col">Proposed</th>
                      <th scope="col">Change</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.affectedBudgetItems.map((item) => (
                      <tr key={item.itemId}>
                        <td>
                          <strong>{item.name}</strong>
                          <small>{item.reason}</small>
                        </td>
                        <td>
                          {formatMoney(item.previousAmount, currentCurrency)}
                        </td>
                        <td>
                          {formatMoney(item.proposedAmount, currentCurrency)}
                        </td>
                        <td
                          className={
                            item.proposedAmount > item.previousAmount
                              ? "is-negative"
                              : item.proposedAmount < item.previousAmount
                                ? "is-positive"
                                : ""
                          }
                        >
                          {formatDelta(
                            item.proposedAmount - item.previousAmount,
                            currentCurrency,
                          )}
                        </td>
                        <td>{item.updated ? "Recalculated" : "Review"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {assessment.impacts.length > 0 ? (
            <div className="plan-impact-notices">
              <h4>Impact notes</h4>
              {assessment.impacts.map((impact, index) => (
                <article
                  className={`plan-impact-notice is-${impact.severity}`}
                  key={`${impact.area}-${impact.title}-${index}`}
                >
                  <ChangeIcon area={impact.area} />
                  <div>
                    <strong>{impact.title}</strong>
                    <p>{impact.message}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {assessment.reviewRequiredItems.length > 0 ? (
            <div className="plan-impact-review-list">
              <h4>Items to confirm</h4>
              <ul>
                {assessment.reviewRequiredItems.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!assessment.proposedBudget.isWithinBudget ? (
            <p className="plan-refinement-message is-error">
              <AlertTriangle size={16} aria-hidden="true" />
              The proposed plan is over budget. Accepting this proposal
              will not silently lower any expense; review the figures
              before proceeding.
            </p>
          ) : null}

          <div className="plan-impact-decision">
            <button
              type="button"
              className="studio-button studio-button--primary"
              onClick={acceptChange}
            >
              Accept proposed changes
              <CheckCircle2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="studio-button studio-button--secondary"
              onClick={rejectChange}
            >
              Reject proposal
            </button>
          </div>
        </div>
      ) : null}

      <p className="plan-refinement-footnote">
        Proposals are previews until accepted. Vendor quotes, confirmed
        prices, and actual expenses are not automatically rewritten.
        Unsupported requests are rejected rather than guessed.
      </p>
    </section>
  );
}
