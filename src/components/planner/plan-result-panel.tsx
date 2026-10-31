"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Lightbulb,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import PlanRefinementPanel from "@/components/planner/plan-refinement-panel";
import VendorPricingPanel from "@/components/planner/vendor-pricing-panel";
import type { PlanResult } from "@/components/planner/event-planner";
import type { SavedEventInput } from "@/types/saved-event";

export default function PlanResultPanel({
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
  formatMoney,
  formatDate,
  readableLabel,
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
  formatMoney: (amount: number, currency: string) => string;
  formatDate: (value: string) => string;
  readableLabel: (value: string) => string;
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

