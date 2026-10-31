import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ trace: "off" });

async function auditStep(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const violations = results.violations.map((v) =>
    `${v.id} [${v.impact}]: ${v.help}\n` +
    v.nodes.map((n) => n.target.join(", ")).join("\n")
  ).join("\n\n");

  expect(violations, `Accessibility violations at ${name}`).toBe("");
}

test("authenticated planner journey is accessible at every stage", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, "Dedicated Supabase E2E credentials are not configured.");
    return;
  }

  await page.goto("/login?next=%2Fplan");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  let authenticationError = "";

  try {
    await page.waitForFunction(
      () => window.location.pathname === "/plan" ||
        Boolean(document.querySelector('[role="alert"]')?.textContent?.trim()),
      null,
      { timeout: 15000 }
    );

    if (new URL(page.url()).pathname !== "/plan") {
      authenticationError = (await page.getByRole("alert").first().innerText()).trim();
    }
  } finally {
    if (new URL(page.url()).pathname !== "/plan") {
      await page.getByLabel("Password").fill("");
      await page.getByLabel("Email address").fill("");
    }
  }

  if (authenticationError) {
    throw new Error(`Supabase sign-in rejected: ${authenticationError}`);
  }

  expect(new URL(page.url()).pathname).toBe("/plan");
  await expect(page.getByRole("heading", {
    name: "Let's shape something memorable."
  })).toBeVisible();

  // 1. Idea
  await auditStep(page, "Idea");
  await page.getByRole("textbox", { name: "Describe your event" })
    .fill("A get-together for friends and family.");
  await page.getByRole("button", { name: /Explore my idea/ }).click();

  // 2. Occasion
  const birthday = page.locator(".conversation-choice-grid")
    .getByText("Birthday", { exact: true });
  await expect(birthday).toBeVisible();
  await auditStep(page, "Occasion");
  await birthday.click();

  // 3. Date
  await expect(page.getByLabel("Event date")).toBeVisible();
  await auditStep(page, "Date");

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const dateValue = [
    futureDate.getFullYear(),
    String(futureDate.getMonth() + 1).padStart(2, "0"),
    String(futureDate.getDate()).padStart(2, "0")
  ].join("-");

  await page.getByLabel("Event date").fill(dateValue);
  await page.getByRole("button", { name: /Continue/ }).click();

  // 4. Guests
  await expect(page.getByLabel("Expected guests")).toBeVisible();
  await auditStep(page, "Guests");
  await page.getByLabel("Expected guests").fill("50");
  await page.getByRole("button", { name: /Continue/ }).click();

  // 5. Location
  await expect(page.getByLabel("City")).toBeVisible();
  await auditStep(page, "Location");
  await page.getByLabel("City").fill("Chennai");
  await page.getByLabel("Country").fill("India");
  await page.locator(".conversation-choice-grid--two")
    .getByText("Outdoor", { exact: true }).click();
  await page.getByRole("button", { name: /Continue/ }).click();

  // 6. Budget
  await expect(page.getByLabel("Currency")).toBeVisible();
  await auditStep(page, "Budget");
  await page.getByLabel("Currency").selectOption("INR");
  await page.getByLabel("Total spending limit").fill("50000");
  await page.getByRole("button", { name: /Continue/ }).click();

  // 7. Style
  await expect(page.getByText("Choose themes", { exact: true })).toBeVisible();
  await auditStep(page, "Style");

  const styleGroups = page.locator(".conversation-style-form .conversation-choice-block");
  await styleGroups.nth(0).getByText("Botanical", { exact: true }).click();
  await styleGroups.nth(1).getByText("Relaxed", { exact: true }).click();
  await page.getByRole("button", { name: /Review my brief/ }).click();

  // 8. Review
  await expect(page.getByText("Suggested event title")).toBeVisible();
  await auditStep(page, "Review");
});
