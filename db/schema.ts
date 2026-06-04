// Settle — Drizzle schema (Postgres / Neon)
// Money is stored as integer cents. Status fields use pg enums.
import { pgTable, text, integer, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { SavedViewConfig } from '@/lib/data/bills';

/* ----------------------------- enums ----------------------------- */
export const userRole = pgEnum('user_role', ['clerk', 'approver', 'controller']);
export const billStatus = pgEnum('bill_status', [
  'draft',
  'pending_approval',
  'approved',
  'scheduled',
  'paid',
  'rejected',
  'void',
]);
export const reviewStatus = pgEnum('review_status', ['clean', 'flagged', 'reviewed']);
export const ocrStatus = pgEnum('ocr_status', ['none', 'processing', 'done', 'failed']);
export const paymentTerms = pgEnum('payment_terms', [
  'due_on_receipt',
  'net_15',
  'net_30',
  'net_45',
  'net_60',
]);
export const paymentMethod = pgEnum('payment_method', ['ach', 'check', 'wire', 'card']);
export const paymentStatus = pgEnum('payment_status', ['scheduled', 'processing', 'paid', 'failed']);
export const glType = pgEnum('gl_type', ['expense', 'asset', 'liability', 'income']);
export const lineKind = pgEnum('line_kind', ['expense', 'item']);
export const flagType = pgEnum('flag_type', [
  'anomalous_surcharge',
  'new_fee',
  'amount_deviation',
  'possible_duplicate',
  'vendor_bank_change',
  'missing_po',
  'other',
]);
export const flagSeverity = pgEnum('flag_severity', ['high', 'med', 'low']);
export const flagStatus = pgEnum('flag_status', ['open', 'dismissed', 'accepted']);

/* --------------------------- tables ------------------------------ */
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sub: text('sub'),
  mono: text('mono'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  email: text('email'),
  role: userRole('role').notNull(),
  mono: text('mono').notNull(),
  description: text('description'),
});

export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  mono: text('mono').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  terms: paymentTerms('terms').notNull().default('net_30'),
  defaultMethod: paymentMethod('default_method').notNull().default('ach'),
  bankLast4: text('bank_last4'),
  status: text('status').notNull().default('active'), // active | inactive
  defaultGl: text('default_gl'),
  cadence: text('cadence'), // monthly | weekly | null
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const glAccounts = pgTable('gl_accounts', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: glType('type').notNull().default('expense'),
});

