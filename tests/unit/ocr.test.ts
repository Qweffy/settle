import { describe, it, expect, beforeEach } from 'vitest';
import { parseInvoice } from '@/lib/ocr';

// With no ANTHROPIC_API_KEY, parseInvoice must fall back to the deterministic
// mock so the hosted demo (and CI) never depend on a paid API call.
describe('parseInvoice — mock fallback (no API key)', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns the deterministic extraction + 4 flags, usedAI=false', async () => {
    const result = await parseInvoice({ text: 'irrelevant' }, 'Regional Landfill Authority', '(no prior bills)');

    expect(result.usedAI).toBe(false);
    expect(result.extraction.invoiceNumber).toBe('INV-1046');
    expect(result.extraction.total).toBe(85400);
    expect(result.extraction.lineItems).toHaveLength(4);

    expect(result.flags).toHaveLength(4);
    expect(result.flags.some((f) => f.type === 'possible_duplicate')).toBe(true);
    expect(result.flags.some((f) => f.type === 'vendor_bank_change')).toBe(true);
    // the duplicate + bank-change flags are the high-severity ones
    expect(result.flags.filter((f) => f.severity === 'high')).toHaveLength(2);
  });
});
