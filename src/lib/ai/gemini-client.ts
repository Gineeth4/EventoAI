
/**
 * EventoAI — Server-only Gemini client.
 *
 * Uses the standard Generate Content API for a single-turn
 * structured-output request. No automatic retries.
 */

import "server-only";

import { GoogleGenAI } from "@google/genai";
import { EventoAIError } from "@/lib/ai/handle-ai-error";

let cachedClient: GoogleGenAI | undefined;

const GENERATE_CONTENT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_REQUEST_TIMEOUT_MS = 7_000;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new EventoAIError(
      "AI_KEY_MISSING",
      "Gemini is not configured. Add GEMINI_API_KEY to .env.local.",
      503,
      false,
    );
  }

  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 8_000,
        retryOptions: {
          attempts: 1,
        },
      },
    });
  }

  return cachedClient;
}

export class GeminiProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiProviderError";
  }
}

export type GeminiJsonRequest = {
  model: string;
  input: string;
  schema: Record<string, unknown>;
  thinkingLevel: "minimal" | "low" | "medium" | "high";
  maxOutputTokens: number;
  timeoutMs?: number;
};

type GenerateContentPayload = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export async function requestGeminiJson(
  request: GeminiJsonRequest,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new EventoAIError(
      "AI_KEY_MISSING",
      "Gemini is not configured. Add GEMINI_API_KEY to .env.local.",
      503,
      false,
    );
  }

  const timeoutMs = Math.max(
    1_000,
    Math.min(
      request.timeoutMs ?? MAX_REQUEST_TIMEOUT_MS,
      MAX_REQUEST_TIMEOUT_MS,
    ),
  );

  const controller = new AbortController();
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const endpoint =
      `${GENERATE_CONTENT_BASE_URL}/` +
      `${encodeURIComponent(request.model)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: request.input }],
          },
        ],
        generationConfig: {
          maxOutputTokens: request.maxOutputTokens,

          thinkingConfig: {
            thinkingLevel: request.thinkingLevel.toUpperCase(),
          },

          responseFormat: {
            text: {
              mimeType: "APPLICATION_JSON",
              schema: request.schema,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      // Do not expose provider response bodies or credentials in logs.
      throw new GeminiProviderError(
        response.status,
        `Gemini returned HTTP ${response.status}.`,
      );
    }

    let payload: GenerateContentPayload;

    try {
      payload = (await response.json()) as GenerateContentPayload;
    } catch {
      throw new GeminiProviderError(
        502,
        "Gemini returned an invalid API response.",
      );
    }

    const candidate = payload.candidates?.[0];

    if (!candidate) {
      throw new GeminiProviderError(
        502,
        "Gemini returned no usable candidate.",
      );
    }

    if (candidate.finishReason === "MAX_TOKENS") {
      throw new GeminiProviderError(
        502,
        "Gemini's output exceeded the configured token limit.",
      );
    }

    const outputText = (candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!outputText) {
      throw new GeminiProviderError(
        502,
        "Gemini returned no usable text output.",
      );
    }

    return outputText;
  } catch (error) {
    if (timedOut || controller.signal.aborted) {
      throw new GeminiProviderError(
        504,
        `Gemini exceeded the ${timeoutMs} millisecond deadline.`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}
