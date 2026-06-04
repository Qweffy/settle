import { test, expect } from '@playwright/test';

test('duplicate detection warns on a repeated vendor + invoice #', async ({ page }) => {
  await page.goto('/bills/new');

  await page.locator('.nb-selwrap select').first().selectOption({ label: 'WEX Fleet Fuel' });

  const invoice = page.locator('input[placeholder="INV-1234"]');
  await invoice.fill('STMT-0529'); // an invoice WEX already has on file
  await invoice.blur();

  await expect(page.locator('.nb-dupe')).toContainText(/already exists/i, { timeout: 10_000 });
});
