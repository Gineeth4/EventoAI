"use client";
import { formatCurrency as formatCurrencyShared } from "@/lib/format-currency";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

import type {
  PlanningIntelligenceReport,
} from "@/lib/planning-intelligence/analyze-event-brief";

type PlanningIntelligencePanelProps = {
  report: PlanningIntelligenceReport;
  currency: string;
};

function formatCurrency(
  amount: number | null,
  currency: string,
): string {
  if (amount === null || !Number.isFinite(amount) || !currency.trim()) {
    return "Not available";
  }

  return formatCurrencyShared(amount, currency);
}

function getPlanningWindowLabel(
  days: number | null,
): string {
  if (days === null) return "Unavailable";
  if (days < 0) return "Date passed";
  if (days === 0) return "Today";

  return `${days} ${days === 1 ? "day" : "days"}`;
}

function getCoverageLabel(score: number): string {
  if (score >= 90) return "Well covered";
  if (score >= 70) return "Nearly ready";
  if (score >= 40) return "Needs detail";

  return "Early draft";
}

export default function PlanningIntelligencePanel({
  report,
  currency,
}: PlanningIntelligencePanelProps) {
  const criticalCount = report.insights.filter(
    (insight) => insight.severity === "critical",
  ).length;

  const warningCount = report.insights.filter(
    (insight) => insight.severity === "warning",
  ).length;

  return (
    <section
      className="conversation-intelligence"
      aria-labelledby="conversation-intelligence-title"
    >
      <div className="conversation-intelligence-heading">
        <span className="conversation-intelligence-icon">
          <Sparkles size={18} aria-hidden="true" />
        </span>

        <div>
          <span className="conversation-eyebrow">
            PLANNING INTELLIGENCE
          </span>
          <h3 id="conversation-intelligence-title">
            Your brief, checked before planning
          </h3>
          <p>{report.summary}</p>
        </div>
      </div>

      <div className="conversation-intelligence-metrics">
        <article className="conversation-intelligence-metric">
          <span>
            <CheckCircle2 size={14} aria-hidden="true" />
            Brief coverage
          </span>
          <strong>{report.coverageScore}%</strong>
          <small>{getCoverageLabel(report.coverageScore)}</small>
        </article>

        <article className="conversation-intelligence-metric">
          <span>
            <CalendarDays size={14} aria-hidden="true" />
            Time until event
          </span>
          <strong>
            {getPlanningWindowLabel(report.planningWindowDays)}
          </strong>
          <small>Based on the selected date</small>
        </article>

        <article className="conversation-intelligence-metric">
          <span>
            <Wallet size={14} aria-hidden="true" />
            Budget per guest
          </span>
          <strong>
            {formatCurrency(report.budgetPerGuest, currency)}
          </strong>
          <small>Spending limit divided by guests</small>
        </article>
      </div>

      <div className="conversation-intelligence-coverage">
        <div className="conversation-intelligence-coverage-label">
          <span>Planning brief coverage</span>
          <strong>{report.coverageScore}%</strong>
        </div>

        <div
          className="conversation-intelligence-coverage-track"
          role="progressbar"
          aria-label="Planning brief coverage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={report.coverageScore}
        >
          <div
            className="conversation-intelligence-coverage-fill"
            style={{ width: `${report.coverageScore}%` }}
          />
        </div>
      </div>

      <div className="conversation-intelligence-alert-summary">
        <span
          className={
            criticalCount > 0
              ? "conversation-intelligence-count is-critical"
              : "conversation-intelligence-count"
          }
        >
          <AlertTriangle size={14} aria-hidden="true" />
          {criticalCount} critical
        </span>

        <span className="conversation-intelligence-count is-warning">
          <ShieldCheck size={14} aria-hidden="true" />
          {warningCount} to review
        </span>

        <span className="conversation-intelligence-count is-neutral">
          <Clock3 size={14} aria-hidden="true" />
          {report.insights.length} total checks
        </span>
      </div>

      {report.insights.length > 0 && (
        <div className="conversation-intelligence-insights">
          <h4>What deserves your attention</h4>

          {report.insights.map((insight) => (
            <article
              className={`conversation-intelligence-insight is-${insight.severity}`}
              key={insight.code}
            >
              <span className="conversation-intelligence-insight-icon">
                {insight.severity === "critical" ? (
                  <AlertTriangle size={16} aria-hidden="true" />
                ) : insight.severity === "warning" ? (
                  <ShieldCheck size={16} aria-hidden="true" />
                ) : (
                  <Sparkles size={16} aria-hidden="true" />
                )}
              </span>

              <div>
                <div className="conversation-intelligence-insight-title">
                  <strong>{insight.title}</strong>
                  <span>
                    {insight.severity === "critical"
                      ? "Critical"
                      : insight.severity === "warning"
                        ? "Review"
                        : "Tip"}
                  </span>
                </div>

                <p>{insight.message}</p>

                <p className="conversation-intelligence-action">
                  <strong>Recommended action:</strong>{" "}
                  {insight.recommendedAction}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {report.priorityActions.length > 0 && (
        <div className="conversation-intelligence-priorities">
          <h4>Preparation priorities</h4>
          <ol>
            {report.priorityActions.map((action, index) => (
              <li key={`${index}-${action}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{action}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="conversation-intelligence-disclaimer">
        These checks are planning guidance, not supplier
        confirmations or verified market prices. Review the
        recommendations and make the final planning decisions yourself.
      </p>
    </section>
  );
}