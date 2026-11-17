CREATE TABLE IF NOT EXISTS "email_dispatches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"recipient_user_id" uuid,
	"organization_id" uuid,
	"to_email_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_key" text,
	"provider_message_id" text,
	"error_code" text,
	"subject" text NOT NULL,
	"category" text DEFAULT 'transactional' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_key" text DEFAULT 'resend' NOT NULL,
	"external_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_message_id" text,
	"payload_hash" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error_code" text,
	"dispatch_id" uuid,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_dispatches" ADD CONSTRAINT "email_dispatches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_provider_events" ADD CONSTRAINT "email_provider_events_dispatch_id_email_dispatches_id_fk" FOREIGN KEY ("dispatch_id") REFERENCES "public"."email_dispatches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_dispatches_idempotency_unique" ON "email_dispatches" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_dispatches_status_idx" ON "email_dispatches" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_dispatches_provider_message_idx" ON "email_dispatches" USING btree ("provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_dispatches_org_idx" ON "email_dispatches" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_dispatches_user_idx" ON "email_dispatches" USING btree ("recipient_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_provider_events_provider_event_unique" ON "email_provider_events" USING btree ("provider_key","external_event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_provider_events_message_idx" ON "email_provider_events" USING btree ("provider_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_provider_events_status_idx" ON "email_provider_events" USING btree ("status");
