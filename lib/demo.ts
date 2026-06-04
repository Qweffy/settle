// A fixed "today" so derived states (overdue, due-soon, aging, time-ago) stay
// stable regardless of when the demo runs. Matches the seed's reference date.
export const DEMO_NOW = new Date('2026-06-03T16:00:00.000Z');

// Single-tenant demo org. The topbar entity switcher is cosmetic for now.
export const DEMO_ORG = 'org-sws';
