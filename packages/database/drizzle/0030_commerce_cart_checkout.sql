-- Fase 2/3: carrinho universal, pedidos comerciais e grants pós-pagamento.
CREATE TABLE IF NOT EXISTS "commerce_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commerce_cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku_code" text NOT NULL,
	"product_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commerce_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"cart_id" uuid,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"total_cents" bigint NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"payment_intent_id" uuid,
	"idempotency_key" text NOT NULL,
	"commercial_version" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commerce_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku_code" text NOT NULL,
	"product_id" uuid,
	"commercial_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" bigint NOT NULL,
	"line_total_cents" bigint NOT NULL,
	"credits_granted" integer,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization_commercial_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"sku_code" text NOT NULL,
	"feature_key" text NOT NULL,
	"limit_type" text NOT NULL,
	"limit_value" bigint,
	"source_order_id" uuid,
	"source_payment_intent_id" uuid,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_carts" ADD CONSTRAINT "commerce_carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_cart_id_commerce_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."commerce_carts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_cart_items" ADD CONSTRAINT "commerce_cart_items_product_id_monetization_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."monetization_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_cart_id_commerce_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."commerce_carts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_orders" ADD CONSTRAINT "commerce_orders_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_order_id_commerce_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."commerce_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commerce_order_items" ADD CONSTRAINT "commerce_order_items_product_id_monetization_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."monetization_products"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_commercial_grants" ADD CONSTRAINT "organization_commercial_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_commercial_grants" ADD CONSTRAINT "organization_commercial_grants_source_order_id_commerce_orders_id_fk" FOREIGN KEY ("source_order_id") REFERENCES "public"."commerce_orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization_commercial_grants" ADD CONSTRAINT "organization_commercial_grants_source_payment_intent_id_payment_intents_id_fk" FOREIGN KEY ("source_payment_intent_id") REFERENCES "public"."payment_intents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_carts_org_user_idx" ON "commerce_carts" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_carts_user_idx" ON "commerce_carts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_carts_status_idx" ON "commerce_carts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commerce_cart_items_cart_sku_unique" ON "commerce_cart_items" USING btree ("cart_id","sku_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_cart_items_org_idx" ON "commerce_cart_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_cart_items_sku_idx" ON "commerce_cart_items" USING btree ("sku_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "commerce_orders_org_idempotency_unique" ON "commerce_orders" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_orders_org_status_idx" ON "commerce_orders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_orders_payment_intent_idx" ON "commerce_orders" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_order_items_order_idx" ON "commerce_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "commerce_order_items_sku_idx" ON "commerce_order_items" USING btree ("sku_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_commercial_grants_order_feature_unique" ON "organization_commercial_grants" USING btree ("source_order_id","feature_key","sku_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_commercial_grants_org_feature_idx" ON "organization_commercial_grants" USING btree ("organization_id","feature_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "org_commercial_grants_status_idx" ON "organization_commercial_grants" USING btree ("status");
