import { execSync } from 'node:child_process';

/**
 * Reset the DB to the known demo baseline. Used by globalSetup (once, before the
 * whole run) and by the mutating specs (so retries start from a clean state).
 */
export function reseed(): void {
  execSync('npx tsx db/seed.ts', { stdio: 'inherit' });
}
