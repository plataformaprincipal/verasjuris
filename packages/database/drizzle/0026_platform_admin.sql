-- Administração interna da plataforma VerasJuris.
-- NÃO aplicar automaticamente em produção: exigir backup recuperável e plano de rollback.
-- Não contém senhas. Tokens de convite são armazenados apenas como hash.

DO $$ BEGIN
 CREATE TYPE "public"."platform_staff_status" AS ENUM('invited', 'active', 'suspended', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."platform_invite_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_key" text NOT NULL,
	"status" "platform_staff_status" DEFAULT 'invited' NOT NULL,
	"mfa_required" boolean DEFAULT true NOT NULL,
	"force_password_change" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role_key" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "platform_invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"accepted_user_id" uuid,
	"invited_by_user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_staff" ADD CONSTRAINT "platform_staff_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_admin_invites" ADD CONSTRAINT "platform_admin_invites_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_admin_invites" ADD CONSTRAINT "platform_admin_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_staff_user_role_unique" ON "platform_staff" USING btree ("user_id","role_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_staff_user_idx" ON "platform_staff" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_staff_status_idx" ON "platform_staff" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_staff_role_idx" ON "platform_staff" USING btree ("role_key");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_admin_invites_token_hash_unique" ON "platform_admin_invites" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_admin_invites_email_idx" ON "platform_admin_invites" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_admin_invites_status_idx" ON "platform_admin_invites" USING btree ("status");
