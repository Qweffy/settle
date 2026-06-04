import { test, expect } from '@playwright/test';

test('a line marked as an item shows the Item chip in the cockpit', async ({ page }) => {
  await page.goto('/bills/new');

  const vendor = page.locator('.nb-selwrap select').first();
  const firstVendor = await vendor.locator('option:not([value=""])').first().getAttribute('value');
  await vendor.selectOption(firstVendor!);

  await page.locator('input[placeholder="INV-1234"]').fill('INV-KIND-1');

  const firstRow = page.locator('.nb-lines tbody tr').first();
  await firstRow.locator('input').first().fill('A physical asset');
  await firstRow.locator('input.money').fill('500');

  // Toggle the line from expense to item.
  const kind = firstRow.locator('.nb-kind');
  await expect(kind).toHaveText('Expense');
  await kind.click();
  await expect(kind).toHaveText('Item');

  await page.getByRole('button', { name: /create & submit for approval/i }).click();
  await expect(page).toHaveURL(/\/bills\/b-/, { timeout: 20_000 });

  // The cockpit line table shows the Item chip.
  await expect(page.locator('.li-kind')).toContainText('Item');
});
