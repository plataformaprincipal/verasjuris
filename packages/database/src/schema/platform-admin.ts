/**
 * Equipe interna da plataforma VerasJuris (não confundir com membros de organizações-cliente).
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const platformStaffStatusEnum = pgEnum("platform_staff_status", [
  "invited",
  "active",
  "suspended",
  "revoked",
]);

export const platformInviteStatusEnum = pgEnum("platform_invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const platformStaff = pgTable(
  "platform_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SUPER_ADMIN | ADMIN_OPERACIONAL | … */
    roleKey: text("role_key").notNull(),
    status: platformStaffStatusEnum("status").notNull().default("invited"),
    mfaRequired: boolean("mfa_required").notNull().default(true),
    forcePasswordChange: boolean("force_password_change").notNull().default(false),
    activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("platform_staff_user_role_unique").on(table.userId, table.roleKey),
    index("platform_staff_user_idx").on(table.userId),
    index("platform_staff_status_idx").on(table.status),
    index("platform_staff_role_idx").on(table.roleKey),
  ],
);

export const platformAdminInvites = pgTable(
  "platform_admin_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    roleKey: text("role_key").notNull(),
    /** Hash do token de uso único — nunca o token em claro. */
    tokenHash: text("token_hash").notNull(),
    status: platformInviteStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    acceptedUserId: uuid("accepted_user_id").references(() => users.id, { onDelete: "set null" }),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("platform_admin_invites_token_hash_unique").on(table.tokenHash),
    index("platform_admin_invites_email_idx").on(table.email),
    index("platform_admin_invites_status_idx").on(table.status),
  ],
);

export const platformStaffRelations = relations(platformStaff, ({ one }) => ({
  user: one(users, { fields: [platformStaff.userId], references: [users.id] }),
}));

export const platformAdminInvitesRelations = relations(platformAdminInvites, ({ one }) => ({
  acceptedUser: one(users, {
    fields: [platformAdminInvites.acceptedUserId],
    references: [users.id],
  }),
}));
