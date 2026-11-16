/**
 * JurisOne Work — ledger de créditos de execução (não financeiro).
 * Custos em micros continuam em ai_budgets / ai_usage; este ledger conta
 * créditos de uso do Work (grant/reserve/consume/release).
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";
import { jurisWorkTasks } from "./juris-work.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const jurisWorkCreditEventTypeEnum = pgEnum("juris_work_credit_event_type", [
  "granted",
  "reserved",
  "consumed",
  "released",
  "adjusted",
]);

export const jurisWorkCreditDirectionEnum = pgEnum("juris_work_credit_direction", [
  "credit",
  "debit",
]);

/** Saldo org-scoped por usuário (Work é sempre no contexto da organização). */
export const jurisWorkCreditBalances = pgTable(
  "juris_work_credit_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    lifetimeGranted: integer("lifetime_granted").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("juris_work_credit_balances_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    index("juris_work_credit_balances_user_idx").on(table.userId),
  ],
);

/**
 * Eventos imutáveis-ish do ledger de créditos Work.
 * quantity é sempre positivo; direction indica crédito ou débito.
 */
export const jurisWorkCreditLedger = pgTable(
  "juris_work_credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => jurisWorkTasks.id, { onDelete: "set null" }),
    eventType: jurisWorkCreditEventTypeEnum("event_type").notNull(),
    direction: jurisWorkCreditDirectionEnum("direction").notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("juris_work_credit_ledger_idempotency_unique").on(table.idempotencyKey),
    index("juris_work_credit_ledger_org_user_idx").on(table.organizationId, table.userId),
    index("juris_work_credit_ledger_task_idx").on(table.taskId),
    index("juris_work_credit_ledger_created_idx").on(table.createdAt),
  ],
);

export const jurisWorkCreditBalancesRelations = relations(jurisWorkCreditBalances, ({ one }) => ({
  organization: one(organizations, {
    fields: [jurisWorkCreditBalances.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [jurisWorkCreditBalances.userId],
    references: [users.id],
  }),
}));

export const jurisWorkCreditLedgerRelations = relations(jurisWorkCreditLedger, ({ one }) => ({
  organization: one(organizations, {
    fields: [jurisWorkCreditLedger.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [jurisWorkCreditLedger.userId],
    references: [users.id],
  }),
  task: one(jurisWorkTasks, {
    fields: [jurisWorkCreditLedger.taskId],
    references: [jurisWorkTasks.id],
  }),
}));
