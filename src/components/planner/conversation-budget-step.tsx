"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ConversationDraft } from "@/types/conversation-draft";
import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";
import { ArrowRight } from "lucide-react";

type ConversationBudgetStepProps = {
  draft: ConversationDraft;
  setDraft: Dispatch<SetStateAction<ConversationDraft>>;
  onBack: () => void;
  onContinue: (patch: Partial<ConversationDraft>) => void;
};

function formatBudgetPreset(value: number, currency: string): string {
  return formatCurrencyShared(value, currency, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

const BUDGET_OPTIONS: Record<
  string,
  { value: number; label: string }[]
> = {
  INR: [
    { value: 10000, label: formatBudgetPreset(10000, "INR") },
    { value: 25000, label: formatBudgetPreset(25000, "INR") },
    { value: 50000, label: formatBudgetPreset(50000, "INR") },
    { value: 100000, label: formatBudgetPreset(100000, "INR") },
  ],
  USD: [
    { value: 250, label: formatBudgetPreset(250, "USD") },
    { value: 500, label: formatBudgetPreset(500, "USD") },
    { value: 1000, label: formatBudgetPreset(1000, "USD") },
    { value: 2500, label: formatBudgetPreset(2500, "USD") },
  ],
  GBP: [
    { value: 200, label: formatBudgetPreset(200, "GBP") },
    { value: 500, label: formatBudgetPreset(500, "GBP") },
    { value: 1000, label: formatBudgetPreset(1000, "GBP") },
    { value: 2500, label: formatBudgetPreset(2500, "GBP") },
  ],
  EUR: [
    { value: 250, label: formatBudgetPreset(250, "EUR") },
    { value: 500, label: formatBudgetPreset(500, "EUR") },
    { value: 1000, label: formatBudgetPreset(1000, "EUR") },
    { value: 2500, label: formatBudgetPreset(2500, "EUR") },
  ],
};

export default function ConversationBudgetStep({
  draft,
  setDraft,
  onBack: goBack,
  onContinue: continueWith,
}: ConversationBudgetStepProps) {
  return (
    <form
                      className="conversation-single-form"
                      onSubmit={(event) => {
                        event.preventDefault();

                        continueWith({
                          currency: draft.currency,
                          totalAmount: draft.totalAmount,
                          contingencyPercent:
                            draft.contingencyPercent || "10",
                        });
                      }}
                    >
                      <div className="conversation-field-grid">
                        <label className="conversation-field">
                          <span>Currency</span>
                          <select
                            value={draft.currency}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                currency: event.target.value,
                              }))
                            }
                            required
                          >
                            <option value="">Choose currency</option>
                            <option value="INR">INR - Indian Rupee</option>
    <option value="USD">USD - US Dollar</option>
    <option value="GBP">GBP - Pound Sterling</option>
    <option value="EUR">EUR - Euro</option>
                          </select>
                        </label>

                        <label className="conversation-field">
                          <span>Total spending limit</span>
                          <input
                            type="number"
                            min={1}
                            max={1_000_000_000}
                            step="0.01"
                            value={draft.totalAmount}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                totalAmount: event.target.value,
                              }))
                            }
                            placeholder="Enter your limit"
                            required
                          />
                        </label>
                      </div>

                      {draft.currency && (
                        <div className="conversation-choice-block">
                          <span id="budget-presets-label">Or choose a starting amount</span>

                          <div className="conversation-quick-choices" role="group" aria-labelledby="budget-presets-label">
                            {(
                              BUDGET_OPTIONS[draft.currency] ?? []
                            ).map((option) => (
                              <button
                                key={option.value}
                                className={
                                  draft.totalAmount ===
                                  String(option.value)
                                    ? "is-selected"
                                    : ""
                                }
                                type="button"
                                aria-pressed={draft.totalAmount === String(option.value)}
                                onClick={() =>
                                  setDraft((current) => ({
                                    ...current,
                                    totalAmount: String(option.value),
                                  }))
                                }
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="conversation-choice-block">
                        <span id="contingency-options-label">
                          Contingency reserve{" "}
                          <small>Suggested: 10%</small>
                        </span>

                        <div className="conversation-quick-choices" role="group" aria-labelledby="contingency-options-label">
                          {[5, 10, 15].map((percent) => (
                            <button
                              key={percent}
                              className={
                                draft.contingencyPercent ===
                                String(percent)
                                  ? "is-selected"
                                  : ""
                              }
                              type="button"
                              aria-pressed={draft.contingencyPercent === String(percent)}
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  contingencyPercent: String(percent),
                                  contingencyChosen: true,
                                }))
                              }
                            >
                              {percent}%
                              {percent === 10 ? "  -  Balanced" : ""}
                            </button>
                          ))}
                        </div>
                      </div>

                      <p className="conversation-field-help">
                        The reserve is included in your spending limit,
                        not added on top of it. You can change it before
                        generating the plan.
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
                          disabled={
                            !draft.currency ||
                            !Number.isFinite(
                              Number(draft.totalAmount),
                            ) ||
                            Number(draft.totalAmount) <= 0
                          }
                        >
                          Continue
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </form>
  );
}
