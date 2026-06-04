import { test, expect } from '@playwright/test';

test('manual New bill form creates a bill in the approval queue', async ({ page }) => {
  await page.goto('/bills/new');

  // Pick the first real vendor.
  const vendor = page.locator('.nb-selwrap select').first();
  const firstVendor = await vendor.locator('option:not([value=""])').first().getAttribute('value');
  await vendor.selectOption(firstVendor!);

  await page.locator('input[placeholder="INV-1234"]').fill('INV-E2E-1');

  const firstRow = page.locator('.nb-lines tbody tr').first();
  await firstRow.locator('input').first().fill('E2E test line');
  await firstRow.locator('input.money').fill('1234');

  await page.getByRole('button', { name: /create & submit for approval/i }).click();

  await expect(page).toHaveURL(/\/bills\/b-/, { timeout: 20_000 });
  await expect(page.getByText('INV-E2E-1').first()).toBeVisible();
  await expect(page.getByText('In approval').first()).toBeVisible();
});
