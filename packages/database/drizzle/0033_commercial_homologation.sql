-- Homologação comercial auditável (evidências SKU + aprovações live).
CREATE TABLE IF NOT EXISTS "sku_homologation_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_code" text NOT NULL,
	"product_id" uuid,
	"check_key" text NOT NULL,
	"result" text NOT NULL,
	"evidence_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"recorded_by_user_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments_homologation_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"approver_user_id" uuid NOT NULL,
	"checklist_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"blocking_at_decision" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sku_homologation_evidence" ADD CONSTRAINT "sku_homologation_evidence_product_id_monetization_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."monetization_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sku_homologation_evidence" ADD CONSTRAINT "sku_homologation_evidence_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments_homologation_approvals" ADD CONSTRAINT "payments_homologation_approvals_approver_user_id_users_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sku_homologation_evidence_sku_idx" ON "sku_homologation_evidence" USING btree ("sku_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sku_homologation_evidence_check_idx" ON "sku_homologation_evidence" USING btree ("check_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sku_homologation_evidence_active_unique" ON "sku_homologation_evidence" USING btree ("sku_code","check_key") WHERE "superseded_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_homologation_approvals_decision_idx" ON "payments_homologation_approvals" USING btree ("decision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_homologation_approvals_approver_idx" ON "payments_homologation_approvals" USING btree ("approver_user_id");
