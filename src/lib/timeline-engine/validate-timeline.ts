/**
 * EventoAI — Timeline Validation Engine
 *
 * Validates task structures and date relationships before a schedule
 * is displayed or saved.
 *
 * This module checks scheduling consistency. It does not claim that
 * a vendor, venue, or external booking is actually confirmed.
 */

import type {
  DateOnly,
} from "@/types/event";

import type {
  EventTask,
} from "@/types/event-plan";

import {
  dateOnlySchema,
} from "@/lib/validation/event-input";

import {
  eventTasksSchema,
} from "@/lib/validation/event-plan";

/** Machine-readable reasons why a schedule may be invalid. */
export type TimelineIssueCode =
  | "invalid_event_date"
  | "invalid_task_data"
  | "deadline_after_event"
  | "dependency_due_date";

/** One actionable validation issue. */
export type TimelineValidationIssue = {
  code: TimelineIssueCode;
  path: string;
  message: string;
};

/** Result returned when validating a proposed timeline. */
export type TimelineValidationResult =
  | {
      success: true;
      data: EventTask[];
    }
  | {
      success: false;
      issues: TimelineValidationIssue[];
    };

/**
 * Validate a collection of tasks against an event date.
 *
 * The validator checks:
 * 1. Event and task date formats.
 * 2. Required task fields, unique IDs and dependency references.
 * 3. Circular dependencies.
 * 4. Deadlines that fall after the event date.
 * 5. Tasks whose prerequisites have deadlines later than their own.
 *
 * Input is typed as unknown to ensure untrusted data is validated
 * before it is used by the application.
 */
export function validateTimeline(
  input: unknown,
  eventDateInput: unknown,
): TimelineValidationResult {
  const eventDateResult = dateOnlySchema.safeParse(
    eventDateInput,
  );

  if (!eventDateResult.success) {
    return {
      success: false,
      issues: eventDateResult.error.issues.map((issue) => ({
        code: "invalid_event_date",
        path:
          issue.path.map(String).join(".") || "eventDate",
        message: issue.message,
      })),
    };
  }

  const taskResult = eventTasksSchema.safeParse(input);

  if (!taskResult.success) {
    return {
      success: false,
      issues: taskResult.error.issues.map((issue) => ({
        code: "invalid_task_data",
        path:
          issue.path.map(String).join(".") || "tasks",
        message: issue.message,
      })),
    };
  }

  const eventDate: DateOnly = eventDateResult.data;
  const tasks = taskResult.data;

  const issues: TimelineValidationIssue[] = [];

  /**
   * Dates have been validated as YYYY-MM-DD values, so string
   * comparison preserves chronological order.
   */
  tasks.forEach((task, index) => {
    if (task.dueDate > eventDate) {
      issues.push({
        code: "deadline_after_event",
        path: `tasks.${index}.dueDate`,
        message:
          `Task "${task.title}" is due after the event date.`,
      });
    }
  });

  const taskById = new Map(
    tasks.map((task) => [task.id, task]),
  );

  tasks.forEach((task, index) => {
    task.dependsOn.forEach((dependencyId, dependencyIndex) => {
      const dependency = taskById.get(dependencyId);

      // Missing dependency references are reported by the structural
      // schema. Keep this guard in case the implementation changes.
      if (!dependency) {
        return;
      }

      /**
       * A prerequisite should not have a deadline later than the
       * task that depends on it.
       *
       * Equal dates are allowed because some tasks can reasonably
       * be completed on the same calendar day.
       */
      if (dependency.dueDate > task.dueDate) {
        issues.push({
          code: "dependency_due_date",
          path:
            `tasks.${index}.dependsOn.${dependencyIndex}`,
          message:
            `"${task.title}" depends on "${dependency.title}", ` +
            "but that prerequisite is due later.",
        });
      }
    });
  });

  if (issues.length > 0) {
    return {
      success: false,
      issues,
    };
  }

  return {
    success: true,
    data: tasks as EventTask[],
  };
}