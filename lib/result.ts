// A discriminated result for the few server actions whose error message must
// reach the user. Next.js masks *thrown* server-action errors in the production
// build (the one Playwright runs), so business errors — the approval gate, the
// not-editable guard — are returned as plain data instead of thrown.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const err = (error: string): ActionResult<never> => ({ ok: false, error });
