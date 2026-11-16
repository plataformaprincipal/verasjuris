-- 0023_marketplace_inicio_hub
--
-- ATENÇÃO — NÃO APLICAR AUTOMATICAMENTE EM PRODUÇÃO.
-- A migration 0021 (onboarding_profile_fields) foi aplicada MANUALMENTE em produção,
-- portanto o histórico do drizzle em produção pode divergir deste repositório.
-- Antes de aplicar 0023 em produção: backup verificado, revisão do estado real do schema
-- e plano de rollback (DROP TABLE marketplace_engagement_events; DROP COLUMN financial_status,
-- cancelled_at, cancellation_reason; DROP INDEX dos índices abaixo).
-- Todas as instruções são idempotentes (IF NOT EXISTS) para reduzir risco de reexecução.

-- Cancelamento / situação financeira (nunca "refunded" sem confirmação do provedor).
ALTER TABLE "marketplace_engagements" ADD COLUMN IF NOT EXISTS "financial_status" text DEFAULT 'none';
--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "marketplace_engagements" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_engagement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engagement_id" uuid NOT NULL,
	"organization_id" uuid,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason" text,
	"amount_cents" bigint,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_engagement_events" ADD CONSTRAINT "marketplace_engagement_events_engagement_id_marketplace_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."marketplace_engagements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_engagement_events" ADD CONSTRAINT "marketplace_engagement_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_engagement_events" ADD CONSTRAINT "marketplace_engagement_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_engagement_events_engagement_idx" ON "marketplace_engagement_events" USING btree ("engagement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_engagement_events_org_idx" ON "marketplace_engagement_events" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_engagement_events_type_idx" ON "marketplace_engagement_events" USING btree ("event_type");
--> statement-breakpoint
-- Busca de catálogo: índice funcional simples em lower(title) (sem depender da extensão pg_trgm)
-- e índice composto para listagem dos serviços ativos mais recentes.
CREATE INDEX IF NOT EXISTS "professional_services_title_lower_idx" ON "professional_services" USING btree (lower("title"));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professional_services_active_updated_idx" ON "professional_services" USING btree ("active", "updated_at" DESC);
