/**
 * Captura processual: monitores por OAB (DJEN) e comunicações capturadas.
 *
 * Fluxo (Documento Mestre, p. 16): capturar e deduplicar → relacionar ao processo
 * e classificar → resumir e sugerir providência → prazo provisório pendente de
 * validação → tarefa. Protocolo nunca é automático.
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
import { organizationMembers, organizations } from "./identity.js";
import { judicialProcesses } from "./judicial.js";
import { deadlines, tasks } from "./productivity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const courtCommunicationStatusEnum = pgEnum("court_communication_status", [
  "new",
  "linked",
  "triaged",
  "dismissed",
]);

export const courtMonitorRunStatusEnum = pgEnum("court_monitor_run_status", [
  "never_run",
  "ok",
  "partial",
  "error",
]);

export const courtCommunicationMonitors = pgTable(
  "court_communication_monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("djen"),
    /** Advogado monitorado (membro da organização), quando houver. */
    membershipId: uuid("membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    lawyerName: text("lawyer_name").notNull(),
    oabNumber: text("oab_number").notNull(),
    oabUf: text("oab_uf").notNull(),
    active: boolean("active").notNull().default(true),
    /** Último dia (AAAA-MM-DD) já varrido por completo. */
    capturedThrough: date("captured_through", { mode: "string" }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "date" }),
    lastRunStatus: courtMonitorRunStatusEnum("last_run_status").notNull().default("never_run"),
    lastRunMessage: text("last_run_message"),
    lastRunFound: integer("last_run_found").notNull().default(0),
    lastRunCreated: integer("last_run_created").notNull().default(0),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("court_comm_monitors_org_oab_unique").on(
      table.organizationId,
      table.provider,
      table.oabNumber,
      table.oabUf,
    ),
    index("court_comm_monitors_active_idx").on(table.active),
  ],
);

export const courtCommunications = pgTable(
  "court_communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    monitorId: uuid("monitor_id").references(() => courtCommunicationMonitors.id, {
      onDelete: "set null",
    }),
    provider: text("provider").notNull().default("djen"),
    externalId: text("external_id").notNull(),
    externalHash: text("external_hash"),
    tribunal: text("tribunal"),
    communicationType: text("communication_type"),
    documentType: text("document_type"),
    courtBody: text("court_body"),
    className: text("class_name"),
    processNumber: text("process_number"),
    processNumberMasked: text("process_number_masked"),
    medium: text("medium"),
    content: text("content").notNull(),
    link: text("link"),
    recipients: jsonb("recipients").notNull().default([]),
    lawyers: jsonb("lawyers").notNull().default([]),
    availableOn: date("available_on", { mode: "string" }).notNull(),
    publishedOn: date("published_on", { mode: "string" }),
    termStartsOn: date("term_starts_on", { mode: "string" }),
    status: courtCommunicationStatusEnum("status").notNull().default("new"),
    /** Classificação determinística (regras), nunca decisão final. */
    category: text("category"),
    suggestedAction: text("suggested_action"),
    suggestedDays: integer("suggested_days"),
    suggestedRuleType: text("suggested_rule_type"),
    suggestionBasis: text("suggestion_basis"),
    aiSummary: text("ai_summary"),
    aiSummaryModel: text("ai_summary_model"),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    deadlineId: uuid("deadline_id").references(() => deadlines.id, { onDelete: "set null" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    triagedByMembershipId: uuid("triaged_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    triagedAt: timestamp("triaged_at", { withTimezone: true, mode: "date" }),
    dismissedReason: text("dismissed_reason"),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("court_communications_org_external_unique").on(
      table.organizationId,
      table.provider,
      table.externalId,
    ),
    index("court_communications_org_status_idx").on(table.organizationId, table.status),
    index("court_communications_org_available_idx").on(table.organizationId, table.availableOn),
    index("court_communications_process_number_idx").on(table.organizationId, table.processNumber),
    index("court_communications_judicial_process_idx").on(table.judicialProcessId),
  ],
);

export const courtCommunicationMonitorsRelations = relations(
  courtCommunicationMonitors,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [courtCommunicationMonitors.organizationId],
      references: [organizations.id],
    }),
    communications: many(courtCommunications),
  }),
);

export const courtCommunicationsRelations = relations(courtCommunications, ({ one }) => ({
  organization: one(organizations, {
    fields: [courtCommunications.organizationId],
    references: [organizations.id],
  }),
  monitor: one(courtCommunicationMonitors, {
    fields: [courtCommunications.monitorId],
    references: [courtCommunicationMonitors.id],
  }),
  judicialProcess: one(judicialProcesses, {
    fields: [courtCommunications.judicialProcessId],
    references: [judicialProcesses.id],
  }),
  deadline: one(deadlines, {
    fields: [courtCommunications.deadlineId],
    references: [deadlines.id],
  }),
  task: one(tasks, {
    fields: [courtCommunications.taskId],
    references: [tasks.id],
  }),
}));
