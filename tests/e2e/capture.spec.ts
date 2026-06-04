import { test, expect } from '@playwright/test';

test('OCR capture → save persists a real bill', async ({ page }) => {
  await page.goto('/capture');

  const save = page.getByRole('button', { name: /save as draft for approval/i });
  // Save is disabled until the invoice is processed.
  await expect(save).toBeDisabled();

  await page.locator('.dz-btn').click();
  // The deterministic mock finishes and enables Save.
  await expect(save).toBeEnabled({ timeout: 20_000 });

  // The AI review surfaced its 4 flags.
  await expect(page.locator('.dai-head')).toContainText('4 open');

  await save.click();
  await expect(page).toHaveURL(/\/bills\/b-/, { timeout: 20_000 });
  await expect(page.getByText('Regional Landfill Authority').first()).toBeVisible();
  await expect(page.getByText('In approval').first()).toBeVisible();
});