export const bills = pgTable('bills', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  invoiceNumber: text('invoice_number').notNull(),
  status: billStatus('status').notNull().default('draft'),
  reviewStatus: reviewStatus('review_status').notNull().default('clean'),
  ocrStatus: ocrStatus('ocr_status').notNull().default('none'),
  source: text('source').notNull().default('email'), // email | manual | ocr — drives the cockpit timeline narrative
  issueDate: timestamp('issue_date'),
  dueDate: timestamp('due_date'),
  currency: text('currency').notNull().default('USD'),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  taxCents: integer('tax_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
  memo: text('memo'),
  glAccount: text('gl_account'), // primary category, for list display
  attachmentUrl: text('attachment_url'),
  createdBy: text('created_by').references(() => users.id),
  submittedAt: timestamp('submitted_at'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  scheduledPayDate: timestamp('scheduled_pay_date'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const billLineItems = pgTable('bill_line_items', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: integer('quantity'),
  unitPriceCents: integer('unit_price_cents'),
  amountCents: integer('amount_cents').notNull(),
  glAccountId: text('gl_account_id').references(() => glAccounts.id),
  glLabel: text('gl_label'),
  kind: lineKind('kind').notNull().default('expense'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const billFlags = pgTable('bill_flags', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  type: flagType('type').notNull(),
  severity: flagSeverity('severity').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  lineRef: text('line_ref'),
  metadata: jsonb('metadata'),
  status: flagStatus('status').notNull().default('open'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const approvalEvents = pgTable('approval_events', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => users.id),
  action: text('action').notNull(), // submit | approve | reject
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull(),
  method: paymentMethod('method').notNull(),
  payDate: timestamp('pay_date'),
  status: paymentStatus('status').notNull().default('scheduled'),
  referenceNumber: text('reference_number'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const billComments = pgTable('bill_comments', {
  id: text('id').primaryKey(),
  billId: text('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  authorId: text('author_id').references(() => users.id),
  body: text('body').notNull(),
  mentions: jsonb('mentions').$type<string[]>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const activityLog = pgTable('activity_log', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  billId: text('bill_id').references(() => bills.id, { onDelete: 'cascade' }),
  actorId: text('actor_id'),
  type: text('type').notNull(), // created | submitted | approved | rejected | scheduled | paid | failed | commented | synced
  text: text('text').notNull(),
  target: text('target'),
  amountCents: integer('amount_cents'),
  meta: text('meta'),
  quote: text('quote'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Recurring bill schedules — generate the next bill for a vendor on a cadence.
export const recurringBillTemplates = pgTable('recurring_bill_templates', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  frequency: text('frequency').notNull(), // monthly | weekly | quarterly
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),
  glLabel: text('gl_label'),
  nextRunDate: timestamp('next_run_date').notNull(),
  lastGeneratedAt: timestamp('last_generated_at'),
  active: text('active').notNull().default('active'), // active | paused
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Split a line item's amount across multiple GL accounts / cost centers.
export const lineItemSplits = pgTable('line_item_splits', {
  id: text('id').primaryKey(),
  lineItemId: text('line_item_id').notNull().references(() => billLineItems.id, { onDelete: 'cascade' }),
  glLabel: text('gl_label').notNull(),
  costCenter: text('cost_center'),
  amountCents: integer('amount_cents').notNull(),
  percentBps: integer('percent_bps'), // basis points of the line total (0-10000)
  memo: text('memo'),
});

// A saved bills-list view — a named snapshot of the table's filter state,
// shared across the org's AP team. `config` is pure UI state stored as JSON.
export const savedViews = pgTable('saved_views', {
  id: text('id').primaryKey(),
  orgId: text('org_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  config: jsonb('config').$type<SavedViewConfig>().notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/* --------------------------- relations --------------------------- */
export const vendorsRelations = relations(vendors, ({ many }) => ({
  bills: many(bills),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  vendor: one(vendors, { fields: [bills.vendorId], references: [vendors.id] }),
  org: one(organizations, { fields: [bills.orgId], references: [organizations.id] }),
  createdByUser: one(users, { fields: [bills.createdBy], references: [users.id] }),
  lineItems: many(billLineItems),
  flags: many(billFlags),
  approvals: many(approvalEvents),
  payments: many(payments),
  comments: many(billComments),
}));

export const lineItemsRelations = relations(billLineItems, ({ one, many }) => ({
  bill: one(bills, { fields: [billLineItems.billId], references: [bills.id] }),
  gl: one(glAccounts, { fields: [billLineItems.glAccountId], references: [glAccounts.id] }),
  splits: many(lineItemSplits),
}));

export const flagsRelations = relations(billFlags, ({ one }) => ({
  bill: one(bills, { fields: [billFlags.billId], references: [bills.id] }),
}));

export const commentsRelations = relations(billComments, ({ one }) => ({
  bill: one(bills, { fields: [billComments.billId], references: [bills.id] }),
  author: one(users, { fields: [billComments.authorId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  bill: one(bills, { fields: [payments.billId], references: [bills.id] }),
}));

export const approvalEventsRelations = relations(approvalEvents, ({ one }) => ({
  bill: one(bills, { fields: [approvalEvents.billId], references: [bills.id] }),
  actor: one(users, { fields: [approvalEvents.actorId], references: [users.id] }),
}));

export const recurringTemplatesRelations = relations(recurringBillTemplates, ({ one }) => ({
  vendor: one(vendors, { fields: [recurringBillTemplates.vendorId], references: [vendors.id] }),
}));

export const lineItemSplitsRelations = relations(lineItemSplits, ({ one }) => ({
  lineItem: one(billLineItems, { fields: [lineItemSplits.lineItemId], references: [billLineItems.id] }),
}));
