import { test, expect } from '@playwright/test';

test('vendor directory lists vendors and opens a dynamic detail', async ({ page }) => {
  await page.goto('/vendors');

  await expect(page.getByRole('heading', { name: 'Vendors' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(12); // 12 seeded vendors

  await page.locator('tbody tr').filter({ hasText: /Penske/ }).click();
  await expect(page).toHaveURL(/\/vendors\/v-/);
  await expect(page.getByText('Penske Truck Leasing').first()).toBeVisible();
});
