/**
 * EventoAI — Complete event-plan validation
 *
 * AI-generated output is untrusted input. A successful model response
 * must pass structural and consistency checks before the application
 * uses it or saves it.
 */

import { z } from "zod";

import { CURRENCY_CODES } from "@/types/event";

import {
  IDEA_CATEGORIES,
  VENDOR_CATEGORIES,
  VENDOR_SOURCE_STATUSES,
} from "@/types/recommendation";

import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/types/event-plan";

import { dateOnlySchema } from "@/lib/validation/event-input";

import {
  budgetPlanDraftSchema,
  moneyAmountSchema,
} from "@/lib/validation/budget";

/** Validate a personalized creative recommendation. */
export const eventIdeaRecommendationSchema = z
  .object({
    id: z.string().trim().min(1).max(80),

    title: z.string().trim().min(1).max(180),

    category: z.enum(IDEA_CATEGORIES),

    description: z.string().trim().min(1).max(2000),

    whyItFits: z.string().trim().min(1).max(1500),

    estimatedCost: moneyAmountSchema.optional(),

    currency: z.enum(CURRENCY_CODES).optional(),

    tags: z
      .array(z.string().trim().min(1).max(60))
      .max(12),
  })
  .strict()
  .superRefine((recommendation, context) => {
    // A stated price must always identify its currency.
    if (
      recommendation.estimatedCost !== undefined &&
      recommendation.currency === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message:
          "A recommendation with an estimated cost requires a currency.",
      });
    }
  });

/**
 * Validate a vendor or service suggestion.
 *
 * This checks the data structure, not whether a real-world business
 * exists. External source and availability checks remain the
 * responsibility of the vendor integration.
 */
export const vendorSuggestionSchema = z
  .object({
    id: z.string().trim().min(1).max(80),

    serviceCategory: z.enum(VENDOR_CATEGORIES),

    displayName: z.string().trim().min(1).max(200),

    description: z.string().trim().min(1).max(2000),

    whyItFits: z.string().trim().min(1).max(1500),

    estimatedCost: moneyAmountSchema.optional(),

    currency: z.enum(CURRENCY_CODES).optional(),

    sourceStatus: z.enum(VENDOR_SOURCE_STATUSES),

    sourceLabel: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),

    sourceUrl: z
      .string()
      .url()
      .max(2048)
      .optional(),

    locationLabel: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional(),
  })
  .strict()
  .superRefine((vendor, context) => {
    if (
      vendor.estimatedCost !== undefined &&
      vendor.currency === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["currency"],
        message:
          "A vendor cost estimate requires a currency.",
      });
    }

    // A sourced or verified listing must include its evidence reference.
    if (
      (vendor.sourceStatus === "source_listed" ||
        vendor.sourceStatus === "verified") &&
      (!vendor.sourceUrl || !vendor.sourceLabel)
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message:
          "Sourced vendor information requires a source URL and source label.",
      });
    }
  });

/** Validate one preparation task. */
export const eventTaskSchema = z
  .object({
    id: z.string().trim().min(1).max(80),

    title: z.string().trim().min(1).max(180),

    description: z
      .string()
      .trim()
      .max(1500)
      .optional(),

    dueDate: dateOnlySchema,

    category: z.enum(TASK_CATEGORIES),

    priority: z.enum(TASK_PRIORITIES),

    status: z.enum(TASK_STATUSES),

    dependsOn: z
      .array(z.string().trim().min(1).max(80))
      .max(100),

    estimatedDurationHours: z
      .number()
      .min(0)
      .max(10_000)
      .optional(),

    isMilestone: z.boolean().optional(),
  })
  .strict()
  .superRefine((task, context) => {
    // A task must not depend directly on itself.
    if (task.dependsOn.includes(task.id)) {
      context.addIssue({
        code: "custom",
        path: ["dependsOn"],
        message: "A task cannot depend on itself.",
      });
    }

    // Repeated dependency IDs are usually accidental.
    if (new Set(task.dependsOn).size !== task.dependsOn.length) {
      context.addIssue({
        code: "custom",
        path: ["dependsOn"],
        message: "Task dependencies must be unique.",
      });
    }
  });

/**
 * Validate all task references and detect circular dependencies.
 *
 * Example of a cycle:
 *   Task A depends on Task B
 *   Task B depends on Task C
 *   Task C depends on Task A
 *
 * Such a plan cannot be followed in a logical order.
 */
export const eventTasksSchema = z
  .array(eventTaskSchema)
  .max(500)
  .superRefine((tasks, context) => {
    const taskMap = new Map<string, (typeof tasks)[number]>();

    tasks.forEach((task, index) => {
      if (taskMap.has(task.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Task IDs must be unique.",
        });
      }

      taskMap.set(task.id, task);
    });

    // Every referenced dependency must exist in this plan.
    tasks.forEach((task, index) => {
      task.dependsOn.forEach((dependencyId, dependencyIndex) => {
        if (!taskMap.has(dependencyId)) {
          context.addIssue({
            code: "custom",
            path: [
              index,
              "dependsOn",
              dependencyIndex,
            ],
            message:
              `Dependency "${dependencyId}" does not exist in this plan.`,
          });
        }
      });
    });

    // Perform a depth-first traversal to detect dependency cycles.
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function hasCycle(taskId: string): boolean {
      if (visiting.has(taskId)) {
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visiting.add(taskId);

      const task = taskMap.get(taskId);

      for (const dependencyId of task?.dependsOn ?? []) {
        // Missing dependencies have already been reported above.
        if (
          taskMap.has(dependencyId) &&
          hasCycle(dependencyId)
        ) {
          return true;
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);

      return false;
    }

    for (const task of tasks) {
      if (hasCycle(task.id)) {
        context.addIssue({
          code: "custom",
          path: [],
          message:
            "Task dependencies must not contain circular relationships.",
        });

        break;
      }
    }
  });

/**
 * The complete generated plan accepted by the validation layer.
 *
 * A plan can be structurally valid yet exceed the user's budget.
 * Budget feasibility must be evaluated separately by the financial
 * engine so the application can show alternatives instead of losing
 * the plan.
 */
export const eventPlanSchema = z
  .object({
    summary: z.string().trim().min(10).max(4000),

    budget: budgetPlanDraftSchema,

    tasks: eventTasksSchema,

    recommendations: z
      .array(eventIdeaRecommendationSchema)
      .max(100),

    vendorSuggestions: z
      .array(vendorSuggestionSchema)
      .max(100),

    assumptions: z
      .array(
        z.string().trim().min(1).max(500),
      )
      .max(30),
  })
  .strict();

/** Type inferred from the complete plan schema. */
export type ValidatedEventPlan = z.infer<
  typeof eventPlanSchema
>;