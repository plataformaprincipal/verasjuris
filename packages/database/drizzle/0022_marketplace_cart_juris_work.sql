CREATE TABLE IF NOT EXISTS "marketplace_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketplace_cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"professional_service_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."juris_work_task_status" AS ENUM('draft', 'planned', 'awaiting_approval', 'running', 'completed', 'failed', 'cancelled', 'budget_exceeded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."juris_work_step_status" AS ENUM('pending', 'awaiting_approval', 'running', 'completed', 'failed', 'skipped', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "juris_work_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_by_membership_id" uuid,
	"title" text NOT NULL,
	"objective" text NOT NULL,
	"status" "juris_work_task_status" DEFAULT 'draft' NOT NULL,
	"plan_json" jsonb,
	"result_json" jsonb,
	"budget_micros" bigint,
	"spent_micros" bigint DEFAULT 0 NOT NULL,
	"max_steps" integer DEFAULT 12 NOT NULL,
	"requires_human_approval" boolean DEFAULT true NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "juris_work_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"tool_name" text NOT NULL,
	"title" text NOT NULL,
	"status" "juris_work_step_status" DEFAULT 'pending' NOT NULL,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"input_json" jsonb,
	"output_json" jsonb,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_carts" ADD CONSTRAINT "marketplace_carts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_carts" ADD CONSTRAINT "marketplace_carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_cart_items" ADD CONSTRAINT "marketplace_cart_items_cart_id_marketplace_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."marketplace_carts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_cart_items" ADD CONSTRAINT "marketplace_cart_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_cart_items" ADD CONSTRAINT "marketplace_cart_items_professional_service_id_professional_services_id_fk" FOREIGN KEY ("professional_service_id") REFERENCES "public"."professional_services"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_tasks" ADD CONSTRAINT "juris_work_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_tasks" ADD CONSTRAINT "juris_work_tasks_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_tasks" ADD CONSTRAINT "juris_work_tasks_created_by_membership_id_organization_members_id_fk" FOREIGN KEY ("created_by_membership_id") REFERENCES "public"."organization_members"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_tasks" ADD CONSTRAINT "juris_work_tasks_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_steps" ADD CONSTRAINT "juris_work_steps_task_id_juris_work_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."juris_work_tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_steps" ADD CONSTRAINT "juris_work_steps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "juris_work_steps" ADD CONSTRAINT "juris_work_steps_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_carts_org_user_idx" ON "marketplace_carts" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_carts_user_idx" ON "marketplace_carts" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_cart_items_cart_service_unique" ON "marketplace_cart_items" USING btree ("cart_id","professional_service_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_cart_items_org_idx" ON "marketplace_cart_items" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_tasks_org_status_idx" ON "juris_work_tasks" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_tasks_created_by_idx" ON "juris_work_tasks" USING btree ("created_by_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "juris_work_steps_task_index_unique" ON "juris_work_steps" USING btree ("task_id","step_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "juris_work_steps_org_idx" ON "juris_work_steps" USING btree ("organization_id");
