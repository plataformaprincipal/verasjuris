import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/**
 * Despachos de e-mail transacional (identidade + produto).
 * Não armazena corpo completo nem tokens; to_email_hash para privacidade.
 */
export const emailDispatches = pgTable(
  "email_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    toEmailHash: text("to_email_hash").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    /** queued | sent_to_provider | delivered | bounced | complained | failed */
    status: text("status").notNull().default("queued"),
    providerKey: text("provider_key"),
    providerMessageId: text("provider_message_id"),
    errorCode: text("error_code"),
    subject: text("subject").notNull(),
    /** transactional | security | operational | marketing */
    category: text("category").notNull().default("transactional"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("email_dispatches_idempotency_unique").on(table.idempotencyKey),
    index("email_dispatches_status_idx").on(table.status),
    index("email_dispatches_provider_message_idx").on(table.providerMessageId),
    index("email_dispatches_org_idx").on(table.organizationId),
    index("email_dispatches_user_idx").on(table.recipientUserId),
  ],
);

export const emailProviderEvents = pgTable(
  "email_provider_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerKey: text("provider_key").notNull().default("resend"),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    providerMessageId: text("provider_message_id"),
    payloadHash: text("payload_hash").notNull(),
    /** received | processed | failed | ignored */
    status: text("status").notNull().default("received"),
    errorCode: text("error_code"),
    dispatchId: uuid("dispatch_id").references(() => emailDispatches.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_provider_events_provider_event_unique").on(
      table.providerKey,
      table.externalEventId,
    ),
    index("email_provider_events_message_idx").on(table.providerMessageId),
    index("email_provider_events_status_idx").on(table.status),
  ],
);

export const emailDispatchesRelations = relations(emailDispatches, ({ many }) => ({
  events: many(emailProviderEvents),
}));

export const emailProviderEventsRelations = relations(emailProviderEvents, ({ one }) => ({
  dispatch: one(emailDispatches, {
    fields: [emailProviderEvents.dispatchId],
    references: [emailDispatches.id],
  }),
}));
