"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";



import EventActions from "@/components/events/event-actions";
import type { SavedEventRecord } from "@/types/saved-event";
import {
  getImportableLocalEventCount,
  importLocalEventsToCloud,
  loadCloudEvents,
  subscribeToCloudEvents,
} from "@/lib/cloud-events";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
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

function EventDetails({
  record,
}: {
  record: SavedEventRecord;
}) {
  const result = record.result;
  const currency = result.budgetSummary.currency;

  return (
    <div className="events-details">
      <section className="events-detail-section">
        <h3>Plan overview</h3>
        <p>{result.plan.summary}</p>

        <div className="events-detail-metrics">
          <div>
            <span>Spending limit</span>
            <strong>
              {formatMoney(
                result.budgetSummary.spendingLimit,
                currency,
              )}
            </strong>
          </div>

          <div>
            <span>Projected total</span>
            <strong>
              {formatMoney(
                result.budgetSummary.projectedTotal,
                currency,
              )}
            </strong>
          </div>

          <div>
            <span>Contingency reserve</span>
            <strong>
              {formatMoney(
                result.budgetSummary.contingencyReserve,
                currency,
              )}
            </strong>
          </div>

          <div>
            <span>Budget remaining</span>
            <strong
              className={
                result.budgetSummary.isWithinBudget
                  ? "events-positive"
                  : "events-negative"
              }
            >
              {formatMoney(
                result.budgetSummary.remainingBudget,
                currency,
              )}
            </strong>
          </div>
        </div>
      </section>

      {result.budgetWarnings.length > 0 && (
        <section className="events-detail-section">
          <h3>Budget warnings</h3>

          <div className="events-warning-list">
            {result.budgetWarnings.map((warning, index) => (
              <div
                className={`events-warning events-warning-${warning.severity}`}
                key={`${warning.code}-${index}`}
              >
                {warning.message}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="events-detail-section">
        <h3>Budget breakdown</h3>

        <div className="events-budget-list">
          {result.plan.budget.items.map((item) => (
            <div className="events-budget-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {readableLabel(item.category)} ·{" "}
                  {readableLabel(item.costStatus)}
                </span>
              </div>

              <strong>
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
            </div>
          ))}
        </div>
      </section>

      <section className="events-detail-section">
        <h3>
          Preparation timeline ({result.plan.tasks.length} tasks)
        </h3>

        <div className="events-task-list">
          {[...result.plan.tasks]
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .map((task) => (
              <article className="events-task" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  {task.description && <p>{task.description}</p>}
                </div>

                <div className="events-task-meta">
                  <span>{formatDate(task.dueDate)}</span>
                  <span>{readableLabel(task.status)}</span>
                  <span>{readableLabel(task.priority)} priority</span>
                </div>
              </article>
            ))}
        </div>
      </section>

      {result.plan.recommendations.length > 0 && (
        <section className="events-detail-section">
          <h3>Recommendations</h3>

          <div className="events-recommendations">
            {result.plan.recommendations.map((recommendation) => (
              <article
                className="events-recommendation"
                key={recommendation.id}
              >
                <span>{readableLabel(recommendation.category)}</span>
                <strong>{recommendation.title}</strong>
                <p>{recommendation.description}</p>
                <p>
                  <b>Why it fits:</b> {recommendation.whyItFits}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {result.plan.assumptions.length > 0 && (
        <section className="events-detail-section">
          <h3>Planning assumptions</h3>
          <ul>
            {result.plan.assumptions.map((assumption, index) => (
              <li key={`${index}-${assumption}`}>{assumption}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="events-disclaimer">
        Saved results are a snapshot of the plan when it was generated.
        Budget allocations and estimates are not verified supplier quotes.
      </p>
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<SavedEventRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoadingCloudEvents, setIsLoadingCloudEvents] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [localImportCount, setLocalImportCount] = useState(0);
  const [cloudSyncMessage, setCloudSyncMessage] = useState("");
  const [cloudSyncError, setCloudSyncError] = useState("");

  useEffect(() => {
    let active = true;

    async function refreshCloudEvents() {
      try {
        const cloudRecords = await loadCloudEvents();

        if (!active) {
          return;
        }

        setEvents(cloudRecords);
        setCloudSyncError("");
        setIsLoadingCloudEvents(false);
        setCloudSyncMessage(
          `Loaded ${cloudRecords.length} event(s) from your account.`,
        );
      } catch {
        if (!active) {
          return;
        }

        setCloudSyncError(
          "Your account events could not be loaded. Check your connection and sign-in, then retry.",
        );
        setIsLoadingCloudEvents(false);
      }

      try {
        const count = await getImportableLocalEventCount();

        if (active) {
          setLocalImportCount(count);
        }
      } catch {
        if (active) {
          setLocalImportCount(0);
        }
      }
    }

    void refreshCloudEvents();

    const unsubscribe = subscribeToCloudEvents(() => {
      void refreshCloudEvents();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function handleImportLocalEvents() {
    if (isImporting) {
      return;
    }

    const confirmed = window.confirm(
      `Import ${localImportCount} browser-only event(s) into the currently signed-in account? Existing cloud records and previously deleted IDs will not be overwritten.`,
    );

    if (!confirmed) {
      return;
    }

    setIsImporting(true);
    setCloudSyncError("");
    setCloudSyncMessage("");

    try {
      const result = await importLocalEventsToCloud();
      const cloudRecords = await loadCloudEvents();
      const remainingImportCount = await getImportableLocalEventCount();

      setEvents(cloudRecords);
      setLocalImportCount(remainingImportCount);
      setCloudSyncMessage(
        `Import complete: ${result.importedCount} imported, ${result.skippedCount} skipped because their IDs already exist, ${result.cloudCount} active cloud event(s).`,
      );
    } catch (error) {
      setCloudSyncError(
        error instanceof Error
          ? error.message
          : "The browser event import did not complete.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="events-page">
      <div className="events-container">
        {cloudSyncMessage ? (
          <p className="events-disclaimer" role="status">
            {cloudSyncMessage}
          </p>
        ) : null}

        {cloudSyncError ? (
          <p className="events-disclaimer" role="alert">
            {cloudSyncError}
          </p>
        ) : null}

        {localImportCount > 0 ? (
          <section className="events-empty" aria-label="Import browser-saved events">
            <h2>Browser-saved events available</h2>
            <p>
              {localImportCount} event record(s) on this device are not in your
              current account. They will not be imported automatically.
              Import only if these records belong in the currently signed-in account.
            </p>
            <button
              className="events-primary-button"
              type="button"
              disabled={isImporting}
              onClick={() => void handleImportLocalEvents()}
            >
              {isImporting
                ? "Importing events..."
                : `Review and import ${localImportCount} event(s)`}
            </button>
          </section>
        ) : null}

        <header className="events-header">
          <Link className="events-brand" href="/">
            <span className="events-brand-icon">
              <CalendarDays size={21} aria-hidden="true" />
            </span>

            <span>
              <strong>EventoAI</strong>
              <small>Moments, thoughtfully planned</small>
            </span>
          </Link>

          <Link className="events-back-link" href="/plan">
            <ArrowLeft size={16} aria-hidden="true" />
            Create a plan
          </Link>
        </header>

        <section className="events-intro">
          <span className="events-eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            Your planning workspace
          </span>

          <h1>My Events</h1>

          <p>
            Revisit saved plans, review their budget breakdowns,
            and check the preparation timeline without generating
            everything again.
          </p>

          <div className="events-count">
            {events.length} saved {events.length === 1 ? "event" : "events"}
          </div>
        </section>

        {isLoadingCloudEvents ? (
          <section className="events-empty" role="status">
            <h2>Loading your account events...</h2>
            <p>Retrieving saved plans from your account.</p>
          </section>
        ) : cloudSyncError ? (
          <section className="events-empty" role="alert">
            <h2>Unable to load account events</h2>
            <p>Retry after checking your connection and sign-in.</p>
            <button
              className="events-primary-button"
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("eventoai:cloud-events-changed"))
              }
            >
              Retry loading
            </button>
          </section>
        ) : events.length === 0 ? (
          <section className="events-empty">
            <span className="events-empty-icon">
              <CalendarDays size={26} aria-hidden="true" />
            </span>

            <h2>Your saved events will appear here</h2>

            <p>
              Save an event plan while signed in to keep it in your account.
              Browser-only event records can be imported above after confirmation.
            </p>

            <Link className="events-primary-button" href="/plan">
              Create your first plan
            </Link>
          </section>
        ) : (
          <section className="events-list" aria-label="Saved events">
            {events.map((record) => {
              const expanded = expandedId === record.id;
              const input = record.input;
              const result = record.result;

              return (
                <article className="events-card" key={record.id}>
                  <div className="events-card-content">
                    <div className="events-card-heading">
                      <div>
                        <span className="events-type">
                          {readableLabel(input.eventType)}
                        </span>

                        <h2>{input.title}</h2>

                        <p className="events-summary">
                          {result.plan.summary}
                        </p>
                      </div>

                      <span
                        className={
                          result.generationMode === "ai_enhanced"
                            ? "events-status events-status-ai"
                            : "events-status events-status-local"
                        }
                      >
                        {result.generationMode === "ai_enhanced"
                          ? "AI-enhanced"
                          : "Local plan"}
                      </span>
                    </div>

                    <div className="events-metadata">
                      <span>
                        <CalendarDays size={15} aria-hidden="true" />
                        {formatDate(input.eventDate)}
                      </span>

                      <span>
                        <Users size={15} aria-hidden="true" />
                        {input.guestCount} guests
                      </span>

                      <span>
                        <MapPin size={15} aria-hidden="true" />
                        {input.location.city}, {input.location.country}
                      </span>

                      <span>
                        <Wallet size={15} aria-hidden="true" />
                        {formatMoney(
                          result.budgetSummary.projectedTotal,
                          result.budgetSummary.currency,
                        )}
                      </span>

                      <span>
                        <Clock3 size={15} aria-hidden="true" />
                        Updated {formatDate(record.updatedAt.slice(0, 10))}
                      </span>
                    </div>

                    <div className="events-card-footer">
                      <span
                        className={
                          result.budgetSummary.isWithinBudget
                            ? "events-budget-status events-positive"
                            : "events-budget-status events-negative"
                        }
                      >
                        {result.budgetSummary.isWithinBudget
                          ? "Within budget"
                          : "Over budget"}
                      </span>

                      <button
                        className="events-toggle-button"
                        type="button"
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedId(expanded ? null : record.id)
                        }
                      >
                        {expanded ? (
                          <>
                            Hide saved plan
                            <ChevronUp size={16} aria-hidden="true" />
                          </>
                        ) : (
                          <>
                            View saved plan
                            <ChevronDown size={16} aria-hidden="true" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <EventActions record={record} />

                  {expanded && <EventDetails record={record} />}
                </article>
              );
            })}
          </section>
        )}

        <footer className="events-footer">
          <p>
            This list shows active event records in your signed-in account.
            Browser-only records are kept separate until you explicitly import them.
          </p>
        </footer>
      </div>
    </main>
  );
}