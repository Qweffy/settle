import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const shots = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'capture', path: '/capture' },
  { name: 'cockpit', path: '/bills/b-wex-0529' },
  {
    name: 'bills',
    path: '/bills',
    // open a filter dropdown to show the table filters in action
    action: async (page) => {
      await page.locator('.chip').filter({ hasText: 'Status' }).first().click().catch(() => {});
      await page.waitForTimeout(450);
    },
  },
  { name: 'approvals', path: '/approvals' },
  { name: 'payments', path: '/payments' },
  { name: 'aging', path: '/reports' },
  { name: 'payment-failed', path: '/bills/b-sam-09980' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
// Settle defaults to light; set the stored pref so next-themes resolves to the
// premium dark theme on hydration (don't pre-set the attribute — racing
// next-themes leaves some routes light).
await ctx.addInitScript(() => {
  try { localStorage.setItem('settle-theme', 'dark'); } catch {}
});

// Fresh page per shot — avoids any state carrying across the navigation sequence
// (which left some routes rendering in light mode).
for (const s of shots) {
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: 'load', timeout: 60_000 });
  // Flat settle wait — long enough for next-themes to resolve dark from
  // localStorage on every route (a shorter/polled wait left some routes light).
  await page.waitForTimeout(3500);
  if (s.action) await s.action(page);
  await page.screenshot({ path: `docs/screenshots/${s.name}.png` });
  await page.close();
  console.log('saved', s.name);
}
await browser.close();
