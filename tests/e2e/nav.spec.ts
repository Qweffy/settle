import { test, expect } from '@playwright/test';

test('sidebar navigates between sections', async ({ page }) => {
  await page.goto('/dashboard');

  await page.locator('.nav a[href="/bills"]').click();
  await expect(page).toHaveURL(/\/bills$/);

  await page.locator('.nav a[href="/vendors"]').click();
  await expect(page).toHaveURL(/\/vendors$/);

  await page.locator('.nav a[href="/approvals"]').click();
  await expect(page).toHaveURL(/\/approvals$/);
});

test('an unknown bill id returns 404', async ({ page }) => {
  const res = await page.goto('/bills/zzz-nope');
  expect(res?.status()).toBe(404);
});
