'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { vendors, bills } from '@/db/schema';
import { parseInvoice, type OcrResult, type InvoiceInput } from '@/lib/ocr';
import { createBillFromCapture } from './bills';

// A representative waste-hauler invoice used for the demo's "process a sample" flow.
const SAMPLE_INVOICE = `REGIONAL LANDFILL AUTHORITY
1400 Transfer Station Rd, Tacoma, WA 98421
Invoice: INV-1046
Issue date: June 1, 2026    Terms: Net 30    Due: July 1, 2026
Bill to: Summit Waste Services

Description                          Qty       Rate       Amount
Tipping fees — MSW disposal          1,335 t   $62.57     $83,540.00
Fuel / energy surcharge              —         —          $1,448.00
Administrative fee                   —         —            $250.00
State environmental fee              —         —            $162.00
                                               Subtotal    $85,400.00
                                               Total       $85,400.00
Remit by ACH to account ••8830`;

function buildVendorHistory(
  rows: { invoiceNumber: string; issueDate: Date | null; totalCents: number; lineItems: { description: string; amountCents: number }[] }[],
): string {
  if (rows.length === 0) return '(no prior bills on file for this vendor)';
  return rows
    .map((b) => {
      const date = b.issueDate ? b.issueDate.toISOString().slice(0, 10) : 'n/a';
      const lines = b.lineItems.map((l) => `${l.description} $${(l.amountCents / 100).toFixed(2)}`).join('; ');
      return `- ${b.invoiceNumber} (${date}): total $${(b.totalCents / 100).toFixed(2)} — ${lines}`;
    })
    .join('\n');
}

// Server Action: OCR + AI Bill Review for a vendor's invoice.
// Loads the vendor's prior bills from the DB as the review context.
export async function runCapture(vendorId = 'v-landfill', input?: InvoiceInput): Promise<OcrResult> {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId));
  const history = await db.query.bills.findMany({
    where: eq(bills.vendorId, vendorId),
    with: { lineItems: true },
  });

  return parseInvoice(
    input ?? { text: SAMPLE_INVOICE },
    vendor?.name ?? 'Regional Landfill Authority',
    buildVendorHistory(history),
  );
}

// Demo: simulate an invoice landing in the AP forwarding inbox — run the same
// OCR + AI review as an upload, then draft a real bill from it. Returns the new
// bill id so the client can route to its cockpit.
export async function simulateInboundEmail(vendorId = 'v-landfill'): Promise<string> {
  const res = await runCapture(vendorId);
  return createBillFromCapture(res.extraction, res.flags, vendorId);
}
