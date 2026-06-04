import { describe, it, expect, vi } from 'vitest';
import { runAction, ActionError, ok, err } from '@/lib/result';

describe('runAction', () => {
  it('returns ok with the value on success', async () => {
    const r = await runAction('fallback', async () => 42);
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it('surfaces an ActionError message verbatim (expected business error)', async () => {
    const r = await runAction('fallback', async () => {
      throw new ActionError('This bill needs Controller approval');
    });
    expect(r).toEqual({ ok: false, error: 'This bill needs Controller approval' });
  });

  it('logs the cause and returns the fallback for an unexpected throw (never leaks internals)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await runAction("Couldn't save this bill — please try again.", async () => {
      throw new Error('ECONNREFUSED 10.0.0.1:5432');
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("Couldn't save this bill — please try again.");
      expect(r.error).not.toContain('ECONNREFUSED');
    }
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('ok / err helpers', () => {
  it('build the discriminated union', () => {
    expect(ok('x')).toEqual({ ok: true, data: 'x' });
    expect(err('boom')).toEqual({ ok: false, error: 'boom' });
  });
});
