-- Fase 6: projetos de serviço SRV_* com marcos 30/70.
CREATE TABLE IF NOT EXISTS "commerce_service_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requester_user_id" uuid NOT NULL,
	"sku_code" text NOT NULL,
	"product_id" uuid,
	"status" text DEFAULT 'proposed' NOT NULL,
	"total_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"requires_proposal" boolean DEFAULT false NOT NULL,
	"notes" text,
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"delivery_accepted_at" timestamp with time zone,
	"delivery_summary" text,
	"delivery_artifact_url" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commerce_service_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"pct_bps" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_intent_id" uuid,
	"paid_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"sort_order" integer DEFAULT 10 NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_service_projects" ADD CONSTRAINT "commerce_service_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_service_projects" ADD CONSTRAINT "commerce_service_projects_requester_user_id_users_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_service_projects" ADD CONSTRAINT "commerce_service_projects_product_id_monetization_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."monetization_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_service_milestones" ADD CONSTRAINT "commerce_service_milestones_project_id_commerce_service_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."commerce_service_projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_service_milestones" ADD CONSTRAINT "commerce_service_milestones_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_service_milestones" ADD CONSTRAINT "commerce_service_milestones_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_service_projects_org_idx" ON "commerce_service_projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_service_projects_sku_idx" ON "commerce_service_projects" USING btree ("sku_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_service_projects_status_idx" ON "commerce_service_projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commerce_service_milestones_project_kind_unique" ON "commerce_service_milestones" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_service_milestones_org_idx" ON "commerce_service_milestones" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_service_milestones_status_idx" ON "commerce_service_milestones" USING btree ("status");
