-- Rede social jurídica (posts, grafo, moderação).
-- NÃO aplicar automaticamente em produção: exigir backup recuperável e plano de rollback.

CREATE TYPE "public"."social_post_visibility" AS ENUM('public', 'connections', 'private', 'draft');
--> statement-breakpoint
CREATE TYPE "public"."social_post_status" AS ENUM('published', 'draft', 'archived', 'hidden', 'removed');
--> statement-breakpoint
CREATE TYPE "public"."social_connection_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."social_report_status" AS ENUM('open', 'under_review', 'resolved', 'dismissed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "bio" text,
  "headline" text,
  "practice_areas" text,
  "location_label" text,
  "cover_image_url" text,
  "avatar_url" text,
  "profile_visibility" text DEFAULT 'public' NOT NULL,
  "who_can_follow" text DEFAULT 'everyone' NOT NULL,
  "who_can_message" text DEFAULT 'connections' NOT NULL,
  "who_can_connect" text DEFAULT 'everyone' NOT NULL,
  "show_organization" boolean DEFAULT true NOT NULL,
  "marketplace_opt_in" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_profiles_visibility_idx" ON "social_profiles" ("profile_visibility");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE set null,
  "body" text NOT NULL,
  "visibility" "social_post_visibility" DEFAULT 'public' NOT NULL,
  "status" "social_post_status" DEFAULT 'published' NOT NULL,
  "legal_category" text,
  "hashtags" text,
  "link_url" text,
  "like_count" integer DEFAULT 0 NOT NULL,
  "comment_count" integer DEFAULT 0 NOT NULL,
  "repost_count" integer DEFAULT 0 NOT NULL,
  "bookmark_count" integer DEFAULT 0 NOT NULL,
  "score_24h" bigint DEFAULT 0 NOT NULL,
  "score_7d" bigint DEFAULT 0 NOT NULL,
  "published_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_author_idx" ON "social_posts" ("author_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_status_visibility_idx" ON "social_posts" ("status", "visibility");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_published_idx" ON "social_posts" ("published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_posts_score7d_idx" ON "social_posts" ("score_7d");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_post_likes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_post_likes_post_user_unique" ON "social_post_likes" ("post_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_post_likes_user_idx" ON "social_post_likes" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "author_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "parent_comment_id" uuid,
  "body" text NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_comments_post_idx" ON "social_comments" ("post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_comments_author_idx" ON "social_comments" ("author_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_comments_parent_idx" ON "social_comments" ("parent_comment_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_reposts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "commentary" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_reposts_post_user_unique" ON "social_reposts" ("post_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_reposts_user_idx" ON "social_reposts" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_bookmarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_bookmarks_post_user_unique" ON "social_bookmarks" ("post_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_bookmarks_user_idx" ON "social_bookmarks" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_follows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "follower_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "following_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_follows_pair_unique" ON "social_follows" ("follower_user_id", "following_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_follows_following_idx" ON "social_follows" ("following_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "requester_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "addressee_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "status" "social_connection_status" DEFAULT 'pending' NOT NULL,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_pair_unique" ON "social_connections" ("requester_user_id", "addressee_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_connections_addressee_status_idx" ON "social_connections" ("addressee_user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_hides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_hides_user_post_unique" ON "social_hides" ("user_id", "post_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "blocker_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "blocked_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "social_blocks_pair_unique" ON "social_blocks" ("blocker_user_id", "blocked_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reporter_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "post_id" uuid REFERENCES "social_posts"("id") ON DELETE set null,
  "comment_id" uuid REFERENCES "social_comments"("id") ON DELETE set null,
  "reported_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "reason_code" text NOT NULL,
  "description" text,
  "status" "social_report_status" DEFAULT 'open' NOT NULL,
  "resolution" text,
  "resolved_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_reports_status_idx" ON "social_reports" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_reports_post_idx" ON "social_reports" ("post_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "type" text NOT NULL,
  "post_id" uuid REFERENCES "social_posts"("id") ON DELETE set null,
  "comment_id" uuid REFERENCES "social_comments"("id") ON DELETE set null,
  "body" text NOT NULL,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_notifications_user_idx" ON "social_notifications" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "social_notifications_unread_idx" ON "social_notifications" ("user_id", "read_at");
