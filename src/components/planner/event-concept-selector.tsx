"use client";
import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Wallet,
} from "lucide-react";

import type { EventConcept } from "@/lib/event-concepts/create-event-concepts";

type EventConceptSelectorProps = {
  concepts: EventConcept[];
  eventTitle: string;
  guestCount: number;
  currency: string;
  onSelect: (concept: EventConcept) => void;
  onBack: () => void;
};

function formatMoney(amount: number, currency: string): string {
  return formatCurrencyShared(amount, currency, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

export default function EventConceptSelector({
  concepts,
  eventTitle,
  guestCount,
  currency,
  onSelect,
  onBack,
}: EventConceptSelectorProps) {
  return (
    <main className="event-concept-selector">
      <button
        type="button"
        className="event-concept-back"
        onClick={onBack}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to your event brief
      </button>

      <header className="event-concept-header">
        <p className="event-concept-eyebrow">
          <Sparkles size={15} aria-hidden="true" />
          YOUR EVENT, THREE WAYS
        </p>

        <h1>Choose the direction that feels right.</h1>

        <p className="event-concept-intro">
          We prepared three ways to approach{" "}
          <strong>{eventTitle || "your event"}</strong>
          {guestCount > 0
            ? ` for ${guestCount.toLocaleString("en-IN")} guests`
            : ""}
          . Compare the atmosphere, trade-offs, and budget allocation mix
          before choosing the direction to develop.
        </p>

        <p className="event-concept-disclaimer">
          <Wallet size={16} aria-hidden="true" />
          These are planning scenarios, not vendor quotations. Each
          concept preserves the same total allocation envelope when
          redistributing planning allocations. Actual supplier costs
          still need to be confirmed.
        </p>
      </header>

      <section
        className="event-concept-grid"
        aria-label="Compare event concepts"
      >
        {concepts.map((concept) => {
          const budgetItems = [...concept.result.plan.budget.items]
            .sort(
              (a, b) => b.estimatedAmount - a.estimatedAmount,
            )
            .slice(0, 3);

          return (
            <article
              className={`event-concept-card event-concept-card--${concept.id}`}
              key={concept.id}
            >
              <div className="event-concept-card-top">
                <span className="event-concept-badge">
                  {concept.badge}
                </span>
                <Sparkles
                  size={19}
                  aria-hidden="true"
                  className="event-concept-sparkle"
                />
              </div>

              <h2>{concept.title}</h2>
              <p className="event-concept-subtitle">
                {concept.subtitle}
              </p>

              <p className="event-concept-direction">
                {concept.direction}
              </p>

              <div className="event-concept-total">
                <span>Projected total</span>
                <strong>
                  {formatMoney(
                    concept.result.budgetSummary.projectedTotal,
                    currency,
                  )}
                </strong>
                <small>
                  {concept.result.budgetSummary.isWithinBudget
                    ? "Within the current budget limit"
                    : `${formatMoney(
                        concept.result.budgetSummary.overBudgetAmount,
                        currency,
                      )} above the current budget limit`}
                </small>
              </div>

              <div className="event-concept-detail">
                <h3>Budget approach</h3>
                <p>{concept.budgetStrategy}</p>
              </div>

              <div className="event-concept-detail">
                <h3>Guest experience</h3>
                <p>{concept.guestExperience}</p>
              </div>

              <div className="event-concept-detail">
                <h3>Trade-off to consider</h3>
                <p>{concept.tradeoff}</p>
              </div>

              <div className="event-concept-budget-mix">
                <h3>Largest planned allocations</h3>

                {budgetItems.length > 0 ? (
                  <ul>
                    {budgetItems.map((item) => (
                      <li key={item.id}>
                        <span>{item.name}</span>
                        <strong>
                          {formatMoney(item.estimatedAmount, currency)}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Budget allocations will appear in the plan.</p>
                )}
              </div>

              <button
                type="button"
                className="event-concept-select"
                onClick={() => onSelect(concept)}
              >
                Choose this direction
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </article>
          );
        })}
      </section>

      <footer className="event-concept-footer">
        <CheckCircle2 size={17} aria-hidden="true" />
        <p>
          Choosing a concept makes it your active plan. You can return
          here and explore another direction before continuing.
        </p>
      </footer>
    </main>
  );
}
