/**
 * EventoAI — Vitest configuration
 *
 * These tests exercise ordinary TypeScript business logic.
 * A browser or React testing environment is not needed yet.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Resolve the same @/ imports used by the Next.js application.
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },

  test: {
    environment: "node",

    // Keep this phase focused on deterministic unit tests.
    include: ["tests/unit/**/*.test.ts"],

    clearMocks: true,
    restoreMocks: true,

    // Prevent a hung test from blocking the entire test run.
    testTimeout: 10_000,
  },
});