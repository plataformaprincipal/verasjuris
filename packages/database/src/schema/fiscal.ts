/**
 * Documentos fiscais (NFS-e / NF-e) — registro operacional.
 * Emissão real exige provedor configurado; default never inventa número/autorização.
 */
import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { invoices } from "./finance.js";
import { organizations, users } from "./identity.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const fiscalDocuments = pgTable(
  "fiscal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(),
    providerKey: text("provider_key").notNull().default("not_configured"),
    status: text("status").notNull().default("not_configured"),
    externalDocumentId: text("external_document_id"),
    number: text("number"),
    accessKey: text("access_key"),
    pdfUrl: text("pdf_url"),
    xmlUrl: text("xml_url"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    detail: text("detail"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("fiscal_documents_org_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("fiscal_documents_org_status_idx").on(table.organizationId, table.status),
    index("fiscal_documents_invoice_idx").on(table.invoiceId),
  ],
);

export const fiscalDocumentsRelations = relations(fiscalDocuments, ({ one }) => ({
  organization: one(organizations, {
    fields: [fiscalDocuments.organizationId],
    references: [organizations.id],
  }),
  invoice: one(invoices, {
    fields: [fiscalDocuments.invoiceId],
    references: [invoices.id],
  }),
}));
