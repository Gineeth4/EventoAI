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
  test.setTimeout(60_000);
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    test.skip(true, "Dedicated Supabase E2E credentials are not configured.");
    return;
  }

  await page.goto("/login?next=%2Fplan");

  const emailField = page.getByLabel("Email address");
  const passwordField = page.getByLabel("Password");
  const signInButton = page.getByRole("button", { name: "Sign in" });
  const authDiagnostics: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/token") {
      authDiagnostics.push("Supabase password-auth request started.");
    }
  });

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname === "/auth/v1/token") {
      authDiagnostics.push(`Supabase auth responded with HTTP ${response.status()}.`);
    }
  });

  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/auth/v1/token") {
      authDiagnostics.push(
        `Supabase auth network failure: ${request.failure()?.errorText ?? "unknown"}.`
      );
    }
  });

  await emailField.fill(email);
  await passwordField.fill(password);
  await signInButton.click();

  let authWaitError = "";

  try {
    await page.waitForFunction(
      () => window.location.pathname === "/plan" ||
        Boolean(document.querySelector('[role="alert"]')?.textContent?.trim()),
      null,
      { timeout: 15000 }
    );
  } catch (error) {
    authWaitError = error instanceof Error ? error.message : "Unknown wait error.";
  }

  if (new URL(page.url()).pathname !== "/plan") {
    const alertMessage = await page.getByRole("alert").first()
      .innerText().catch(() => "");
    const buttonState = await signInButton.evaluate(
      (button: HTMLButtonElement) =>
        `${button.innerText.trim()} (disabled=${button.disabled})`
    ).catch(() => "unavailable");

    // Do not wait for disabled inputs while authentication is pending.
    if (await passwordField.isEnabled()) await passwordField.fill("");
    if (await emailField.isEnabled()) await emailField.fill("");

    const networkSummary = authDiagnostics.length
      ? authDiagnostics.join(" ")
      : "No Supabase password-auth request was observed.";

    if (alertMessage) {
      throw new Error(
        `Supabase sign-in rejected: ${alertMessage} ${networkSummary}`
      );
    }

    throw new Error(
      `Sign-in did not reach /plan. ${networkSummary} ` +
      `Button state: ${buttonState}. ${authWaitError}`
    );
  }

  expect(new URL(page.url()).pathname).toBe("/plan");
  await expect(page.getByRole("heading", {
    name: "Let's shape something memorable."
  })).toBeVisible();


  // Audit the authenticated My Events workspace.
  await page.goto("/events");

  await expect(
    page.getByRole("heading", { name: "My Events" }),
  ).toBeVisible();

  await expect(
    page.getByRole("status").filter({
      hasText: /Loaded \d+ event\(s\) from your account\./,
    }),
  ).toBeVisible();

  await auditStep(page, "My Events");

  // Exercise saved-plan disclosure when the account has saved events.
  const savedPlanToggle = page.locator(".events-toggle-button").first();

  if (await savedPlanToggle.count() > 0) {
    const controlledId = await savedPlanToggle.getAttribute("aria-controls");
    expect(controlledId).toBeTruthy();

    await savedPlanToggle.click();
    await expect(savedPlanToggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`[id="${controlledId}"]`)).toBeVisible();

    await auditStep(page, "Expanded saved plan");
  }

  // Exercise version history when an event is available.
  const historyToggle = page.getByRole("button", {
    name: /Version history/,
  }).first();

  if (await historyToggle.count() > 0) {
    const historyId = await historyToggle.getAttribute("aria-controls");
    expect(historyId).toBeTruthy();

    await historyToggle.click();
    await expect(historyToggle).toHaveAttribute("aria-expanded", "true");

    await expect(
      page.locator(`[id="${historyId}"] .event-version-list`),
    ).toBeVisible();

    await auditStep(page, "Expanded version history");
  }

  // Exercise the edit form when an event exists.
  const editButton = page.getByRole("button", {
    name: "Edit and regenerate",
  }).first();

  if (await editButton.count() > 0) {
    await editButton.click();

    await expect(
      page.getByRole("heading", { name: "Edit event details" }),
    ).toBeVisible();

    await auditStep(page, "Saved event edit form");

    const eventTypeField = page.getByLabel("Event type").first();
    await eventTypeField.focus();

    const focusStyles = await eventTypeField.evaluate((element) => {
      const styles = window.getComputedStyle(element);
      return {
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
      };
    });

    expect(
      focusStyles.outlineStyle !== "none" &&
      focusStyles.outlineWidth !== "0px",
    ).toBe(true);

    await page.getByRole("button", { name: "Cancel editing" }).click();
  }

  // Return to the planner journey.
  await page.goto("/plan");

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

  // Verify the optional structured requirements are accessible.
  await page.getByLabel("Dietary requirements").fill(
    "Vegetarian\nNut-free",
  );
  await page.getByLabel("Accessibility needs").fill(
    "Step-free access\nAccessible restroom",
  );
  await page.getByLabel("Must-haves").fill("Quiet room");
  await page.getByLabel("Things to avoid").fill("Fireworks");
  await page.getByLabel("Cultural notes").fill(
    "Respect the hosts' stated traditions.",
  );
  await page.getByLabel("Other special requirements").fill(
    "Provide a quiet space for breaks.",
  );

  await expect(page.getByLabel("Dietary requirements"))
    .toHaveAccessibleDescription("One requirement per line; up to 30 items.");

  await expect(page.getByLabel("Accessibility needs"))
    .toHaveAccessibleDescription("Include access, seating, communication, or sensory needs.");

  await expect(page.getByLabel("Must-haves"))
    .toHaveAccessibleDescription("Features or outcomes that are essential to the event.");

  await expect(page.getByLabel("Things to avoid"))
    .toHaveAccessibleDescription("Constraints that should not be ignored in recommendations.");

  await expect(page.getByLabel("Cultural notes"))
    .toHaveAccessibleDescription("Provide the context you want the planner to preserve.");

  await expect(page.getByLabel("Other special requirements"))
    .toHaveAccessibleDescription("Additional details that do not fit the categories above.");
  // Keyboard navigation and visible focus indicator.
  const lastRequirementField = page.getByLabel("Other special requirements");
  await lastRequirementField.focus();
  await page.keyboard.press("Tab");

  const backButton = page.getByRole("button", { name: "Back" });
  await expect(backButton).toBeFocused();

  const focusIndicator = await backButton.evaluate((element) => {
    const styles = window.getComputedStyle(element);

    return {
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
    };
  });

  expect(
    (focusIndicator.outlineStyle !== "none" &&
      focusIndicator.outlineWidth !== "0px") ||
      focusIndicator.boxShadow !== "none",
    "The Back button should have a visible keyboard focus indicator.",
  ).toBe(true);
  await auditStep(page, "Review with structured requirements");

  await expect.poll(
    () => page.evaluate(() => {
      const raw = window.sessionStorage.getItem(
        "eventoai:conversation-draft:v1",
      );

      if (!raw) return null;

      try {
        const snapshot = JSON.parse(raw);
        return snapshot.draft?.dietaryRequirementsText ?? null;
      } catch {
        return null;
      }
    }),
  ).toBe("Vegetarian\nNut-free");

  // Reload and verify that the complete requirement set is restored.
  await page.reload();

  await expect(page.getByLabel("Dietary requirements"))
    .toHaveValue("Vegetarian\nNut-free");

  await expect(page.getByLabel("Accessibility needs"))
    .toHaveValue("Step-free access\nAccessible restroom");

  await expect(page.getByLabel("Must-haves"))
    .toHaveValue("Quiet room");

  await expect(page.getByLabel("Things to avoid"))
    .toHaveValue("Fireworks");

  await expect(page.getByLabel("Cultural notes"))
    .toHaveValue("Respect the hosts' stated traditions.");

  await expect(page.getByLabel("Other special requirements"))
    .toHaveValue("Provide a quiet space for breaks.");

  await auditStep(page, "Restored review with requirements");

  // 9. Verify browser sign-out and its same-origin POST protection.
  await page.getByRole("button", { name: "Sign out" }).click();

  await page.waitForURL((url) =>
    url.pathname === "/login" &&
    url.searchParams.get("message") === "signed-out"
  );

  await expect(page.getByLabel("Email address")).toBeVisible();
});
