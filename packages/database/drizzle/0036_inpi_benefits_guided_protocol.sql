-- INPI (RPI), checklists de benefícios e protocolo manual orientado.
DO $$ BEGIN
 CREATE TYPE "public"."inpi_dispatch_status" AS ENUM('new', 'triaged', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inpi_monitored_processes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
	"process_number" text NOT NULL,
	"kind" text DEFAULT 'marca' NOT NULL,
	"label" text,
	"holder_name" text,
	"legal_matter_id" uuid REFERENCES "public"."legal_matters"("id") ON DELETE set null,
	"administrative_process_id" uuid REFERENCES "public"."administrative_processes"("id") ON DELETE set null,
	"active" boolean DEFAULT true NOT NULL,
	"last_edition" integer,
	"last_dispatch_name" text,
	"last_dispatch_on" date,
	"created_by_membership_id" uuid REFERENCES "public"."organization_members"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inpi_monitored_org_number_unique" ON "inpi_monitored_processes" USING btree ("organization_id","process_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inpi_monitored_active_idx" ON "inpi_monitored_processes" USING btree ("active");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inpi_attorney_monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
	"attorney_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_membership_id" uuid REFERENCES "public"."organization_members"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inpi_attorney_org_name_unique" ON "inpi_attorney_monitors" USING btree ("organization_id","attorney_name");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inpi_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
	"monitored_process_id" uuid REFERENCES "public"."inpi_monitored_processes"("id") ON DELETE set null,
	"edition" integer NOT NULL,
	"published_on" date NOT NULL,
	"process_number" text NOT NULL,
	"mark_name" text,
	"holders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attorney" text,
	"nice_classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"complement" text,
	"dedupe_key" text NOT NULL,
	"procedure_key" text,
	"suggested_days" integer,
	"suggested_due_on" date,
	"suggestion_basis" text,
	"status" "inpi_dispatch_status" DEFAULT 'new' NOT NULL,
	"deadline_id" uuid REFERENCES "public"."deadlines"("id") ON DELETE set null,
	"task_id" uuid REFERENCES "public"."tasks"("id") ON DELETE set null,
	"triaged_by_membership_id" uuid REFERENCES "public"."organization_members"("id") ON DELETE set null,
	"triaged_at" timestamp with time zone,
	"dismissed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "inpi_dispatches_org_dedupe_unique" ON "inpi_dispatches" USING btree ("organization_id","dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inpi_dispatches_org_status_idx" ON "inpi_dispatches" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inpi_dispatches_org_published_idx" ON "inpi_dispatches" USING btree ("organization_id","published_on");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inpi_rpi_runs" (
	"edition" integer PRIMARY KEY NOT NULL,
	"published_on" date,
	"status" text NOT NULL,
	"message" text,
	"matched" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "benefit_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE cascade,
	"benefit_key" text NOT NULL,
	"legal_matter_id" uuid REFERENCES "public"."legal_matters"("id") ON DELETE set null,
	"administrative_process_id" uuid REFERENCES "public"."administrative_processes"("id") ON DELETE set null,
	"client_label" text,
	"items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_membership_id" uuid REFERENCES "public"."organization_members"("id") ON DELETE set null,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "benefit_checklists_org_idx" ON "benefit_checklists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "benefit_checklists_matter_idx" ON "benefit_checklists" USING btree ("legal_matter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "benefit_checklists_admin_process_idx" ON "benefit_checklists" USING btree ("administrative_process_id");--> statement-breakpoint
ALTER TABLE "administrative_requests" ADD COLUMN IF NOT EXISTS "procedure_key" text;--> statement-breakpoint
ALTER TABLE "administrative_requests" ADD COLUMN IF NOT EXISTS "receipt_document_id" uuid;--> statement-breakpoint
INSERT INTO "administrative_bodies" ("code","name","acronym","body_type","jurisdiction","state_code","source","active") VALUES
	('PGFN','Procuradoria-Geral da Fazenda Nacional','PGFN','federal','federal',NULL,'catalog_2026_11',true),
	('INPI','Instituto Nacional da Propriedade Industrial','INPI','autarchy','federal',NULL,'catalog_2026_11',true),
	('CGU-FALABR','Controladoria-Geral da União — Fala.BR','Fala.BR','federal','federal',NULL,'catalog_2026_11',true),
	('SENACON','Secretaria Nacional do Consumidor — Consumidor.gov.br','Consumidor.gov.br','federal','federal',NULL,'catalog_2026_11',true),
	('SEI-FEDERAL','Sistema Eletrônico de Informações — órgãos federais','SEI','federal','federal',NULL,'catalog_2026_11',true),
	('PROCON-PB','Procon da Paraíba','Procon-PB','state','state','PB','catalog_2026_11',true),
	('DETRAN-PB','Departamento Estadual de Trânsito da Paraíba','Detran-PB','state','state','PB','catalog_2026_11',true)
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
ALTER TABLE "inpi_monitored_processes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inpi_attorney_monitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inpi_dispatches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inpi_rpi_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "benefit_checklists" ENABLE ROW LEVEL SECURITY;
