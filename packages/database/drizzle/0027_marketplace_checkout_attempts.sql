CREATE TABLE IF NOT EXISTS "marketplace_checkout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cart_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text DEFAULT 'pix' NOT NULL,
	"client_id" uuid,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"snapshot_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_checkout_attempt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"cart_item_id" uuid,
	"professional_service_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"amount_cents" bigint NOT NULL,
	"service_title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"engagement_id" uuid,
	"payment_intent_id" uuid,
	"error_code" text,
	"error_message" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempts" ADD CONSTRAINT "marketplace_checkout_attempts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempts" ADD CONSTRAINT "marketplace_checkout_attempts_cart_id_marketplace_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."marketplace_carts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempts" ADD CONSTRAINT "marketplace_checkout_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempts" ADD CONSTRAINT "marketplace_checkout_attempts_client_id_crm_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."crm_clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempt_items" ADD CONSTRAINT "marketplace_checkout_attempt_items_attempt_id_marketplace_checkout_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."marketplace_checkout_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempt_items" ADD CONSTRAINT "marketplace_checkout_attempt_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempt_items" ADD CONSTRAINT "marketplace_checkout_attempt_items_professional_service_id_professional_services_id_fk" FOREIGN KEY ("professional_service_id") REFERENCES "public"."professional_services"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_checkout_attempt_items" ADD CONSTRAINT "marketplace_checkout_attempt_items_engagement_id_marketplace_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."marketplace_engagements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_checkout_attempts_idempotency_unique" ON "marketplace_checkout_attempts" USING btree ("organization_id","user_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_checkout_attempts_cart_idx" ON "marketplace_checkout_attempts" USING btree ("cart_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_checkout_attempts_org_user_idx" ON "marketplace_checkout_attempts" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_checkout_attempts_status_idx" ON "marketplace_checkout_attempts" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_checkout_attempt_items_attempt_cart_item_unique" ON "marketplace_checkout_attempt_items" USING btree ("attempt_id","cart_item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_checkout_attempt_items_attempt_idx" ON "marketplace_checkout_attempt_items" USING btree ("attempt_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_checkout_attempt_items_engagement_idx" ON "marketplace_checkout_attempt_items" USING btree ("engagement_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_checkout_attempt_items_status_idx" ON "marketplace_checkout_attempt_items" USING btree ("status");
