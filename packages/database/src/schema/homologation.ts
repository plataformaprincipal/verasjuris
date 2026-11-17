/**
 * Homologação comercial auditável — evidências por SKU e aprovações de live.
 * Nunca escreve PAYMENTS_LIVE; aprovação DB é pré-requisito, não o adapter PSP.
 */
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { monetizationProducts } from "./monetization.js";
import { users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const skuHomologationEvidence = pgTable(
  "sku_homologation_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    skuCode: text("sku_code").notNull(),
    productId: uuid("product_id").references(() => monetizationProducts.id, {
      onDelete: "set null",
    }),
    checkKey: text("check_key").notNull(),
    result: text("result").notNull(),
    evidenceJson: jsonb("evidence_json").$type<Record<string, unknown>>().notNull().default({}),
    notes: text("notes"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("sku_homologation_evidence_sku_idx").on(table.skuCode),
    index("sku_homologation_evidence_check_idx").on(table.checkKey),
    uniqueIndex("sku_homologation_evidence_active_unique")
      .on(table.skuCode, table.checkKey)
      .where(sql`${table.supersededAt} is null`),
  ],
);

export const paymentsHomologationApprovals = pgTable(
  "payments_homologation_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    approverUserId: uuid("approver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    checklistSnapshot: jsonb("checklist_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    blockingAtDecision: jsonb("blocking_at_decision").$type<string[]>().notNull().default([]),
    validFrom: timestamp("valid_from", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
    supersededAt: timestamp("superseded_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("payments_homologation_approvals_decision_idx").on(table.decision),
    index("payments_homologation_approvals_approver_idx").on(table.approverUserId),
  ],
);

export const skuHomologationEvidenceRelations = relations(skuHomologationEvidence, ({ one }) => ({
  product: one(monetizationProducts, {
    fields: [skuHomologationEvidence.productId],
    references: [monetizationProducts.id],
  }),
  recordedBy: one(users, {
    fields: [skuHomologationEvidence.recordedByUserId],
    references: [users.id],
  }),
}));

export const paymentsHomologationApprovalsRelations = relations(
  paymentsHomologationApprovals,
  ({ one }) => ({
    approver: one(users, {
      fields: [paymentsHomologationApprovals.approverUserId],
      references: [users.id],
    }),
  }),
);
