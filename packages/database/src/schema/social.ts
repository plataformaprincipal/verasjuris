/**
 * Rede social jurídica — posts, grafo social e moderação.
 * Distinto de social_security_* (previdenciário).
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, profiles, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const socialPostVisibilityEnum = pgEnum("social_post_visibility", [
  "public",
  "connections",
  "private",
  "draft",
]);

export const socialPostStatusEnum = pgEnum("social_post_status", [
  "published",
  "draft",
  "archived",
  "hidden",
  "removed",
]);

export const socialConnectionStatusEnum = pgEnum("social_connection_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
]);

export const socialReportStatusEnum = pgEnum("social_report_status", [
  "open",
  "under_review",
  "resolved",
  "dismissed",
]);

export const socialProfiles = pgTable(
  "social_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    bio: text("bio"),
    headline: text("headline"),
    practiceAreas: text("practice_areas"),
    locationLabel: text("location_label"),
    coverImageUrl: text("cover_image_url"),
    avatarUrl: text("avatar_url"),
    profileVisibility: text("profile_visibility").notNull().default("public"),
    whoCanFollow: text("who_can_follow").notNull().default("everyone"),
    whoCanMessage: text("who_can_message").notNull().default("connections"),
    whoCanConnect: text("who_can_connect").notNull().default("everyone"),
    showOrganization: boolean("show_organization").notNull().default(true),
    marketplaceOptIn: boolean("marketplace_opt_in").notNull().default(false),
    ...timestamps,
  },
  (table) => [index("social_profiles_visibility_idx").on(table.profileVisibility)],
);

export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    visibility: socialPostVisibilityEnum("visibility").notNull().default("public"),
    status: socialPostStatusEnum("status").notNull().default("published"),
    legalCategory: text("legal_category"),
    hashtags: text("hashtags"),
    linkUrl: text("link_url"),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    repostCount: integer("repost_count").notNull().default(0),
    bookmarkCount: integer("bookmark_count").notNull().default(0),
    score24h: bigint("score_24h", { mode: "number" }).notNull().default(0),
    score7d: bigint("score_7d", { mode: "number" }).notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("social_posts_author_idx").on(table.authorUserId),
    index("social_posts_status_visibility_idx").on(table.status, table.visibility),
    index("social_posts_published_idx").on(table.publishedAt),
    index("social_posts_score7d_idx").on(table.score7d),
  ],
);

export const socialPostLikes = pgTable(
  "social_post_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("social_post_likes_post_user_unique").on(table.postId, table.userId),
    index("social_post_likes_user_idx").on(table.userId),
  ],
);

export const socialComments = pgTable(
  "social_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id"),
    body: text("body").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("social_comments_post_idx").on(table.postId),
    index("social_comments_author_idx").on(table.authorUserId),
    index("social_comments_parent_idx").on(table.parentCommentId),
  ],
);

export const socialReposts = pgTable(
  "social_reposts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentary: text("commentary"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("social_reposts_post_user_unique").on(table.postId, table.userId),
    index("social_reposts_user_idx").on(table.userId),
  ],
);

export const socialBookmarks = pgTable(
  "social_bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("social_bookmarks_post_user_unique").on(table.postId, table.userId),
    index("social_bookmarks_user_idx").on(table.userId),
  ],
);

export const socialFollows = pgTable(
  "social_follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerUserId: uuid("follower_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingUserId: uuid("following_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("social_follows_pair_unique").on(table.followerUserId, table.followingUserId),
    index("social_follows_following_idx").on(table.followingUserId),
  ],
);

export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeUserId: uuid("addressee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: socialConnectionStatusEnum("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("social_connections_pair_unique").on(table.requesterUserId, table.addresseeUserId),
    index("social_connections_addressee_status_idx").on(table.addresseeUserId, table.status),
  ],
);

export const socialHides = pgTable(
  "social_hides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("social_hides_user_post_unique").on(table.userId, table.postId)],
);

export const socialBlocks = pgTable(
  "social_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("social_blocks_pair_unique").on(table.blockerUserId, table.blockedUserId),
  ],
);

export const socialReports = pgTable(
  "social_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => socialPosts.id, { onDelete: "set null" }),
    commentId: uuid("comment_id").references(() => socialComments.id, { onDelete: "set null" }),
    reportedUserId: uuid("reported_user_id").references(() => users.id, { onDelete: "set null" }),
    reasonCode: text("reason_code").notNull(),
    description: text("description"),
    status: socialReportStatusEnum("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("social_reports_status_idx").on(table.status),
    index("social_reports_post_idx").on(table.postId),
  ],
);

export const socialNotifications = pgTable(
  "social_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    postId: uuid("post_id").references(() => socialPosts.id, { onDelete: "set null" }),
    commentId: uuid("comment_id").references(() => socialComments.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("social_notifications_user_idx").on(table.userId, table.createdAt),
    index("social_notifications_unread_idx").on(table.userId, table.readAt),
  ],
);

export const socialProfilesRelations = relations(socialProfiles, ({ one }) => ({
  user: one(users, { fields: [socialProfiles.userId], references: [users.id] }),
  profile: one(profiles, { fields: [socialProfiles.userId], references: [profiles.userId] }),
}));

export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
  author: one(users, { fields: [socialPosts.authorUserId], references: [users.id] }),
  likes: many(socialPostLikes),
  comments: many(socialComments),
}));

export const socialPostLikesRelations = relations(socialPostLikes, ({ one }) => ({
  post: one(socialPosts, { fields: [socialPostLikes.postId], references: [socialPosts.id] }),
  user: one(users, { fields: [socialPostLikes.userId], references: [users.id] }),
}));

export const socialCommentsRelations = relations(socialComments, ({ one }) => ({
  post: one(socialPosts, { fields: [socialComments.postId], references: [socialPosts.id] }),
  author: one(users, { fields: [socialComments.authorUserId], references: [users.id] }),
}));
