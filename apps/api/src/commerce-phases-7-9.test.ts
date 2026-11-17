import { fiscalDocuments, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { buildPaymentsHomologationChecklist } from "./modules/platform-admin/homologation-checklist.js";
import { call } from "./test-helpers.js";

describe("Commerce phases 7–9", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;

  const root = () => `/v1/organizations/${s.orgA}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    s = await bootstrapEtapa6(app, email, "commerce79");
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("purchase-status permanece NOT_HOMOLOGATED com resumo do checklist", async () => {
    const res = await call(app, "GET", "/v1/commerce/catalog/purchase-status");
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      purchaseReady: boolean;
      status: string;
      phases: Record<string, string>;
      homologationChecklistSummary: { readyForLive: boolean; blockingCount: number };
    }>();
    expect(body.purchaseReady).toBe(false);
    expect(body.status).toBe("NOT_HOMOLOGATED");
    expect(body.phases.offerSurface).toBe("implemented");
    expect(body.phases.fiscalDocuments).toBe("not_configured_records");
    expect(body.homologationChecklistSummary.readyForLive).toBe(false);
    expect(body.homologationChecklistSummary.blockingCount).toBeGreaterThan(0);
  });

  it("solicita NF sem inventar número/autorização", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/fiscal-documents`,
      {
        kind: "nfse",
        amountCents: 9900,
        currency: "BRL",
        description: "Teste fase 8",
        idempotencyKey: `fiscal_test_${Date.now()}`,
      },
      s.ownerA,
    );
    expect([200, 201]).toContain(res.statusCode);
    const body = res.json<{
      document: {
        status: string;
        number: string | null;
        accessKey: string | null;
        providerKey: string;
        authorized: boolean;
      };
      emissionReady: boolean;
      homologation: string;
    }>();
    expect(body.emissionReady).toBe(false);
    expect(body.homologation).toBe("NOT_HOMOLOGATED");
    expect(body.document.authorized).toBe(false);
    expect(body.document.number).toBeNull();
    expect(body.document.accessKey).toBeNull();
    expect(body.document.providerKey).toBe("not_configured");
    expect(["not_configured", "pending_homologation"]).toContain(body.document.status);

    const rows = await database.db.query.fiscalDocuments.findMany({
      where: eq(fiscalDocuments.organizationId, s.orgA),
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.number == null)).toBe(true);
  });

  it("checklist sem aprovação permanece bloqueado; com aprovação + probes PASS libera", () => {
    const blocked = buildPaymentsHomologationChecklist({
      paymentProviderMode: "asaas",
      asaasEnvironment: "sandbox",
      asaasApiKeyPresent: true,
      asaasWebhookTokenPresent: true,
      paymentsLive: false,
      publicCheckout: false,
      paymentHealthStatus: "ok",
      isProduction: false,
      probes: {
        webhookEventsPersisted: "PASS",
        paymentIntentsIdempotency: "PASS",
        refundPathExists: "PASS",
        cancelPathExists: "PASS",
        reconciliationModulePresent: "PASS",
      },
    });
    expect(blocked.readyForLive).toBe(false);
    expect(blocked.purchaseReady).toBe(false);
    expect(blocked.blocking).toContain("admin_approval");

    const unlocked = buildPaymentsHomologationChecklist({
      paymentProviderMode: "asaas",
      asaasEnvironment: "sandbox",
      asaasApiKeyPresent: true,
      asaasWebhookTokenPresent: true,
      paymentsLive: true,
      publicCheckout: false,
      paymentHealthStatus: "ok",
      isProduction: false,
      probes: {
        webhookEventsPersisted: "PASS",
        paymentIntentsIdempotency: "PASS",
        refundPathExists: "PASS",
        cancelPathExists: "PASS",
        reconciliationModulePresent: "PASS",
      },
      activeApproval: {
        id: "00000000-0000-4000-8000-000000000001",
        decision: "approved",
        approverUserId: "00000000-0000-4000-8000-000000000002",
        validFrom: new Date().toISOString(),
        validUntil: null,
        reason: "Homologação sintética de teste",
      },
    });
    expect(unlocked.readyForLive).toBe(true);
    expect(unlocked.purchaseReady).toBe(true);
    expect(unlocked.status).toBe("READY_FOR_LIVE");

    const liveWithoutApproval = buildPaymentsHomologationChecklist({
      paymentProviderMode: "asaas",
      asaasEnvironment: "sandbox",
      asaasApiKeyPresent: true,
      asaasWebhookTokenPresent: true,
      paymentsLive: true,
      publicCheckout: true,
      paymentHealthStatus: "ok",
      isProduction: true,
      probes: {
        webhookEventsPersisted: "PASS",
        paymentIntentsIdempotency: "PASS",
        refundPathExists: "PASS",
        cancelPathExists: "PASS",
        reconciliationModulePresent: "PASS",
      },
    });
    expect(liveWithoutApproval.readyForLive).toBe(false);
    expect(liveWithoutApproval.paymentsLiveInsufficientWithoutApproval).toBe(true);
  });
});
