import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const publicRoutes = [
  { path: "/", heading: /Skills are already on campus/i },
  { path: "/help", heading: /Get to the right next step/i },
  { path: "/trust", heading: /Clear safeguards, honest limits/i },
  { path: "/terms", heading: /Beta terms of use/i },
  { path: "/privacy", heading: /Privacy notice/i },
  { path: "/login", heading: /Welcome back/i },
  { path: "/signup", heading: /Create your CampusGig account/i },
] as const;

async function expectHealthyPage(page: Page, path: string, heading: RegExp) {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto(path, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
}

test.describe("public CampusGig experience", () => {
  for (const route of publicRoutes) {
    test(`${route.path} renders and meets automated WCAG checks`, async ({ page }) => {
      await expectHealthyPage(page, route.path, route.heading);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("unknown routes offer useful recovery", async ({ page }) => {
    await expectHealthyPage(page, "/route-that-does-not-exist", /Page not found/i);
    await expect(page.getByRole("link", { name: "Browse gigs" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Help centre" }).first()).toBeVisible();
  });

  test("security headers are served in production", async ({ request }) => {
    const response = await request.get("/");
    expect(response.ok()).toBeTruthy();

    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("public health check is live, correlated, and does not expose configuration", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-request-id"]).toBeTruthy();

    const payload = await response.json();
    expect(payload.status).toBe("ok");
    expect(payload.service).toBe("campusgig-web");
    expect(payload).not.toHaveProperty("checks");
    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toContain("credential");
    expect(serialized).not.toContain("firebase_admin");
    expect(serialized).not.toContain("wallet_encryption");
  });

  test("primary navigation reaches the marketplace entry points", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    if (await page.getByRole("button", { name: "Open navigation" }).isVisible()) {
      await page.getByRole("button", { name: "Open navigation" }).click();
    }

    await expect(page.getByRole("link", { name: "Browse gigs" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  });

  test("keyboard users can bypass navigation and enter the login form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email address")).toBeFocused();
    await page.keyboard.type("keyboard.user@example.com");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Forgot password?" })).toBeFocused();
  });
});
