import {
  planChangeSchema,
  type PlanChange,
} from "@/lib/plan-impact/assess-plan-change";

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const amount = Number(value.replaceAll(",", ""));

  return Number.isFinite(amount) ? amount : null;
}

/**
 * Parse only explicitly supported, unambiguous change requests.
 * Unsupported requests return null; callers must never guess a mutation.
 */
export function parsePlanChangeRequest(
  request: string,
): PlanChange | null {
  const text = request.trim().replace(/\s+/g, " ");

  if (!text || text.length > 1000) {
    return null;
  }

  // Dates: ISO YYYY-MM-DD or Indian-style DD/MM/YYYY and DD-MM-YYYY.
  const dateMatch = text.match(
    /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/,
  );

  if (
    dateMatch &&
    /\b(date|reschedule|postpone|schedule|move|shift)\b/i.test(text)
  ) {
    let dateValue = dateMatch[1];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      const parts = dateValue.split(/[/-]/);
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      dateValue = `${year}-${month}-${day}`;
    }

    const candidate = planChangeSchema.safeParse({
      kind: "event_date",
      value: dateValue,
    });

    return candidate.success ? candidate.data : null;
  }

  // Guest count: prefer the number attached to a guest label or
  // the value immediately following an explicit change cue.
  if (/\b(guest|guests|attendee|attendees|headcount|people|persons)\b/i.test(text)) {
    const contextualMatch = text.match(
      /\b(?:guest count|number of guests|headcount|attendee count|guests|attendees|people|persons)\b[\s\S]{0,45}?\b(?:to|at|of|be)\s*(\d[\d,]*)/i,
    );

    const labelledMatch = text.match(
      /(\d[\d,]*)\s*(?:guests?|attendees?|people|persons)\b/i,
    );

    const amount = parseNumber(
      contextualMatch?.[1] ?? labelledMatch?.[1],
    );

    if (amount !== null) {
      const candidate = planChangeSchema.safeParse({
        kind: "guest_count",
        value: amount,
      });

      return candidate.success ? candidate.data : null;
    }
  }

  // Total spending limit, not a direct reduction of expense items.
  if (/\b(budget|spending limit|spend limit|budget cap)\b/i.test(text)) {
    const match = text.match(
      /\b(?:budget|spending limit|spend limit|budget cap)\b[\s\S]{0,65}?\b(?:to|at|of|be)\s*(?:(?:INR|Rs\.?)\s*)?[^0-9A-Za-z]{0,4}\s*(\d[\d,]*(?:\.\d+)?)/i,
    );

    const amount = parseNumber(match?.[1]);

    if (amount !== null) {
      const candidate = planChangeSchema.safeParse({
        kind: "budget",
        value: amount,
      });

      return candidate.success ? candidate.data : null;
    }
  }

  // Location: use the final location following to/in/at. Preserve
  // country and venue settings later when applying the assessment.
  if (/\b(location|city|venue|relocate|move)\b/i.test(text)) {
    const connectorPattern =
      /\b(?:to|in|at|be)\s+([A-Za-z][A-Za-z .'-]{1,59})/gi;

    const matches = [...text.matchAll(connectorPattern)];
    const lastMatch = matches[matches.length - 1];

    if (lastMatch?.[1]) {
      let city = lastMatch[1]
        .replace(/\b(?:because|with|for|and|while)\b.*$/i, "")
        .replace(/[.!?,;:]+$/, "")
        .trim();

      city = city.replace(/\s+/g, " ");

      if (city.length >= 2 && city.length <= 120) {
        const candidate = planChangeSchema.safeParse({
          kind: "location",
          value: { city },
        });

        return candidate.success ? candidate.data : null;
      }
    }
  }

  return null;
}
