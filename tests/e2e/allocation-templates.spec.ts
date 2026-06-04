import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

test.beforeAll(() => reseed());

test('allocation templates apply to a line and save a new one', async ({ page }) => {
  await page.goto('/bills/new');

  const vendor = page.locator('.nb-selwrap select').first();
  await vendor.selectOption({ label: 'WEX Fleet Fuel' });
  await page.locator('input[placeholder="INV-1234"]').fill('INV-ALLOC-1');

  const firstRow = page.locator('.nb-lines tbody tr').first();
  await firstRow.locator('input').first().fill('Diesel + fees');
  await firstRow.locator('input.money').fill('1000');

  // Open the split editor + apply the org-wide 50/50 template → two $500 splits.
  await firstRow.locator('.nb-split').click();
  await page.locator('.nb-tmpl-select').selectOption({ label: 'Fuel + maintenance (50 / 50) · org' });
  await expect(page.locator('.nb-splitrow')).toHaveCount(2);
  await expect(page.locator('.nb-splithint.ok')).toBeVisible();

  // Save the current split as a new template; it shows up in the picker.
  page.once('dialog', (d) => d.accept('Saved by e2e'));
  await page.locator('.nb-tmpl-save').click();
  await expect(page.locator('.nb-tmpl-select')).toContainText('Saved by e2e', { timeout: 10_000 });
});
