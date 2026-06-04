// The org's dedicated AP forwarding address: vendors email invoices here and
// Settle drafts a bill from each. Derived from the org name so it's stable per
// org without an extra column (e.g. "Summit Waste Services" → bills@summit.settle.app).
export function apForwardingAddress(orgName: string): string {
  const slug = orgName.toLowerCase().split(/\s+/)[0]?.replace(/[^a-z0-9]/g, '') || 'bills';
  return `bills@${slug}.settle.app`;
}
