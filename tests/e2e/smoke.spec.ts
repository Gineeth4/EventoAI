import { expect, test } from "@playwright/test";

test("landing page renders successfully", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/EventoAI/i);
  await expect(page.locator("body")).toBeVisible();
});

test("login page renders a form", async ({ page }) => {
  const response = await page.goto("/login");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/EventoAI/i);
  await expect(page.locator("form").first()).toBeVisible();
});

test("security headers are present on the home page", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();

  expect(response.status()).toBe(200);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["content-security-policy-report-only"]).toContain(
    "default-src 'self'",
  );
  expect(headers["content-security-policy"]).toBeUndefined();
  expect(headers["strict-transport-security"]).toContain("max-age=31536000");
});

test("AI planning endpoint rejects GET requests", async ({ request }) => {
  const response = await request.get("/api/ai/plan");

  expect(response.status()).toBe(405);
});

test("unauthenticated visitors are redirected away from My Events", async ({
  page,
}) => {
  await page.goto("/events");

  await expect(page).toHaveURL(/\/login\?next=/);
});