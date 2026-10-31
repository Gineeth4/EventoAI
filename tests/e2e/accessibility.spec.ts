import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

type AxeViolation = Awaited<
  ReturnType<AxeBuilder["analyze"]>
>["violations"][number];

function describeViolations(violations: AxeViolation[]): string {
  return violations
    .map((violation) => {
      const affectedNodes = violation.nodes
        .map(
          (node) =>
            `  - ${node.target.join(", ")}\n    ${
              node.failureSummary ?? "No failure summary available"
            }`,
        )
        .join("\n");

      return [
        `${violation.id} [${violation.impact ?? "unknown"}]`,
        violation.help,
        affectedNodes,
      ].join("\n");
    })
    .join("\n\n");
}

test.describe("Public page accessibility", () => {
  test("landing page has no WCAG A/AA violations", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    expect(describeViolations(results.violations)).toBe("");
  });

  test("login page has no WCAG A/AA violations", async ({ page }) => {
    const response = await page.goto("/login");

    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: "Welcome back." }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    expect(describeViolations(results.violations)).toBe("");
  });

  test("login email field has visible keyboard focus", async ({ page }) => {
    await page.goto("/login");

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const emailInput = page.getByRole("textbox", {
      name: "Email address",
    });

    await expect(emailInput).toBeFocused();

    const focusStyles = await emailInput.evaluate((element) => {
      const styles = window.getComputedStyle(element);

      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });

    const hasVisibleOutline =
      focusStyles.outlineStyle !== "none" &&
      focusStyles.outlineWidth !== "0px";

    const hasVisibleShadow = focusStyles.boxShadow !== "none";

    expect(hasVisibleOutline || hasVisibleShadow).toBe(true);
  });
});
