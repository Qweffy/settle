import { test, expect } from '@playwright/test';
import { reseed } from './reseed';

// Reset so WEX STMT-0529 ($52,180, > $50k) is back to pending_approval.
test.beforeAll(() => reseed());

test('approval gate: a bill over $50k requires a Controller', async ({ page }) => {
  await page.goto('/bills/b-wex-0529');

  const approve = page.getByRole('button', { name: 'Approve' });

  // Default actor is the AP Clerk → blocked, with the gate chip.
  await expect(approve).toBeDisabled();
  await expect(page.locator('.gate-chip')).toContainText(/Requires Controller/i);

  // Switch to Controller via the topbar role switcher. The switch is a server
  // action that sets the actor cookie — wait for it to resolve before reloading
  // so the next request is evaluated as the Controller.
  await page.locator('.role').click();
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.status() === 200),
    page.locator('.menu-item').filter({ hasText: /Controller/ }).click(),
  ]);

  // The cookie change is re-evaluated server-side on the next load.
  await page.goto('/bills/b-wex-0529');
  await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled();
});
