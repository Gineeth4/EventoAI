"use client";

import { useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  History,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import type { PlanResult } from "@/components/planner/event-planner";
import {
  buildRestoredSavedEventRecord,
  buildSavedEventRecord,
  deleteSavedEvent,
} from "@/lib/saved-events";
import { deleteCloudEvent, saveCloudEvent } from "@/lib/cloud-events";
import type {
  SavedEventInput,
  SavedEventRecord,
  SavedEventVersion,
} from "@/types/saved-event";

type Props = {
  record: SavedEventRecord;
};

type PlanApiResponse = {
  success?: boolean;
  data?: PlanResult;
  error?: {
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
] as const;

function splitList(value: string, fallback: string[]): string[] {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  return items.length > 0 ? items : fallback;
}

function cloneInput(input: SavedEventInput): SavedEventInput {
  return {
    ...input,
    location: { ...input.location },
    budget: { ...input.budget },
    preferences: {
      ...input.preferences,
      preferredThemes: [...input.preferences.preferredThemes],
      preferredStyles: [...input.preferences.preferredStyles],
    },
    planningPriorities: [...input.planningPriorities],
  };
}

export default function EventActions({ record }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isRestoringVersion, setIsRestoringVersion] = useState(false);

  const [draft, setDraft] = useState<SavedEventInput>(() =>
    cloneInput(record.input),
  );

  // Keep comma-separated text separate from the parsed arrays.
  // This lets users type naturally, including spaces after commas.
  const [themesText, setThemesText] = useState(
    record.input.preferences.preferredThemes.join(", "),
  );
  const [stylesText, setStylesText] = useState(
    record.input.preferences.preferredStyles.join(", "),
  );

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function startEditing() {
    const original = cloneInput(record.input);

    setDraft(original);
    setThemesText(original.preferences.preferredThemes.join(", "));
    setStylesText(original.preferences.preferredStyles.join(", "));
    setMessage("");
    setErrorMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    const original = cloneInput(record.input);

    setDraft(original);
    setThemesText(original.preferences.preferredThemes.join(", "));
    setStylesText(original.preferences.preferredStyles.join(", "));
    setIsEditing(false);
    setMessage("");
    setErrorMessage("");
  }

  function updateLocation(
    field: "city" | "country" | "venueType",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      location: {
        ...current.location,
        [field]: value,
      },
    }));
  }

  function updateBudget(
    field: "currency" | "totalAmount" | "contingencyPercent",
    value: string,
  ) {
    setDraft((current) => {
      if (field === "currency") {
        return {
          ...current,
          budget: {
            ...current.budget,
            currency: value,
          },
        };
      }

      const amount = value === "" ? 0 : Number(value);

      return {
        ...current,
        budget: {
          ...current.budget,
          [field]: amount,
        },
      };
    });
  }

  function togglePriority(priority: string) {
    setDraft((current) => ({
      ...current,
      planningPriorities: current.planningPriorities.includes(priority)
        ? current.planningPriorities.filter((item) => item !== priority)
        : [...current.planningPriorities, priority],
    }));
  }

  async function handleRegenerate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");
    setIsRegenerating(true);

    // Build a clean payload matching the existing /api/ai/plan contract.
    const payload: SavedEventInput = {
      ...draft,
      title: draft.title.trim(),
      location: {
        city: draft.location.city.trim(),
        country: draft.location.country.trim(),
        venueType: draft.location.venueType,
      },
      budget: {
        ...draft.budget,
      },
      preferences: {
        preferredThemes: splitList(themesText, ["simple"]),
        preferredStyles: splitList(stylesText, ["practical"]),
        notes: draft.preferences.notes.trim(),
      },
      planningPriorities: [...new Set(draft.planningPriorities)],
    };

    const controller = new AbortController();

    const timeoutHandle = window.setTimeout(
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
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as PlanApiResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(
          body.error?.message ??
            "EventoAI could not regenerate this plan. Your previous saved plan has been kept.",
        );
      }

      // Update the existing event ID only after generation succeeds.
      // If the API fails, the old stored record remains untouched.
      const updatedRecord = buildSavedEventRecord(
        {
          id: record.id,
          input: payload,
          result: body.data,
        },
        record,
      );

      await saveCloudEvent(updatedRecord);

      setDraft(cloneInput(updatedRecord.input));
      setThemesText(
        updatedRecord.input.preferences.preferredThemes.join(", "),
      );
      setStylesText(
        updatedRecord.input.preferences.preferredStyles.join(", "),
      );

      setIsEditing(false);
      setMessage("Event details and plan updated and synced to your account.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErrorMessage(
          "Plan regeneration took longer than expected. Your previous saved plan has not been replaced.",
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "The event could not be updated. Your previous saved plan has been kept.",
        );
      }
    } finally {
      window.clearTimeout(timeoutHandle);
      setIsRegenerating(false);
    }
  }

  async function handleRestoreVersion(version: SavedEventVersion) {
    const confirmed = window.confirm(
      `Restore version ${version.version} (${version.createdAt.slice(0, 10)})? This creates a new saved version and clears approval on the restored plan.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setErrorMessage("");
    setIsRestoringVersion(true);

    try {
      const restoredRecord = buildRestoredSavedEventRecord(
        record,
        version.id,
      );

      await saveCloudEvent(restoredRecord);

      const restoredVersionNumber =
        restoredRecord.versions.find(
          (item) => item.id === restoredRecord.currentVersionId,
        )?.version ?? version.version;

      setMessage(
        `Version ${version.version} restored as version ${restoredVersionNumber} and synced to your account. Approval has been cleared; review the plan before relying on it.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The earlier event version could not be restored.",
      );
    } finally {
      setIsRestoringVersion(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${record.input.title}" and its saved plan? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    try {
      // Delete remotely first so a network failure does not erase
      // the only remaining local copy.
      await deleteCloudEvent(record.id);
      deleteSavedEvent(record.id);
      setMessage("Event deleted from your account.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The event could not be deleted.",
      );
    }
  }

  return (
    <section
      className="event-action-panel"
      aria-label="Manage saved event"
    >
      {!isEditing ? (
        <>
        <div className="event-action-toolbar">
          <button
            className="event-action-button"
            type="button"
            onClick={startEditing}
          >
            <Pencil size={15} aria-hidden="true" />
            Edit and regenerate
          </button>

          <button
            className="event-action-button event-action-danger"
            type="button"
            onClick={handleDelete}
          >
            <Trash2 size={15} aria-hidden="true" />
            Delete event
          </button>
        </div>

        <section className="event-version-history" aria-label="Saved event version history">
          <button
            className="event-version-history-toggle"
            type="button"
            aria-expanded={showVersionHistory}
            onClick={() => setShowVersionHistory((current) => !current)}
          >
            <span className="event-version-history-title">
              <History size={17} aria-hidden="true" />
              <span>
                Version history
                <small>
                  {record.versions.length} saved{" "}
                  {record.versions.length === 1 ? "snapshot" : "snapshots"}
                </small>
              </span>
            </span>

            <span className="event-version-history-action">
              {showVersionHistory ? "Hide history" : "View history"}
            </span>
          </button>

          {showVersionHistory && (
            <div className="event-version-list">
              {[...record.versions]
                .sort((a, b) => b.version - a.version)
                .map((version) => {
                  const isCurrent = version.id === record.currentVersionId;

                  const changeLabel =
                    version.changeType === "created"
                      ? "Initial save"
                      : version.changeType === "updated"
                        ? "Updated plan"
                        : version.changeType === "restored"
                          ? `Restored from version ${version.restoredFromVersion ?? "unknown"}`
                          : "Recovered snapshot";

                  return (
                    <article
                      className={`event-version-card ${
                        isCurrent ? "is-current" : ""
                      }`}
                      key={version.id}
                    >
                      <div className="event-version-card-heading">
                        <div>
                          <span className="event-version-number">
                            Version {version.version}
                          </span>

                          <span className="event-version-change">
                            {changeLabel}
                          </span>
                        </div>

                        {isCurrent && (
                          <span className="event-version-current">
                            Current
                          </span>
                        )}
                      </div>

                      <h4>{version.input.title}</h4>

                      <p className="event-version-summary">
                        {version.result.plan.summary}
                      </p>

                      <div className="event-version-meta">
                        <time dateTime={version.createdAt}>
                          {new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(version.createdAt))}
                        </time>

                        <span>{version.input.eventDate}</span>
                        <span>{version.input.guestCount} guests</span>
                      </div>

                      <div className="event-version-budget">
                        <span>Projected total</span>
                        <strong>
                          {new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: version.result.budgetSummary.currency,
                            maximumFractionDigits: 2,
                          }).format(version.result.budgetSummary.projectedTotal)}
                        </strong>
                      </div>

                      {!isCurrent && (
                        <button
                          className="event-action-button event-version-restore"
                          type="button"
                          disabled={isRestoringVersion}
                          onClick={() => handleRestoreVersion(version)}
                          aria-label={`Restore version ${version.version}`}
                        >
                          {isRestoringVersion ? (
                            <>
                              <LoaderCircle
                                size={15}
                                className="event-action-spinner"
                                aria-hidden="true"
                              />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <RotateCcw size={15} aria-hidden="true" />
                              Restore this version
                            </>
                          )}
                        </button>
                      )}
                    </article>
                  );
                })}
            </div>
          )}
        </section>
        </>
      ) : (
        <>
          <div className="event-action-heading">
            <div>
              <h3>Edit event details</h3>
              <p>
                Regenerating creates a new plan from these details.
                The existing saved plan is preserved if regeneration
                fails.
              </p>
            </div>

            <button
              className="event-action-icon-button"
              type="button"
              onClick={cancelEditing}
              disabled={isRegenerating}
              aria-label="Cancel editing"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <form
            className="event-action-form"
            onSubmit={handleRegenerate}
          >
            <div className="event-action-grid">
              <label>
                <span>Event type</span>
                <select
                  value={draft.eventType}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      eventType: event.target.value,
                    }))
                  }
                  required
                >
                  {EVENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Event name</span>
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

              <label>
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

              <label>
                <span>Number of guests</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.guestCount}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      guestCount:
                        event.target.value === ""
                          ? 0
                          : Number(event.target.value),
                    }))
                  }
                  required
                />
              </label>

              <label>
                <span>City</span>
                <input
                  value={draft.location.city}
                  onChange={(event) =>
                    updateLocation("city", event.target.value)
                  }
                  maxLength={100}
                  required
                />
              </label>

              <label>
                <span>Country</span>
                <input
                  value={draft.location.country}
                  onChange={(event) =>
                    updateLocation("country", event.target.value)
                  }
                  maxLength={100}
                  required
                />
              </label>

              <label>
                <span>Venue type</span>
                <select
                  value={draft.location.venueType}
                  onChange={(event) =>
                    updateLocation("venueType", event.target.value)
                  }
                  required
                >
                  <option value="outdoor">Outdoor</option>
                  <option value="indoor">Indoor</option>
                </select>
              </label>

              <label>
                <span>Currency</span>
                <select
                  value={draft.budget.currency}
                  onChange={(event) =>
                    updateBudget("currency", event.target.value)
                  }
                  required
                >
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="GBP">GBP — Pound Sterling</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </label>

              <label>
                <span>Total budget</span>
                <input
                  type="number"
                  min={1}
                  max={1_000_000_000}
                  step="0.01"
                  value={draft.budget.totalAmount}
                  onChange={(event) =>
                    updateBudget("totalAmount", event.target.value)
                  }
                  required
                />
              </label>

              <label>
                <span>Contingency reserve (%)</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={draft.budget.contingencyPercent}
                  onChange={(event) =>
                    updateBudget(
                      "contingencyPercent",
                      event.target.value,
                    )
                  }
                  required
                />
              </label>

              <label>
                <span>Preferred themes</span>
                <input
                  value={themesText}
                  onChange={(event) => setThemesText(event.target.value)}
                  maxLength={300}
                  placeholder="garden, botanical"
                />
              </label>

              <label>
                <span>Preferred styles</span>
                <input
                  value={stylesText}
                  onChange={(event) => setStylesText(event.target.value)}
                  maxLength={300}
                  placeholder="simple, family-friendly"
                />
              </label>
            </div>

            <label className="event-action-notes">
              <span>Additional notes</span>
              <textarea
                value={draft.preferences.notes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    preferences: {
                      ...current.preferences,
                      notes: event.target.value,
                    },
                  }))
                }
                maxLength={600}
                rows={3}
              />
            </label>

            <fieldset className="event-action-priorities">
              <legend>Planning priorities</legend>

              <label>
                <input
                  type="checkbox"
                  checked={draft.planningPriorities.includes("budget")}
                  onChange={() => togglePriority("budget")}
                />
                Budget control
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={draft.planningPriorities.includes(
                    "guest_experience",
                  )}
                  onChange={() => togglePriority("guest_experience")}
                />
                Guest experience
              </label>
            </fieldset>

            <div className="event-action-notice">
              <RotateCcw size={16} aria-hidden="true" />
              <span>
                Changing the inputs regenerates recommendations, budget
                calculations, and the preparation timeline.
              </span>
            </div>

            {errorMessage && (
              <div className="event-action-error" role="alert">
                <AlertTriangle size={17} aria-hidden="true" />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="event-action-toolbar">
              <button
                className="event-action-button"
                type="button"
                onClick={cancelEditing}
                disabled={isRegenerating}
              >
                Cancel
              </button>

              <button
                className="event-action-button event-action-primary"
                type="submit"
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="event-action-spinner"
                      aria-hidden="true"
                    />
                    Regenerating plan...
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} aria-hidden="true" />
                    Save changes and regenerate
                  </>
                )}
              </button>
            </div>
          </form>
        </>
      )}

      {message && (
        <p className="event-action-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {message}
        </p>
      )}

      {!isEditing && errorMessage && (
        <div className="event-action-error" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}
    </section>
  );
}
