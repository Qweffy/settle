import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

// Importing creates new bills, so start from a known baseline.
test.beforeAll(() => reseed());

test('CSV import previews rows and creates draft bills', async ({ page }) => {
  await page.goto('/bills');

  // Two valid rows (seeded vendors) + one bad row (unknown vendor) to exercise
  // the preview validation.
  const csv = [
    'vendor,invoice_number,amount,due_date,gl_account,description',
    'WEX Fleet Fuel,IMP-0001,1500.00,2026-07-05,Fuel,Test fuel',
    'Penske Truck Leasing,IMP-0002,2400.00,2026-07-10,Equipment,Test lease',
    'Unknown Vendor LLC,IMP-0003,999.00,2026-07-12,Office,Should skip',
  ].join('\n');

  await page.locator('input[type="file"]').setInputFiles({
    name: 'bills.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });

  // The preview shows all 3 rows; the unknown vendor is flagged as invalid.
  const modal = page.locator('.import-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('tbody tr')).toHaveCount(3);
  await expect(modal.locator('tr.im-bad')).toHaveCount(1);
  await expect(modal.locator('.im-reason')).toContainText(/unknown vendor/i);

  // Import only the 2 valid rows.
  await modal.getByRole('button', { name: /Import 2 bills/i }).click();
  await expect(page.locator('.toast')).toContainText(/Imported 2 bills as draft/i, { timeout: 15_000 });

  // They land in the Drafts tab.
  await page.locator('.tab').filter({ hasText: /Drafts/ }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'IMP-0001' })).toHaveCount(1);
  await expect(page.locator('tbody tr').filter({ hasText: 'IMP-0002' })).toHaveCount(1);
});

test('the import template downloads', async ({ page }) => {
  await page.goto('/bills');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.btn').filter({ hasText: /Template/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('bills-import-template.csv');
});
