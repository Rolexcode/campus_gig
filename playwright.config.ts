import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const usesFirebaseEmulators =
  process.env.E2E_USE_FIREBASE_EMULATORS === "true";

const appServer = {
  command: `npm run start -- -p ${port}`,
  url: baseURL,
  reuseExistingServer: !process.env.CI && !usesFirebaseEmulators,
  timeout: 120_000,
};

const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : usesFirebaseEmulators
    ? [
        {
          command: "npm run firebase:emulators",
          port: 9099,
          reuseExistingServer: false,
          timeout: 180_000,
        },
        appServer,
      ]
    : appServer;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: usesFirebaseEmulators
    ? []
    : ["**/authenticated-marketplace.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer,
});
