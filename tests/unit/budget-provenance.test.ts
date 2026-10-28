import { describe, expect, it } from "vitest";

import type { BudgetPlan } from "@/types/event-plan";

import {
  calculateBudgetSummary,
  getPlanningAmount,
} from "@/lib/budget-engine/calculate-budget";

import {
  getBudgetWarnings,
} from "@/lib/budget-engine/validate-budget";

describe("budget allocation provenance", () => {
  it("calculates a planning allocation as an active budget amount", () => {
    const item: BudgetPlan["items"][number] = {
      id: "food-1",
      name: "Food and beverages",
      category: "catering",
      estimatedAmount: 8_181.82,
      costStatus: "planning_allocation",
    };

    expect(getPlanningAmount(item)).toBe(8_181.82);
  });

  it("warns that planning allocations are not researched prices", () => {
    const budget: BudgetPlan = {
      currency: "INR",
      spendingLimit: 10_000,
      contingencyPercent: 10,
      items: [
        {
          id: "food-1",
          name: "Food and beverages",
          category: "catering",
          estimatedAmount: 5_000,
          costStatus: "planning_allocation",
        },
      ],
    };

    const summary = calculateBudgetSummary(budget);
    const warnings = getBudgetWarnings(budget, summary);

    const provenanceWarning = warnings.find(
      (warning) => warning.code === "unverified_estimates",
    );

    expect(provenanceWarning).toBeDefined();
    expect(provenanceWarning?.message).toContain(
      "not researched prices",
    );
    expect(provenanceWarning?.message).toContain(
      "not verified quotations",
    );
  });
});