import { describe, it, expect } from 'vitest';
import { requiredApproval, roleSatisfies, roleLabel } from '@/lib/approval-rules';

describe('requiredApproval (amount → required role)', () => {
  it('no rule below $10,000 (boundary is strictly greater-than)', () => {
    expect(requiredApproval(999_900)).toBeNull(); // $9,999
    expect(requiredApproval(1_000_000)).toBeNull(); // exactly $10,000
  });

  it('over $10k requires an Approver', () => {
    expect(requiredApproval(1_000_001)?.requiredRole).toBe('approver');
    expect(requiredApproval(5_000_000)?.requiredRole).toBe('approver'); // exactly $50,000 still approver
  });

  it('over $50k requires a Controller', () => {
    expect(requiredApproval(5_000_001)?.requiredRole).toBe('controller');
    expect(requiredApproval(8_640_000)?.requiredRole).toBe('controller'); // $86,400
  });

  it('carries a human label', () => {
    expect(requiredApproval(6_000_000)?.label).toMatch(/Controller/);
  });
});

describe('roleSatisfies (seniority rank)', () => {
  it('controller satisfies all gates', () => {
    expect(roleSatisfies('controller', 'controller')).toBe(true);
    expect(roleSatisfies('controller', 'approver')).toBe(true);
  });

  it('approver satisfies approver but not controller', () => {
    expect(roleSatisfies('approver', 'approver')).toBe(true);
    expect(roleSatisfies('approver', 'controller')).toBe(false);
  });

  it('clerk satisfies nothing', () => {
    expect(roleSatisfies('clerk', 'approver')).toBe(false);
    expect(roleSatisfies('clerk', 'controller')).toBe(false);
  });

  it('unknown role is treated as least-privileged', () => {
    expect(roleSatisfies('nobody', 'approver')).toBe(false);
  });
});

describe('roleLabel', () => {
  it('maps known roles, passes through unknown', () => {
    expect(roleLabel('clerk')).toBe('AP Clerk');
    expect(roleLabel('approver')).toBe('Approver');
    expect(roleLabel('controller')).toBe('Controller');
    expect(roleLabel('mystery')).toBe('mystery');
  });
});
