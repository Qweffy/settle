import { test, expect } from '@playwright/test';

test('an unknown bill renders the not-found error state inside the shell (and 404)', async ({ page }) => {
  const res = await page.goto('/bills/zzz-nope');
  expect(res?.status()).toBe(404);

  // The design's full-page state in the content area; the shell stays.
  await expect(page.locator('.estate-title')).toContainText(/couldn't find/i);
  await expect(page.getByRole('link', { name: /Back to bills/i })).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
});
