// A discriminated result for the few server actions whose error message must
// reach the user. Next.js masks *thrown* server-action errors in the production
// build (the one Playwright runs), so business errors — the approval gate, the
// not-editable guard — are returned as plain data instead of thrown.
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const err = (error: string): ActionResult<never> => ({ ok: false, error });

// An EXPECTED, user-facing business error (the approval gate, the not-editable
// guard, vendor-not-found). Its message is safe to show verbatim — runAction
// returns it as err(e.message). Anything else thrown is an unexpected bug/outage.
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

// One consistent boundary for every mutating server action: expected errors
// surface verbatim; unexpected ones (a DB outage, a bug) are logged server-side
// (never leaked to the client) and returned as a named, action-specific fallback
// — so a failure reads as "Couldn't save this bill" instead of a flat
// "something went wrong". Validate input with parseOrResult *before* the wrapper.
export async function runAction<T>(fallback: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ActionError) return err(e.message);
    console.error(`[action] ${fallback}:`, e);
    return err(fallback);
  }
}
