/**
 * INPI: monitoramento de processos de marca pela RPI e checklists de benefícios.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
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
import { administrativeProcesses } from "./administrative.js";
import { organizationMembers, organizations } from "./identity.js";
import { legalMatters } from "./matters.js";
import { deadlines, tasks } from "./productivity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const inpiDispatchStatusEnum = pgEnum("inpi_dispatch_status", [
  "new",
  "triaged",
  "dismissed",
]);

/** Processos de marca acompanhados pela organização. */
export const inpiMonitoredProcesses = pgTable(
  "inpi_monitored_processes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    processNumber: text("process_number").notNull(),
    kind: text("kind").notNull().default("marca"),
    label: text("label"),
    holderName: text("holder_name"),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    active: boolean("active").notNull().default(true),
    lastEdition: integer("last_edition"),
    lastDispatchName: text("last_dispatch_name"),
    lastDispatchOn: date("last_dispatch_on", { mode: "string" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inpi_monitored_org_number_unique").on(table.organizationId, table.processNumber),
    index("inpi_monitored_active_idx").on(table.active),
  ],
);

/** Procurador monitorado: descobre processos novos do escritório na RPI. */
export const inpiAttorneyMonitors = pgTable(
  "inpi_attorney_monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    attorneyName: text("attorney_name").notNull(),
    active: boolean("active").notNull().default(true),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inpi_attorney_org_name_unique").on(table.organizationId, table.attorneyName),
  ],
);

/** Despachos publicados na RPI para processos de interesse. */
export const inpiDispatches = pgTable(
  "inpi_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    monitoredProcessId: uuid("monitored_process_id").references(() => inpiMonitoredProcesses.id, {
      onDelete: "set null",
    }),
    edition: integer("edition").notNull(),
    publishedOn: date("published_on", { mode: "string" }).notNull(),
    processNumber: text("process_number").notNull(),
    markName: text("mark_name"),
    holders: jsonb("holders").notNull().default([]),
    attorney: text("attorney"),
    niceClasses: jsonb("nice_classes").notNull().default([]),
    code: text("code"),
    name: text("name").notNull(),
    complement: text("complement"),
    dedupeKey: text("dedupe_key").notNull(),
    procedureKey: text("procedure_key"),
    suggestedDays: integer("suggested_days"),
    suggestedDueOn: date("suggested_due_on", { mode: "string" }),
    suggestionBasis: text("suggestion_basis"),
    status: inpiDispatchStatusEnum("status").notNull().default("new"),
    deadlineId: uuid("deadline_id").references(() => deadlines.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    triagedByMembershipId: uuid("triaged_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    triagedAt: timestamp("triaged_at", { withTimezone: true, mode: "date" }),
    dismissedReason: text("dismissed_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inpi_dispatches_org_dedupe_unique").on(table.organizationId, table.dedupeKey),
    index("inpi_dispatches_org_status_idx").on(table.organizationId, table.status),
    index("inpi_dispatches_org_published_idx").on(table.organizationId, table.publishedOn),
  ],
);

/** Edições da RPI já processadas (global, uma vez por edição). */
export const inpiRpiRuns = pgTable("inpi_rpi_runs", {
  edition: integer("edition").primaryKey(),
  publishedOn: date("published_on", { mode: "string" }),
  status: text("status").notNull(),
  message: text("message"),
  matched: integer("matched").notNull().default(0),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/** Checklist de requisitos de benefício com pontuação responsável. */
export const benefitChecklists = pgTable(
  "benefit_checklists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    benefitKey: text("benefit_key").notNull(),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    clientLabel: text("client_label"),
    /** { [requisito]: { status, note, documentId, updatedAt, updatedByMembershipId } } */
    items: jsonb("items").notNull().default({}),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("benefit_checklists_org_idx").on(table.organizationId),
    index("benefit_checklists_matter_idx").on(table.legalMatterId),
    index("benefit_checklists_admin_process_idx").on(table.administrativeProcessId),
  ],
);

export const inpiMonitoredProcessesRelations = relations(inpiMonitoredProcesses, ({ many }) => ({
  dispatches: many(inpiDispatches),
}));

export const inpiDispatchesRelations = relations(inpiDispatches, ({ one }) => ({
  monitoredProcess: one(inpiMonitoredProcesses, {
    fields: [inpiDispatches.monitoredProcessId],
    references: [inpiMonitoredProcesses.id],
  }),
}));
