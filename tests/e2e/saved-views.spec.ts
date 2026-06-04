import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

// Saving/deleting views mutates the saved_views table, so reset first.
test.beforeAll(() => reseed());

test('saved views capture and restore the table filter state', async ({ page }) => {
  await page.goto('/bills');

  // Switch to the Scheduled tab, then save the current view.
  await page.locator('.tab').filter({ hasText: /Scheduled/ }).click();
  await page.locator('.ctrlbtn').filter({ hasText: /Saved views/ }).click();
  await page.locator('.view-save input').fill('My scheduled');
  await page.locator('.vs-btn').click();
  await expect(page.locator('.toast')).toContainText(/Saved view/i, { timeout: 15_000 });

  // Move to a different tab…
  await page.locator('.tab').filter({ hasText: /Drafts/ }).click();
  await expect(page.locator('.tab.on')).toContainText(/Drafts/);

  // …then re-apply the saved view to restore the Scheduled filter.
  await page.locator('.ctrlbtn').filter({ hasText: /Saved views/ }).click();
  await page.locator('.view-item').filter({ hasText: 'My scheduled' }).locator('.vi-main').click();
  await expect(page.locator('.tab.on')).toContainText(/Scheduled/);
  await expect(page.locator('tbody tr')).toHaveCount(3);

  // Delete the view.
  await page.locator('.ctrlbtn').filter({ hasText: /Saved views/ }).click();
  await page.locator('.view-item').filter({ hasText: 'My scheduled' }).locator('.vi-del').click();
  await expect(page.locator('.toast')).toContainText(/Deleted/i, { timeout: 15_000 });
  // The dropdown stays open and now shows the empty state.
  await expect(page.locator('.menu-empty')).toBeVisible({ timeout: 10_000 });
});
