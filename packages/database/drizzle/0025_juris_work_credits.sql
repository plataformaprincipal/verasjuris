-- JurisOne Work — ledger de créditos de execução (não financeiro).
-- NÃO aplicar automaticamente em produção: exigir backup recuperável e plano de rollback.
-- Custos em micros permanecem em ai_budgets / ai_usage.

DO $$ BEGIN
 CREATE TYPE "public"."juris_work_credit_event_type" AS ENUM('granted', 'reserved', 'consumed', 'released', 'adjusted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."juris_work_credit_direction" AS ENUM('credit', 'debit');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "juris_work_credit_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_granted" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "juris_work_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"event_type" "juris_work_credit_event_type" NOT NULL,
	"direction" "juris_work_credit_direction" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"actor_user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_credit_balances" ADD CONSTRAINT "juris_work_credit_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_credit_balances" ADD CONSTRAINT "juris_work_credit_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_credit_ledger" ADD CONSTRAINT "juris_work_credit_ledger_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_credit_ledger" ADD CONSTRAINT "juris_work_credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_credit_ledger" ADD CONSTRAINT "juris_work_credit_ledger_task_id_juris_work_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."juris_work_tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_credit_ledger" ADD CONSTRAINT "juris_work_credit_ledger_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "juris_work_credit_balances_org_user_unique" ON "juris_work_credit_balances" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_credit_balances_user_idx" ON "juris_work_credit_balances" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "juris_work_credit_ledger_idempotency_unique" ON "juris_work_credit_ledger" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_credit_ledger_org_user_idx" ON "juris_work_credit_ledger" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_credit_ledger_task_idx" ON "juris_work_credit_ledger" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_credit_ledger_created_idx" ON "juris_work_credit_ledger" USING btree ("created_at");
