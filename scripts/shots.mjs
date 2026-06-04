import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const shots = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'cockpit', path: '/bills/b-wex-0529' },
  { name: 'capture', path: '/capture' },
  { name: 'bills', path: '/bills' },
  { name: 'payment-failed', path: '/bills/b-sam-09980' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});
// Settle defaults to light; force the premium dark theme before any page script runs.
await ctx.addInitScript(() => {
  try { localStorage.setItem('settle-theme', 'dark'); } catch {}
});

const page = await ctx.newPage();
for (const s of shots) {
  await page.goto(BASE + s.path, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `docs/screenshots/${s.name}.png` });
  console.log('saved', s.name);
}
await browser.close();
