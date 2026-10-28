/**
 * EventoAI — Model output schema
 *
 * The model generates planning content. It does not generate database
 * IDs, authoritative budget summaries, or task dependencies.
 *
 * The JSON Schema is intentionally simple for compatibility with
 * Gemini structured output; Zod enforces tighter limits afterwards.
 */

import { z } from "zod";

import { BUDGET_CATEGORIES } from "@/types/event-plan";
import {
  IDEA_CATEGORIES,
  VENDOR_CATEGORIES,
} from "@/types/recommendation";

const moneySchema = z
  .number()
  .min(0)
  .max(1_000_000_000)
  .finite();

const generatedBudgetItemSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    category: z.enum(BUDGET_CATEGORIES),
    description: z.string().trim().min(1).max(1000),
    estimatedAmount: moneySchema,
  })
  .strict();

const generatedIdeaSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    category: z.enum(IDEA_CATEGORIES),
    description: z.string().trim().min(1).max(2000),
    whyItFits: z.string().trim().min(1).max(1500),

    // Omit this property if a useful estimate cannot be provided.
    estimatedCost: moneySchema.optional(),

    tags: z
      .array(z.string().trim().min(1).max(60))
      .max(12),
  })
  .strict();

const generatedVendorSuggestionSchema = z
  .object({
    serviceCategory: z.enum(VENDOR_CATEGORIES),
    displayName: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
    whyItFits: z.string().trim().min(1).max(1500),

    // This is an estimate, not a verified quotation.
    estimatedCost: moneySchema.optional(),
  })
  .strict();

export const modelPlanResponseSchema = z
  .object({
    summary: z.string().trim().min(10).max(4000),

    budgetItems: z
      .array(generatedBudgetItemSchema)
      .min(3)
      .max(30),

    recommendations: z
      .array(generatedIdeaSchema)
      .min(3)
      .max(12),

    vendorSuggestions: z
      .array(generatedVendorSuggestionSchema)
      .min(2)
      .max(12),

    assumptions: z
      .array(z.string().trim().min(1).max(500))
      .min(1)
      .max(20),
  })
  .strict();

export type ModelPlanResponse = z.infer<
  typeof modelPlanResponseSchema
>;

/**
 * Current Interactions API structured-output format.
 *
 * Keep this schema in sync with modelPlanResponseSchema above.
 * Array length and string length constraints are enforced by Zod
 * after the response comes back.
 */
export const MODEL_PLAN_RESPONSE_JSON_SCHEMA = {
  type: "object",

  properties: {
    summary: {
      type: "string",
    },

    budgetItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: {
            type: "string",
            enum: [...BUDGET_CATEGORIES],
          },
          description: { type: "string" },
          estimatedAmount: {
            type: "number",
          },
        },
        required: [
          "name",
          "category",
          "description",
          "estimatedAmount",
        ],
      },
    },

    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: {
            type: "string",
            enum: [...IDEA_CATEGORIES],
          },
          description: { type: "string" },
          whyItFits: { type: "string" },
          estimatedCost: {
            type: "number",
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "title",
          "category",
          "description",
          "whyItFits",
          "tags",
        ],
      },
    },

    vendorSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          serviceCategory: {
            type: "string",
            enum: [...VENDOR_CATEGORIES],
          },
          displayName: { type: "string" },
          description: { type: "string" },
          whyItFits: { type: "string" },
          estimatedCost: {
            type: "number",
          },
        },
        required: [
          "serviceCategory",
          "displayName",
          "description",
          "whyItFits",
        ],
      },
    },

    assumptions: {
      type: "array",
      items: { type: "string" },
    },
  },

  required: [
    "summary",
    "budgetItems",
    "recommendations",
    "vendorSuggestions",
    "assumptions",
  ],
} as const;