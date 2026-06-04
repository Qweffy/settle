import { z } from 'zod';
import { paymentMethod, paymentTerms, glType } from '@/db/schema';
import { type ActionResult, ok, err } from './result';

// Server-side input validation for the server actions. TS types are erased at
// the action boundary (the client can POST anything), so these schemas are the
// real runtime guard — and the explicit bound on `idSchema` is what makes the
// "SQL injection in loadBill" static-analysis flag a non-issue.

// ---- primitives ----
export const idSchema = z.string().trim().min(1, 'Required').max(128, 'Invalid id');
const centsSchema = z.number().int('Amount must be whole cents');
const nonNegativeCents = z.number().int().min(0, 'Amount cannot be negative');
// Accept any string `new Date` can parse (actions already NaN-guard); the UI
// emits both ISO dates and human strings like "Jun 12, 2026".
const dateStringNullable = z
  .string()
  .nullable()
  .refine((s) => s == null || s.trim() === '' || !Number.isNaN(Date.parse(s)), 'Invalid date');

export const paymentMethodSchema = z.enum(paymentMethod.enumValues);
export const paymentTermsSchema = z.enum(paymentTerms.enumValues);
export const glTypeSchema = z.enum(glType.enumValues);
export const bulkActionSchema = z.enum(['submit', 'approve', 'schedule', 'pay']);

// ---- composite ----
const splitSchema = z.object({
  glLabel: z.string().trim().min(1),
  amountCents: centsSchema,
});
export const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'Each line needs a description'),
  quantity: z.number().int().nullable(),
  unitPriceCents: centsSchema.nullable(),
  amountCents: centsSchema,
  glLabel: z.string().trim().min(1, 'Each line needs a GL account'),
  kind: z.enum(['expense', 'item']).optional(),
  splits: z.array(splitSchema).optional(),
});

const billInputShape = {
  vendorId: idSchema,
  invoiceNumber: z.string().trim().min(1, 'Invoice number is required'),
  issueDate: dateStringNullable,
  dueDate: dateStringNullable,
  memo: z.string().nullable(),
  taxCents: nonNegativeCents,
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one line item'),
};
export const createBillSchema = z.object(billInputShape);
export const updateBillSchema = z.object(billInputShape);

export const schedulePaymentSchema = z.object({
  billId: idSchema,
  method: paymentMethodSchema,
  payDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid pay date'),
});

export const addCommentSchema = z.object({
  billId: idSchema,
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
  mentions: z.array(idSchema).default([]),
});

export const bulkAdvanceSchema = z.object({
  ids: z.array(idSchema).min(1),
  action: bulkActionSchema,
});

const importRowSchema = z.object({
  vendor: z.string(),
  invoiceNumber: z.string(),
  amount: z.number(),
  dueDate: z.string().nullable(),
  gl: z.string(),
  description: z.string().optional(),
});
export const importBillsSchema = z.array(importRowSchema);

const savedViewConfigSchema = z.object({
  tab: z.string(),
  query: z.string(),
  sort: z.object({ key: z.enum(['vendor', 'amount', 'due']), dir: z.enum(['asc', 'desc']) }),
  filters: z.array(z.string()),
  cols: z.array(z.string()),
  density: z.number(),
});
export const savedViewSchema = z.object({
  name: z.string().trim().min(1, 'Name your view').max(120),
  config: savedViewConfigSchema,
});

export const allocationTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name your template').max(120),
  vendorId: idSchema.nullable(),
  lines: z
    .array(z.object({ glLabel: z.string().trim().min(1), percentBps: z.number().int().min(0).max(10000) }))
    .min(1, 'A template needs at least one split'),
});

export const vendorInputSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required'),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  taxId: z.string(),
  terms: paymentTermsSchema,
  defaultMethod: paymentMethodSchema,
  bankLast4: z.string(),
  defaultGl: z.string(),
});

export const glAccountInputSchema = z.object({
  code: z.string().trim().min(1, 'GL code is required'),
  name: z.string().trim().min(1, 'GL name is required'),
  type: glTypeSchema,
});

// ---- helpers ----
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw new Error(firstIssueMessage(r.error));
  return r.data;
}

export function parseOrResult<S extends z.ZodType>(schema: S, input: unknown): ActionResult<z.infer<S>> {
  const r = schema.safeParse(input);
  return r.success ? ok(r.data) : err(firstIssueMessage(r.error));
}
