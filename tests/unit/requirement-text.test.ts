import { describe, expect, it } from "vitest";

import { parseRequirementLines } from "@/lib/planning-intelligence/requirement-text";

describe("parseRequirementLines", () => {
  it("parses newline-separated requirements and trims whitespace", () => {
    expect(
      parseRequirementLines("  Vegetarian  \n\n  Step-free access \n"),
    ).toEqual(["Vegetarian", "Step-free access"]);
  });

  it("removes duplicate entries without changing their original order", () => {
    expect(
      parseRequirementLines("Vegan\nNut-free\nvegan\nNUT-FREE"),
    ).toEqual(["Vegan", "Nut-free"]);
  });

  it("accepts common list prefixes", () => {
    expect(
      parseRequirementLines("- Step-free access\n* Quiet room\n? Clear signage"),
    ).toEqual(["Step-free access", "Quiet room", "Clear signage"]);
  });

  it("preserves commas and meaningful punctuation inside an item", () => {
    expect(
      parseRequirementLines("No peanuts, tree nuts, or sesame\nMusic after 7:30 p.m."),
    ).toEqual([
      "No peanuts, tree nuts, or sesame",
      "Music after 7:30 p.m.",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseRequirementLines(" \n\n ")).toEqual([]);
  });
});
