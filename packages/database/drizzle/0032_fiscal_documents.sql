-- Fase 8: registro de documentos fiscais (NFS-e/NF-e) sem emissão inventada.
CREATE TABLE IF NOT EXISTS "fiscal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid,
	"requested_by_user_id" uuid,
	"kind" text NOT NULL,
	"provider_key" text DEFAULT 'not_configured' NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"external_document_id" text,
	"number" text,
	"access_key" text,
	"pdf_url" text,
	"xml_url" text,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"detail" text,
	"idempotency_key" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fiscal_documents" ADD CONSTRAINT "fiscal_documents_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_documents_org_idempotency_unique" ON "fiscal_documents" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_documents_org_status_idx" ON "fiscal_documents" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fiscal_documents_invoice_idx" ON "fiscal_documents" USING btree ("invoice_id");
