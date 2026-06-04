import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

// Reset so the Samsara bill (b-sam-09980) is back to its failed-payment state.
test.beforeAll(() => reseed());

test('an unknown bill renders the not-found error state inside the shell (and 404)', async ({ page }) => {
  const res = await page.goto('/bills/zzz-nope');
  expect(res?.status()).toBe(404);

  // The design's full-page state in the content area; the shell stays.
  await expect(page.locator('.estate-title')).toContainText(/couldn't find/i);
  await expect(page.getByRole('link', { name: /Back to bills/i })).toBeVisible();
  await expect(page.locator('.sidebar')).toBeVisible();
});

test('a failed payment surfaces the recovery card in the cockpit', async ({ page }) => {
  await page.goto('/bills/b-sam-09980');

  // The design's `.payfail`: names the cause, then the fix — never a dead end.
  await expect(page.locator('.payfail .pf-t')).toContainText(/Payment failed/i);
  await expect(page.locator('.payfail .pf-s')).toContainText(/didn.t clear/i);
  await expect(page.getByRole('button', { name: /Retry payment/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Change account/i })).toBeVisible();
});

test('the dashboard sync banner is non-blocking and dismissible', async ({ page }) => {
  await page.goto('/dashboard');

  const banner = page.locator('.banner.amber');
  await expect(banner).toContainText(/sync with QuickBooks/i);
  // The page renders behind it — the failure fails at the smallest scope.
  await expect(page.locator('.scards')).toBeVisible();

  await banner.getByRole('button', { name: /Dismiss/i }).click();
  await expect(banner).toHaveCount(0);
});
