CREATE TYPE "public"."account_type" AS ENUM('CHECKING', 'CREDIT_CARD', 'LOAN', 'SAVINGS');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('A_PAGAR', 'RESERVADO', 'PAGO');--> statement-breakpoint
CREATE TYPE "public"."debt_direction" AS ENUM('TAKEN', 'GIVEN');--> statement-breakpoint
CREATE TYPE "public"."import_format" AS ENUM('CSV', 'XLSX', 'OFX', 'PDF');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('UPLOADED', 'PARSED', 'REVIEWED', 'IMPORTED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."rule_match_type" AS ENUM('KEYWORD', 'REGEX');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('MANUAL', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('INCOME', 'EXPENSE', 'TRANSFER');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"institution" text,
	"current_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit_limit" numeric(14, 2),
	"closing_day" integer,
	"due_day" integer,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorization_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_type" "rule_match_type" DEFAULT 'KEYWORD' NOT NULL,
	"pattern" text NOT NULL,
	"min_amount" numeric(14, 2),
	"max_amount" numeric(14, 2),
	"sign" varchar(1),
	"category_id" uuid,
	"transaction_type" "transaction_type",
	"counter_account_id" uuid,
	"debt_id" uuid,
	"priority" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"color" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"direction" "debt_direction" DEFAULT 'TAKEN' NOT NULL,
	"principal_total" numeric(14, 2) NOT NULL,
	"installments" integer,
	"counterparty_name" text,
	"account_id" uuid,
	"start_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"format" "import_format" NOT NULL,
	"period_start" date,
	"period_end" date,
	"file_url" text,
	"file_name" text,
	"status" "import_status" DEFAULT 'UPLOADED' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"via" text,
	"kind" text DEFAULT 'OTHER' NOT NULL,
	"hourly_rate" numeric(14, 2),
	"expected_monthly" numeric(14, 2),
	"account_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_bill_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"recurring_bill_id" uuid,
	"name" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"due_day" integer,
	"status" "bill_status" DEFAULT 'A_PAGAR' NOT NULL,
	"category_id" uuid,
	"paid_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"due_day" integer,
	"category_id" uuid,
	"account_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"account_id" uuid NOT NULL,
	"counter_account_id" uuid,
	"category_id" uuid,
	"debt_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"raw_description" text,
	"status" "transaction_status" DEFAULT 'CONFIRMED' NOT NULL,
	"source" "transaction_source" DEFAULT 'MANUAL' NOT NULL,
	"import_batch_id" uuid,
	"dedup_hash" text,
	"fitid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_counter_account_id_account_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rule" ADD CONSTRAINT "categorization_rule_debt_id_debt_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt" ADD CONSTRAINT "debt_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_source" ADD CONSTRAINT "income_source_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_status" ADD CONSTRAINT "monthly_bill_status_recurring_bill_id_recurring_bill_id_fk" FOREIGN KEY ("recurring_bill_id") REFERENCES "public"."recurring_bill"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_status" ADD CONSTRAINT "monthly_bill_status_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_bill_status" ADD CONSTRAINT "monthly_bill_status_paid_transaction_id_transaction_id_fk" FOREIGN KEY ("paid_transaction_id") REFERENCES "public"."transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_counter_account_id_account_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rule_user_priority_idx" ON "categorization_rule" USING btree ("user_id","priority");--> statement-breakpoint
CREATE INDEX "category_user_idx" ON "category" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "debt_user_idx" ON "debt" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "import_batch_user_idx" ON "import_batch" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "income_source_user_idx" ON "income_source" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mbs_user_month_idx" ON "monthly_bill_status" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "mbs_unique_idx" ON "monthly_bill_status" USING btree ("user_id","month","recurring_bill_id");--> statement-breakpoint
CREATE INDEX "recurring_bill_user_idx" ON "recurring_bill" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transaction_user_date_idx" ON "transaction" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transaction_account_idx" ON "transaction" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_dedup_idx" ON "transaction" USING btree ("user_id","account_id","dedup_hash");