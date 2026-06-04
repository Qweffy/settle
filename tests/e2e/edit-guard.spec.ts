import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

test.beforeAll(() => reseed());

test('a bill past approval cannot be edited (state guard + prod error message)', async ({ page }) => {
  await page.goto('/bills');

  // Open a paid bill from the Paid tab.
  await page.locator('.tab').filter({ hasText: /Paid/ }).click();
  await page.locator('tbody tr').first().click();
  await expect(page).toHaveURL(/\/bills\/b/);

  // Go to its edit form, change the invoice #, and try to save.
  await page.getByRole('link', { name: /Edit/ }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const invoice = page.locator('input[placeholder="INV-1234"]');
  await invoice.fill('SHOULD-NOT-SAVE');
  await page.getByRole('button', { name: /Save changes/i }).click();

  // The server guard returns the message as data, so it survives the prod build
  // and renders — instead of a generic "something went wrong".
  await expect(page.locator('.nb-error')).toContainText(/can't be edited/i, { timeout: 10_000 });
});
