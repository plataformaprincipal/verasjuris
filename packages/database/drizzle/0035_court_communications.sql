-- Captura processual (DJEN) e sincronização de movimentações (Datajud).
DO $$ BEGIN
 CREATE TYPE "public"."court_communication_status" AS ENUM('new', 'linked', 'triaged', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."court_monitor_run_status" AS ENUM('never_run', 'ok', 'partial', 'error');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_communication_monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text DEFAULT 'djen' NOT NULL,
	"membership_id" uuid,
	"lawyer_name" text NOT NULL,
	"oab_number" text NOT NULL,
	"oab_uf" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"captured_through" date,
	"last_run_at" timestamp with time zone,
	"last_run_status" "court_monitor_run_status" DEFAULT 'never_run' NOT NULL,
	"last_run_message" text,
	"last_run_found" integer DEFAULT 0 NOT NULL,
	"last_run_created" integer DEFAULT 0 NOT NULL,
	"created_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_communications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"monitor_id" uuid,
	"provider" text DEFAULT 'djen' NOT NULL,
	"external_id" text NOT NULL,
	"external_hash" text,
	"tribunal" text,
	"communication_type" text,
	"document_type" text,
	"court_body" text,
	"class_name" text,
	"process_number" text,
	"process_number_masked" text,
	"medium" text,
	"content" text NOT NULL,
	"link" text,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lawyers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"available_on" date NOT NULL,
	"published_on" date,
	"term_starts_on" date,
	"status" "court_communication_status" DEFAULT 'new' NOT NULL,
	"category" text,
	"suggested_action" text,
	"suggested_days" integer,
	"suggested_rule_type" text,
	"suggestion_basis" text,
	"ai_summary" text,
	"ai_summary_model" text,
	"judicial_process_id" uuid,
	"deadline_id" uuid,
	"task_id" uuid,
	"triaged_by_membership_id" uuid,
	"triaged_at" timestamp with time zone,
	"dismissed_reason" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communication_monitors" ADD CONSTRAINT "court_comm_monitors_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communication_monitors" ADD CONSTRAINT "court_comm_monitors_membership_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communication_monitors" ADD CONSTRAINT "court_comm_monitors_created_by_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communications" ADD CONSTRAINT "court_communications_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communications" ADD CONSTRAINT "court_communications_monitor_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."court_communication_monitors"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communications" ADD CONSTRAINT "court_communications_process_fk" FOREIGN KEY ("judicial_process_id") REFERENCES "public"."judicial_processes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communications" ADD CONSTRAINT "court_communications_deadline_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communications" ADD CONSTRAINT "court_communications_task_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "court_communications" ADD CONSTRAINT "court_communications_triaged_by_fk" FOREIGN KEY ("triaged_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "court_comm_monitors_org_oab_unique" ON "court_communication_monitors" USING btree ("organization_id","provider","oab_number","oab_uf");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_comm_monitors_active_idx" ON "court_communication_monitors" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "court_communications_org_external_unique" ON "court_communications" USING btree ("organization_id","provider","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_communications_org_status_idx" ON "court_communications" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_communications_org_available_idx" ON "court_communications" USING btree ("organization_id","available_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_communications_process_number_idx" ON "court_communications" USING btree ("organization_id","process_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_communications_judicial_process_idx" ON "court_communications" USING btree ("judicial_process_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "judicial_movements_process_source_ref_unique" ON "judicial_movements" USING btree ("judicial_process_id","source_reference") WHERE "source_reference" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "court_communication_monitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "court_communications" ENABLE ROW LEVEL SECURITY;
