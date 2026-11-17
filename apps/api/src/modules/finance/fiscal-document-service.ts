import type { FiscalDocumentProvider } from "@verasjuris/ai";
import { NotConfiguredFiscalDocumentProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyFinanceRead, policyPaymentIntent, type SessionAccount } from "@verasjuris/auth";
import { fiscalDocuments, invoices, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import type { RequestFiscalDocumentInput } from "@verasjuris/validation";
import { and, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

function serialize(row: typeof fiscalDocuments.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    invoiceId: row.invoiceId,
    kind: row.kind,
    providerKey: row.providerKey,
    status: row.status,
    externalDocumentId: row.externalDocumentId,
    number: row.number,
    accessKey: row.accessKey,
    pdfUrl: row.pdfUrl,
    xmlUrl: row.xmlUrl,
    amountCents: row.amountCents,
    currency: row.currency,
    detail: row.detail,
    idempotencyKey: row.idempotencyKey,
    metadata: row.metadataJson,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    authorized: false as const,
    homologation: "NOT_HOMOLOGATED" as const,
  };
}

/**
 * Fase 8 — solicita emissão fiscal sem inventar autorização.
 * Provider default: not_configured → status not_configured | pending_homologation.
 */
export class FiscalDocumentService {
  private readonly provider: FiscalDocumentProvider;

  constructor(
    private readonly db: AppDatabase,
    provider?: FiscalDocumentProvider | null,
  ) {
    this.provider = provider ?? new NotConfiguredFiscalDocumentProvider();
  }

  async list(
    account: SessionAccount,
    organizationId: string,
    query: { status?: string; kind?: string; limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const filters = [eq(fiscalDocuments.organizationId, organizationId)];
    if (query.status) filters.push(eq(fiscalDocuments.status, query.status));
    if (query.kind) filters.push(eq(fiscalDocuments.kind, query.kind));
    const rows = await this.db.query.fiscalDocuments.findMany({
      where: and(...filters),
      orderBy: [desc(fiscalDocuments.createdAt)],
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: rows.map(serialize),
      provider: this.provider.id,
      emissionReady: false as const,
      homologation: "NOT_HOMOLOGATED" as const,
    };
  }

  async get(account: SessionAccount, organizationId: string, documentId: string) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const row = await this.db.query.fiscalDocuments.findFirst({
      where: and(
        eq(fiscalDocuments.id, documentId),
        eq(fiscalDocuments.organizationId, organizationId),
      ),
    });
    if (!row) throw new AppError("NOT_FOUND", "Documento fiscal não encontrado.");
    return {
      document: serialize(row),
      emissionReady: false as const,
      homologation: "NOT_HOMOLOGATED" as const,
    };
  }

  async requestIssue(
    account: SessionAccount,
    organizationId: string,
    input: RequestFiscalDocumentInput,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyPaymentIntent(m, "finance.payment.read"));

    const existing = await this.db.query.fiscalDocuments.findFirst({
      where: and(
        eq(fiscalDocuments.organizationId, organizationId),
        eq(fiscalDocuments.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) {
      return {
        document: serialize(existing),
        alreadyExists: true as const,
        emissionReady: false as const,
        homologation: "NOT_HOMOLOGATED" as const,
      };
    }

    if (input.invoiceId) {
      const invoice = await this.db.query.invoices.findFirst({
        where: and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, organizationId)),
      });
      if (!invoice) throw new AppError("NOT_FOUND", "Fatura vinculada não encontrada.");
    }

    const issued = await this.provider.issue({
      kind: input.kind,
      organizationId,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      currency: input.currency,
      description: input.description,
      customerTaxId: input.customerTaxId,
      customerName: input.customerName,
      serviceCode: input.serviceCode,
      idempotencyKey: input.idempotencyKey,
      metadata: { source: "verasjuris_fiscal_service" },
    });

    // Nunca promover a authorized sem provedor real + evidência.
    const status =
      issued.status === "authorized" && this.provider.id === "not_configured"
        ? "not_configured"
        : issued.status === "not_configured"
          ? "pending_homologation"
          : issued.status;

    const [row] = await this.db
      .insert(fiscalDocuments)
      .values({
        organizationId,
        invoiceId: input.invoiceId ?? null,
        requestedByUserId: account.user.id,
        kind: input.kind,
        providerKey: issued.providerKey || this.provider.id,
        status,
        externalDocumentId: issued.externalDocumentId,
        number: this.provider.id === "not_configured" ? null : issued.number,
        accessKey: this.provider.id === "not_configured" ? null : issued.accessKey,
        pdfUrl: this.provider.id === "not_configured" ? null : (issued.pdfUrl ?? null),
        xmlUrl: this.provider.id === "not_configured" ? null : (issued.xmlUrl ?? null),
        amountCents: input.amountCents,
        currency: input.currency,
        detail:
          issued.detail ??
          "Provedor fiscal não homologado — registro criado sem autorização inventada.",
        idempotencyKey: input.idempotencyKey,
        metadataJson: {
          providerStatus: issued.status,
          homologation: "NOT_HOMOLOGATED",
          description: input.description ?? null,
        },
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.fiscal_document_requested",
      resourceType: "fiscal_document",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: row!.status, providerKey: row!.providerKey, kind: row!.kind },
    });

    return {
      document: serialize(row!),
      alreadyExists: false as const,
      emissionReady: false as const,
      homologation: "NOT_HOMOLOGATED" as const,
    };
  }

  async providerHealth() {
    const health = await this.provider.healthCheck();
    return {
      ...health,
      providerId: this.provider.id,
      emissionReady: false as const,
      homologation: "NOT_HOMOLOGATED" as const,
    };
  }
}
