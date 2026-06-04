CREATE TYPE "public"."bill_status" AS ENUM('draft', 'pending_approval', 'approved', 'scheduled', 'paid', 'rejected', 'void');--> statement-breakpoint
CREATE TYPE "public"."flag_severity" AS ENUM('high', 'med', 'low');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'dismissed', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."flag_type" AS ENUM('anomalous_surcharge', 'new_fee', 'amount_deviation', 'possible_duplicate', 'vendor_bank_change', 'missing_po', 'other');--> statement-breakpoint
CREATE TYPE "public"."gl_type" AS ENUM('expense', 'asset', 'liability', 'income');--> statement-breakpoint
CREATE TYPE "public"."line_kind" AS ENUM('expense', 'item');--> statement-breakpoint
CREATE TYPE "public"."ocr_status" AS ENUM('none', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('ach', 'check', 'wire', 'card');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('scheduled', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_terms" AS ENUM('due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('clean', 'flagged', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('clerk', 'approver', 'controller');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"bill_id" text,
	"actor_id" text,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"target" text,
	"amount_cents" integer,
	"meta" text,
	"quote" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_events" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"mentions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"type" "flag_type" NOT NULL,
	"severity" "flag_severity" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"line_ref" text,
	"metadata" jsonb,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer,
	"unit_price_cents" integer,
	"amount_cents" integer NOT NULL,
	"gl_account_id" text,
	"gl_label" text,
	"kind" "line_kind" DEFAULT 'expense' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"status" "bill_status" DEFAULT 'draft' NOT NULL,
	"review_status" "review_status" DEFAULT 'clean' NOT NULL,
	"ocr_status" "ocr_status" DEFAULT 'none' NOT NULL,
	"source" text DEFAULT 'email' NOT NULL,
	"issue_date" timestamp,
	"due_date" timestamp,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"memo" text,
	"gl_account" text,
	"attachment_url" text,
	"created_by" text,
	"submitted_at" timestamp,
	"approved_by" text,
	"approved_at" timestamp,
	"scheduled_pay_date" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gl_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "gl_type" DEFAULT 'expense' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_item_splits" (
	"id" text PRIMARY KEY NOT NULL,
	"line_item_id" text NOT NULL,
	"gl_label" text NOT NULL,
	"cost_center" text,
	"amount_cents" integer NOT NULL,
	"percent_bps" integer,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sub" text,
	"mono" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"bill_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"pay_date" timestamp,
	"status" "payment_status" DEFAULT 'scheduled' NOT NULL,
	"reference_number" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bill_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"vendor_id" text NOT NULL,
	"frequency" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"gl_label" text,
	"next_run_date" timestamp NOT NULL,
	"last_generated_at" timestamp,
	"active" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" "user_role" NOT NULL,
	"mono" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"mono" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"tax_id" text,
	"terms" "payment_terms" DEFAULT 'net_30' NOT NULL,
	"default_method" "payment_method" DEFAULT 'ach' NOT NULL,
	"bank_last4" text,
	"status" text DEFAULT 'active' NOT NULL,
	"default_gl" text,
	"cadence" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_comments" ADD CONSTRAINT "bill_comments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_comments" ADD CONSTRAINT "bill_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_flags" ADD CONSTRAINT "bill_flags_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_line_items" ADD CONSTRAINT "bill_line_items_gl_account_id_gl_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_splits" ADD CONSTRAINT "line_item_splits_line_item_id_bill_line_items_id_fk" FOREIGN KEY ("line_item_id") REFERENCES "public"."bill_line_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "recurring_bill_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill_templates" ADD CONSTRAINT "recurring_bill_templates_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;