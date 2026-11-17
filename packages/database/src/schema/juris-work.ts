/**
 * JurisOne Work — agente de execução com aprovação humana e controle de custo.
 * Não executa ações externas irreversíveis sem autorização explícita.
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
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
import { organizationMembers, organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const jurisWorkTaskStatusEnum = pgEnum("juris_work_task_status", [
  "draft",
  "planned",
  "awaiting_approval",
  "running",
  "completed",
  "failed",
  "cancelled",
  "budget_exceeded",
]);

export const jurisWorkStepStatusEnum = pgEnum("juris_work_step_status", [
  "pending",
  "awaiting_approval",
  "running",
  "completed",
  "failed",
  "skipped",
  "cancelled",
]);

export const jurisWorkTasks = pgTable(
  "juris_work_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),
    title: text("title").notNull(),
    objective: text("objective").notNull(),
    status: jurisWorkTaskStatusEnum("status").notNull().default("draft"),
    planJson: jsonb("plan_json").$type<Record<string, unknown>>(),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    budgetMicros: bigint("budget_micros", { mode: "number" }),
    spentMicros: bigint("spent_micros", { mode: "number" }).notNull().default(0),
    maxSteps: integer("max_steps").notNull().default(12),
    requiresHumanApproval: boolean("requires_human_approval").notNull().default(true),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (table) => [
    index("juris_work_tasks_org_status_idx").on(table.organizationId, table.status),
    index("juris_work_tasks_created_by_idx").on(table.createdByUserId),
  ],
);

export const jurisWorkSteps = pgTable(
  "juris_work_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => jurisWorkTasks.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepIndex: integer("step_index").notNull(),
    toolName: text("tool_name").notNull(),
    title: text("title").notNull(),
    status: jurisWorkStepStatusEnum("status").notNull().default("pending"),
    requiresApproval: boolean("requires_approval").notNull().default(false),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    approvedAt: timestamp("approved_at", { withTimezone: true, mode: "date" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("juris_work_steps_task_index_unique").on(table.taskId, table.stepIndex),
    index("juris_work_steps_org_idx").on(table.organizationId),
  ],
);

export const jurisWorkTasksRelations = relations(jurisWorkTasks, ({ many }) => ({
  steps: many(jurisWorkSteps),
}));

export const jurisWorkStepsRelations = relations(jurisWorkSteps, ({ one }) => ({
  task: one(jurisWorkTasks, {
    fields: [jurisWorkSteps.taskId],
    references: [jurisWorkTasks.id],
  }),
}));
