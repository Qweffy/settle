// AP approval-rules engine — pure logic, no I/O. Routes large bills to higher
// roles. Shared by the approve actions (enforcement) and the cockpit (UI gate).

export type ApprovalRole = 'clerk' | 'approver' | 'controller';

export type ApprovalRule = {
  id: string;
  amountGtCents: number;
  requiredRole: ApprovalRole;
  label: string;
};

// Ordered highest-threshold-first so the first matching rule is the strictest.
export const APPROVAL_RULES: ApprovalRule[] = [
  {
    id: 'over-50k',
    amountGtCents: 5_000_000,
    requiredRole: 'controller',
    label: 'Bills over $50,000 require a Controller',
  },
  {
    id: 'over-10k',
    amountGtCents: 1_000_000,
    requiredRole: 'approver',
    label: 'Bills over $10,000 require an Approver',
  },
];

// rank of each role for "satisfies" comparisons (higher = more authority).
const ROLE_RANK: Record<ApprovalRole, number> = {
  clerk: 0,
  approver: 1,
  controller: 2,
};

const ROLE_DISPLAY: Record<ApprovalRole, string> = {
  clerk: 'AP Clerk',
  approver: 'Approver',
  controller: 'Controller',
};

// The strictest rule a bill's total trips, or null when no rule applies.
export function requiredApproval(totalCents: number): { requiredRole: ApprovalRole; label: string } | null {
  const rule = APPROVAL_RULES.find((r) => totalCents > r.amountGtCents);
  return rule ? { requiredRole: rule.requiredRole, label: rule.label } : null;
}

// True when the actor's role is at least as senior as the required role.
export function roleSatisfies(actorRole: string, requiredRole: ApprovalRole): boolean {
  const actorRank = actorRole in ROLE_RANK ? ROLE_RANK[actorRole as ApprovalRole] : -1;
  return actorRank >= ROLE_RANK[requiredRole];
}

// Human-readable label for a role string (defensive for unknown values).
export function roleLabel(role: string): string {
  return role in ROLE_DISPLAY ? ROLE_DISPLAY[role as ApprovalRole] : role;
}
