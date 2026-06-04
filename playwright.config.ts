import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  // Re-seed the DB to a known baseline before the run.
  globalSetup: './tests/e2e/global-setup.ts',
  // The suite mutates a shared DB, so run serially for determinism.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Production build, matching how users actually run the app. Locally, a dev
  // server already on :3000 is reused.
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
