/**
 * EventoAI — Small, structured AI enhancement.
 *
 * Business-critical fields remain controlled by deterministic code.
 */

import { z } from "zod";

export const AI_ENHANCEMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
          },
          description: {
            type: "string",
          },
          whyItFits: {
            type: "string",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
        required: [
          "title",
          "description",
          "whyItFits",
          "tags",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "recommendations"],
  additionalProperties: false,
} as const;

export const aiEnhancementSchema = z.object({
  summary: z.string().trim().min(20).max(500),

  recommendations: z
    .array(
      z
        .object({
          title: z.string().trim().min(3).max(80),
          description: z.string().trim().min(10).max(250),
          whyItFits: z.string().trim().min(10).max(250),
          tags: z
            .array(z.string().trim().min(1).max(30))
            .min(1)
            .max(4),
        })
        .strict(),
    )
    .min(2)
    .max(3),
}).strict();

export type AIEnhancement = z.infer<
  typeof aiEnhancementSchema
>;