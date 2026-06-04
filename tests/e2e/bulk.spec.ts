import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

// Reset so the 3 seeded "scheduled" bills are available to mark paid.
test.beforeAll(() => reseed());

test('bulk mark-paid moves scheduled bills to paid', async ({ page }) => {
  await page.goto('/bills');

  // Go to the Scheduled tab (3 seeded).
  await page.locator('.tab').filter({ hasText: /Scheduled/ }).click();
  await expect(page.locator('tbody tr')).toHaveCount(3);

  // Select all + bulk mark paid.
  await page.locator('thead .cbox').click();
  await expect(page.locator('.bulkbar')).toBeVisible();
  await page.locator('.bulkbar .bb-act').filter({ hasText: /Mark paid/i }).click();

  await expect(page.locator('.toast')).toContainText(/Paid/i, { timeout: 10_000 });
  // After the refresh the Scheduled tab is empty.
  await expect(page.locator('tbody tr')).toHaveCount(0, { timeout: 10_000 });
});
