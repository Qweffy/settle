import { describe, it, expect } from 'vitest';
import { fmt, fmtK } from '@/lib/format';

describe('fmt (USD, 2 decimals, integer cents are passed as dollars)', () => {
  it('formats with thousands separators', () => {
    expect(fmt(85400)).toBe('$85,400.00');
    expect(fmt(1234.5)).toBe('$1,234.50');
    expect(fmt(0)).toBe('$0.00');
  });
});

describe('fmtK (abbreviated)', () => {
  it('drops the decimal on round thousands', () => {
    expect(fmtK(50000)).toBe('$50k');
  });
  it('keeps one decimal otherwise', () => {
    expect(fmtK(52180)).toBe('$52.2k');
  });
  it('passes sub-1000 through', () => {
    expect(fmtK(999)).toBe('$999');
  });
});
