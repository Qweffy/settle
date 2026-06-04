import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

test.beforeAll(() => reseed());

test('the AP inbox simulates an inbound invoice into a draft bill', async ({ page }) => {
  await page.goto('/capture');
  await expect(page.locator('.fw-mail')).toContainText('@summit.settle.app');

  // "Simulate inbound" → OCR + draft, then route to the new bill.
  await page.locator('.fw-copy').click();
  await expect(page).toHaveURL(/\/bills\/b-/, { timeout: 25_000 });
  await expect(page.getByText('Regional Landfill Authority').first()).toBeVisible();
});
