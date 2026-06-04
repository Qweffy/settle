// Invoice OCR + AI Bill Review with Claude.
// Extracts structured invoice data AND reviews it against the vendor's prior
// bills to surface anomaly flags. Falls back to a deterministic mock when no
// ANTHROPIC_API_KEY is set, so the demo always works.
import Anthropic from '@anthropic-ai/sdk';

// Current model id (per the claude-api guidance).
const MODEL = 'claude-opus-4-8';

export type OcrLine = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  glGuess: string;
};

export type OcrExtraction = {
  vendorGuess: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  lineItems: OcrLine[];
  subtotal: number;
  tax: number;
  total: number;
};

export type OcrFlag = {
  type: 'anomalous_surcharge' | 'new_fee' | 'amount_deviation' | 'possible_duplicate' | 'vendor_bank_change' | 'missing_po' | 'other';
  severity: 'high' | 'med' | 'low';
  title: string;
  message: string;
  lineRef?: string;
};

export type OcrResult = { extraction: OcrExtraction; flags: OcrFlag[]; usedAI: boolean };

export type InvoiceInput = { text?: string; imageBase64?: string; mediaType?: string };

// Structured-output schema, enforced via a forced tool call.
const RECORD_TOOL: Anthropic.Tool = {
  name: 'record_invoice',
  description: 'Record the extracted invoice fields and any anomaly flags found when reviewing it against the vendor history.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['extraction', 'flags'],
    properties: {
      extraction: {
        type: 'object',
        additionalProperties: false,
        required: ['vendorGuess', 'invoiceNumber', 'issueDate', 'dueDate', 'currency', 'lineItems', 'subtotal', 'tax', 'total'],
        properties: {
          vendorGuess: { type: 'string' },
          invoiceNumber: { type: 'string' },
          issueDate: { type: 'string', description: 'ISO date or as printed' },
          dueDate: { type: 'string' },
          currency: { type: 'string' },
          subtotal: { type: 'number', description: 'dollars' },
          tax: { type: 'number' },
          total: { type: 'number' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['description', 'quantity', 'unitPrice', 'amount', 'glGuess'],
              properties: {
                description: { type: 'string' },
                quantity: { type: ['number', 'null'] },
                unitPrice: { type: ['number', 'null'] },
                amount: { type: 'number' },
                glGuess: { type: 'string', description: 'best-guess GL category' },
              },
            },
          },
        },
      },
      flags: {
        type: 'array',
        description: 'Anomalies found by comparing this invoice to the vendor history. Empty if nothing is off.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'severity', 'title', 'message'],
          properties: {
            type: { type: 'string', enum: ['anomalous_surcharge', 'new_fee', 'amount_deviation', 'possible_duplicate', 'vendor_bank_change', 'missing_po', 'other'] },
            severity: { type: 'string', enum: ['high', 'med', 'low'] },
            title: { type: 'string', description: 'short headline, e.g. "Fuel surcharge 32% above 6-mo average"' },
            message: { type: 'string', description: 'one or two sentences explaining the anomaly' },
            lineRef: { type: 'string', description: 'which line it refers to, if any' },
          },
        },
      },
    },
  },
};

const SYSTEM = `You are an accounts-payable analyst for a waste-hauling company. You read a vendor invoice and (1) extract its fields precisely and (2) review it against the vendor's prior bills, flagging anomalies a controller should see before approving: fuel/tipping surcharges out of range, fees never seen before on this vendor, line amounts deviating from the vendor's history, likely duplicates, and missing POs on large lines. Be specific and quantitative in flag messages. Money is in US dollars. Always call the record_invoice tool.`;

export async function parseInvoice(
  input: InvoiceInput,
  vendorName: string,
  vendorHistory: string,
): Promise<OcrResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Artificial latency so the demo's "Processing" stage is visible before the draft fills in.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { ...mockParse(input, vendorName), usedAI: false };
  }

  const client = new Anthropic();

  const docBlock: Anthropic.ContentBlockParam = input.imageBase64
    ? input.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.imageBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: (input.mediaType ?? 'image/png') as 'image/png', data: input.imageBase64 } }
    : { type: 'text', text: `INVOICE:\n${input.text ?? ''}` };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    tools: [RECORD_TOOL],
    tool_choice: { type: 'tool', name: 'record_invoice' },
    messages: [
      {
        role: 'user',
        content: [
          // Stable, reusable vendor context first → cache it.
          {
            type: 'text',
            text: `VENDOR: ${vendorName}\n\nVENDOR HISTORY (prior bills for anomaly comparison):\n${vendorHistory}`,
            cache_control: { type: 'ephemeral' },
          },
          // Volatile: the invoice to process.
          docBlock,
          { type: 'text', text: 'Extract this invoice and flag anything anomalous versus the vendor history. Call record_invoice.' },
        ],
      },
    ],
  });

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
  if (!toolUse) return { ...mockParse(input, vendorName), usedAI: false };
  const parsed = toolUse.input as { extraction: OcrExtraction; flags: OcrFlag[] };
  return { extraction: parsed.extraction, flags: parsed.flags ?? [], usedAI: true };
}

// Deterministic fallback so the hosted demo works without an API key.
function mockParse(_input: InvoiceInput, vendorName: string): { extraction: OcrExtraction; flags: OcrFlag[] } {
  const extraction: OcrExtraction = {
    vendorGuess: vendorName || 'Regional Landfill Authority',
    invoiceNumber: 'INV-1046',
    issueDate: 'Jun 1, 2026',
    dueDate: 'Jul 1, 2026',
    currency: 'USD',
    subtotal: 85400,
    tax: 0,
    total: 85400,
    lineItems: [
      { description: 'Tipping fees — MSW disposal', quantity: 1300, unitPrice: 64.5, amount: 83850, glGuess: 'Tipping Fees' },
      { description: 'Fuel / energy surcharge', quantity: null, unitPrice: null, amount: 412, glGuess: 'Tipping Fees' },
      { description: 'Administrative fee', quantity: null, unitPrice: null, amount: 250, glGuess: 'Office' },
      { description: 'State environmental fee', quantity: null, unitPrice: null, amount: 888, glGuess: 'Tipping Fees' },
    ],
  };
  const flags: OcrFlag[] = [
    { type: 'anomalous_surcharge', severity: 'med', title: 'Fuel surcharge $412 — 32% above this vendor’s 6-month average', message: 'Regional Landfill’s fuel surcharge has averaged ~$312 across the last 6 invoices. This statement charges $412.', lineRef: 'Line 2 · Fuel / energy surcharge' },
    { type: 'new_fee', severity: 'med', title: 'New “admin fee” $250 not seen on prior Regional Landfill invoices', message: 'No administrative-fee line appears on the last 12 invoices from this vendor. Confirm it’s contractual before approving.', lineRef: 'Line 3 · Administrative fee' },
    { type: 'possible_duplicate', severity: 'high', title: 'Possible duplicate of INV-1042 (same amount, 4 days apart)', message: 'INV-1042 for $85,400.00 was received May 28 and is already scheduled. This invoice matches the amount to the cent.', lineRef: 'Header · Invoice # & amount' },
    { type: 'vendor_bank_change', severity: 'high', title: 'Regional Landfill’s bank account changed since last payment', message: 'Remit-to account ends ••7782; your last 14 payments went to ••3310. Verify the change with a known contact before paying — common vendor-impersonation pattern.', lineRef: 'Payment details · Remit-to' },
  ];
  return { extraction, flags };
}
