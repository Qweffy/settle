import { describe, it, expect } from 'vitest';
import {
  idSchema,
  createBillSchema,
  schedulePaymentSchema,
  bulkAdvanceSchema,
  firstIssueMessage,
  parseOrResult,
  parseOrThrow,
} from '@/lib/validation';

describe('idSchema', () => {
  it('rejects empty, whitespace-only, and over-length ids', () => {
    expect(idSchema.safeParse('').success).toBe(false);
    expect(idSchema.safeParse('   ').success).toBe(false);
    expect(idSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
  it('accepts the app + seed id shapes', () => {
    expect(idSchema.safeParse('b-wex-0529').success).toBe(true);
    expect(idSchema.safeParse('b-1c2d3e4f').success).toBe(true);
  });
});

describe('createBillSchema', () => {
  const valid = {
    vendorId: 'v-1',
    invoiceNumber: 'INV-1',
    issueDate: null,
    dueDate: null,
    memo: null,
    taxCents: 0,
    lineItems: [{ description: 'Fuel', quantity: null, unitPriceCents: null, amountCents: 100, glLabel: 'Fuel' }],
  };
  it('accepts a valid payload', () => {
    expect(createBillSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects empty line items', () => {
    expect(createBillSchema.safeParse({ ...valid, lineItems: [] }).success).toBe(false);
  });
  it('rejects a blank invoice number', () => {
    expect(createBillSchema.safeParse({ ...valid, invoiceNumber: '   ' }).success).toBe(false);
  });
  it('rejects negative tax', () => {
    expect(createBillSchema.safeParse({ ...valid, taxCents: -1 }).success).toBe(false);
  });
});

describe('schedulePaymentSchema', () => {
  it('rejects an unknown payment method', () => {
    expect(schedulePaymentSchema.safeParse({ billId: 'b-1', method: 'paypal', payDate: '2026-07-01' }).success).toBe(false);
  });
  it('rejects an unparseable pay date', () => {
    expect(schedulePaymentSchema.safeParse({ billId: 'b-1', method: 'ach', payDate: 'soon' }).success).toBe(false);
  });
  it('accepts a UI-format date string', () => {
    expect(schedulePaymentSchema.safeParse({ billId: 'b-1', method: 'ach', payDate: 'Jun 12, 2026' }).success).toBe(true);
  });
});

describe('bulkAdvanceSchema', () => {
  it('rejects an unknown action', () => {
    expect(bulkAdvanceSchema.safeParse({ ids: ['b-1'], action: 'delete' }).success).toBe(false);
  });
  it('rejects an empty id list', () => {
    expect(bulkAdvanceSchema.safeParse({ ids: [], action: 'pay' }).success).toBe(false);
  });
  it('accepts the four valid actions', () => {
    for (const action of ['submit', 'approve', 'schedule', 'pay']) {
      expect(bulkAdvanceSchema.safeParse({ ids: ['b-1'], action }).success).toBe(true);
    }
  });
});

describe('helpers', () => {
  it('firstIssueMessage surfaces a readable per-field message', () => {
    const r = createBillSchema.safeParse({ ...{ vendorId: 'v', invoiceNumber: '', issueDate: null, dueDate: null, memo: null, taxCents: 0, lineItems: [] } });
    expect(r.success).toBe(false);
    if (!r.success) expect(firstIssueMessage(r.error)).toMatch(/invoice number|line item/i);
  });
  it('parseOrResult returns ok/err shapes', () => {
    expect(parseOrResult(idSchema, 'b-1')).toEqual({ ok: true, data: 'b-1' });
    expect(parseOrResult(idSchema, '').ok).toBe(false);
  });
  it('parseOrThrow throws on invalid and returns on valid', () => {
    expect(() => parseOrThrow(idSchema, '')).toThrow();
    expect(parseOrThrow(idSchema, 'b-1')).toBe('b-1');
  });
});
