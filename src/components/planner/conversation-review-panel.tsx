"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { CheckCircle2, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import PlanningIntelligencePanel from "@/components/planner/planning-intelligence-panel";
import type { ConversationDraft } from "@/types/conversation-draft";

type ReviewNavigationStep = "occasion" | "date" | "guests" | "location" | "budget";

type ConversationReviewPanelProps = {
  draft: ConversationDraft;
  setDraft: Dispatch<SetStateAction<ConversationDraft>>;
  errorMessage: string;
  isGenerating: boolean;
  generatePlan: () => Promise<void>;
  goBack: () => void;
  goToStep: (target: ReviewNavigationStep) => void;
  planningReport: ComponentProps<typeof PlanningIntelligencePanel>["report"];
  formatMoney: (amount: number, currency: string) => string;
  formatDate: (value: string) => string;
  readableLabel: (value: string) => string;
  isValidDateOnly: (value: string) => boolean;
};

export default function ConversationReviewPanel({
  draft,
  setDraft,
  errorMessage,
  isGenerating,
  generatePlan,
  goBack,
  goToStep,
  planningReport,
  formatMoney,
  formatDate,
  readableLabel,
  isValidDateOnly,
}: ConversationReviewPanelProps) {
  return (
    <div className="conversation-review">
      <div className="conversation-review-title">
        <span className="conversation-review-check">
          <CheckCircle2
            size={20}
            aria-hidden="true"
          />
        </span>

        <div>
          <strong>Your brief is ready to use</strong>
          <p>
            Check the details and make changes before
            generating your first plan.
          </p>
        </div>
      </div>

      <label className="conversation-field">
        <span>Suggested event title</span>
        <input
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          maxLength={160}
          required
        />
      </label>

      <PlanningIntelligencePanel
        report={planningReport}
        currency={draft.currency}
      />

      <div className="conversation-review-grid">
        <article>
          <span>Occasion</span>
          <strong>
            {readableLabel(draft.eventType)}
          </strong>
          <button
            type="button"
            aria-label="Change occasion"
            onClick={() => goToStep("occasion")}
          >
            Change
          </button>
        </article>

        <article>
          <span>Date</span>
          <strong>{formatDate(draft.eventDate)}</strong>
          <button
            type="button"
            aria-label="Change date"
            onClick={() => goToStep("date")}
          >
            Change
          </button>
        </article>

        <article>
          <span>Guests</span>
          <strong>{draft.guestCount}</strong>
          <button
            type="button"
            aria-label="Change guest count"
            onClick={() => goToStep("guests")}
          >
            Change
          </button>
        </article>

        <article>
          <span>Location</span>
          <strong>
            {draft.city}, {draft.country}
          </strong>
          <button
            type="button"
            aria-label="Change location"
            onClick={() => goToStep("location")}
          >
            Change
          </button>
        </article>

        <article>
          <span>Spending limit</span>
          <strong>
            {formatMoney(
              Number(draft.totalAmount),
              draft.currency,
            )}
          </strong>
          <button
            type="button"
            aria-label="Change spending limit"
            onClick={() => goToStep("budget")}
          >
            Change
          </button>
        </article>

        <article>
          <span>Contingency reserve</span>
          <strong>
            {draft.contingencyPercent || "10"}%
            {!draft.contingencyChosen
              ? "  -  Suggested"
              : ""}
          </strong>
          <button
            type="button"
            aria-label="Change contingency reserve"
            onClick={() => goToStep("budget")}
          >
            Change
          </button>
        </article>
      </div>

      <div className="conversation-review-tags">
        {[
          ...draft.themes.map((item) => ({ kind: "theme", item })),
          ...draft.styles.map((item) => ({ kind: "style", item })),
        ].map(({ item, kind }) => (
          <span key={`${kind}-${item}`}>
            {readableLabel(item)}
          </span>
        ))}
      </div>

      {draft.assumptions.length > 0 && (
        <div className="conversation-assumption-note">
          <ShieldCheck
            size={16}
            aria-hidden="true"
          />

          <div>
            <strong>Planning assumptions</strong>
            <ul>
              {draft.assumptions.map(
                (item, index) => (
                  <li key={`${index}-${item}`}>
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          className="conversation-error"
          role="alert"
        >
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="conversation-question-actions">
        <button
          className="studio-button studio-button--secondary"
          type="button"
          onClick={goBack}
          disabled={isGenerating}
        >
          Back
        </button>

        <button
          className="studio-button studio-button--primary studio-button--lg"
          type="button"
          onClick={generatePlan}
          disabled={
            isGenerating ||
            !draft.title.trim() ||
            !draft.eventType ||
            !isValidDateOnly(draft.eventDate) ||
            !Number.isInteger(
              Number(draft.guestCount),
            ) ||
            Number(draft.guestCount) < 1 ||
            !draft.city.trim() ||
            !draft.country.trim() ||
            !draft.venueType ||
            !draft.currency ||
            Number(draft.totalAmount) <= 0
          }
        >
          {isGenerating ? (
            <>
              <LoaderCircle
                className="studio-button__spinner"
                size={17}
                aria-hidden="true"
              />
              Creating your plan...
            </>
          ) : (
            <>
              Create my first plan
              <Sparkles
                size={17}
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </div>

      {isGenerating && (
        <div
          className="conversation-generating"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            className="conversation-generating-spinner"
            size={21}
            aria-hidden="true"
          />

          <div>
            <strong>
              Putting the pieces together
            </strong>
            <p>
              Preparing your recommendations, budget,
              and preparation timeline.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
