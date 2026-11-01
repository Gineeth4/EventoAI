/**
 * EventoAI — Timeline Generation Engine
 *
 * Generates a practical starting schedule for weddings, birthdays,
 * and community events.
 *
 * Dates and dependencies are calculated deterministically.
 * This engine does not require a Gemini API call.
 */

import type {
  DateOnly,
  EventType,
} from "@/types/event";

import type {
  EventTask,
} from "@/types/event-plan";

import { dateOnlySchema } from "@/lib/validation/event-input";
import { validateTimeline } from "@/lib/timeline-engine/validate-timeline";
import { getTimelineTemplates } from "@/lib/timeline-engine/timeline-templates";

/** Minimum information required to create a schedule. */
export type TimelineGenerationInput = {
  eventType: EventType;
  eventDate: DateOnly;
};

/**
 * Optional ID factory.
 *
 * Production uses UUIDs so tasks from different events can have
 * globally unique identifiers. Injecting a factory also makes
 * automated tests reproducible.
 */
export type TimelineGenerationOptions = {
  idFactory?: () => string;
};

/**
 * Subtract whole calendar days in UTC.
 *
 * Using UTC prevents daylight-saving transitions and local machine
 * time zones from shifting date-only deadlines.
 */
function subtractDays(
  eventDate: DateOnly,
  daysBeforeEvent: number,
): DateOnly {
  const date = new Date(`${eventDate}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() - daysBeforeEvent);

  return date.toISOString().slice(0, 10);
}

/**
 * Generate a preparation timeline for an event.
 *
 * The returned plan is a starting template. Users should be able
 * to edit dates and task statuses later; AI may personalize task
 * descriptions in a separate layer.
 */
export function generateTimeline(
  input: TimelineGenerationInput,
  options: TimelineGenerationOptions = {},
): EventTask[] {
  // Reject malformed calendar dates before calculating deadlines.
  const eventDate = dateOnlySchema.parse(input.eventDate);

  const templates = getTimelineTemplates(input.eventType);

  // Check that the internal template keys are unique.
  const templateKeys = new Set<string>();

  for (const template of templates) {
    if (templateKeys.has(template.key)) {
      throw new Error(
        `Duplicate timeline template key: "${template.key}".`,
      );
    }

    templateKeys.add(template.key);
  }

  // UUIDs prevent ID collisions between different events.
  const idFactory =
    options.idFactory ??
    (() => globalThis.crypto.randomUUID());

  const idByKey = new Map<string, string>();

  for (const template of templates) {
    const id = idFactory();

    if (!id.trim()) {
      throw new Error(
        "The timeline ID factory returned an empty ID.",
      );
    }

    if ([...idByKey.values()].includes(id)) {
      throw new Error(
        `The timeline ID factory returned a duplicate ID: "${id}".`,
      );
    }

    idByKey.set(template.key, id);
  }

  // Resolve dependency keys into the generated task IDs.
  const tasks: EventTask[] = templates.map((template) => {
    const dependencies = template.dependsOn.map(
      (dependencyKey) => {
        const dependencyId = idByKey.get(dependencyKey);

        if (!dependencyId) {
          throw new Error(
            `Timeline template "${template.key}" references ` +
              `missing dependency "${dependencyKey}".`,
          );
        }

        return dependencyId;
      },
    );

    return {
      id: idByKey.get(template.key)!,
      title: template.title,
      description: template.description,
      dueDate: subtractDays(
        eventDate,
        template.daysBeforeEvent,
      ),
      category: template.category,
      priority: template.priority,
      status: "todo",
      dependsOn: dependencies,
      estimatedDurationHours:
        template.estimatedDurationHours,
      isMilestone: template.isMilestone ?? false,
    };
  });

  // Validate the completed schedule before returning it.
  const validation = validateTimeline(tasks, eventDate);

  if (!validation.success) {
    const details = validation.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Generated timeline failed validation: ${details}`,
    );
  }

  return validation.data;
}