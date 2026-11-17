-- Additive commercial catalog support (2026-09). Never drop columns/types.
ALTER TYPE "public"."monetization_product_type" ADD VALUE IF NOT EXISTS 'addon';--> statement-breakpoint
ALTER TYPE "public"."monetization_product_type" ADD VALUE IF NOT EXISTS 'ai_module';--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."commercial_homologation_status" AS ENUM('catalog_only', 'partial', 'not_implemented');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD COLUMN IF NOT EXISTS "sku_code" text;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD COLUMN IF NOT EXISTS "commercial_type" text;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD COLUMN IF NOT EXISTS "commercial_version" text;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD COLUMN IF NOT EXISTS "homologation_status" "public"."commercial_homologation_status";--> statement-breakpoint
ALTER TABLE "monetization_products" ADD COLUMN IF NOT EXISTS "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monetization_products" ADD COLUMN IF NOT EXISTS "placement_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monetization_products_sku_idx" ON "monetization_products" USING btree ("sku_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monetization_products_commercial_type_idx" ON "monetization_products" USING btree ("commercial_type");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commercial_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku_code" text NOT NULL,
	"feature_key" text NOT NULL,
	"limit_type" text NOT NULL,
	"limit_value" bigint,
	"commercial_version" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commercial_entitlements" ADD CONSTRAINT "commercial_entitlements_product_id_monetization_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."monetization_products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_entitlements_sku_feature_unique" ON "commercial_entitlements" USING btree ("sku_code","feature_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commercial_entitlements_product_idx" ON "commercial_entitlements" USING btree ("product_id");
