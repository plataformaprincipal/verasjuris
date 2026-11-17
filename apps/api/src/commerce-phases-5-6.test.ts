import {
  aiCreditTransactions,
  aiCreditWallets,
  organizationCommercialGrants,
  seedReferenceData,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import {
  AI_MODULE_SKUS,
  resolveAiModuleForFeature,
  splitServiceMilestoneCents,
} from "@verasjuris/validation";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { assertAndConsumeAiCredits } from "./modules/commerce/ai-credit-gate.js";
import { syncCommercialCatalog } from "./modules/commerce/catalog-sync.js";
import { call } from "./test-helpers.js";

describe("Commerce phases 5–6", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let ownerUserId: string;

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
    s = await bootstrapEtapa6(app, email, "commerce56");
    ownerUserId = (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    await syncCommercialCatalog(database.db);
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("mapeia 24 módulos IA e features do gateway", () => {
    expect(AI_MODULE_SKUS).toHaveLength(24);
    expect(resolveAiModuleForFeature("legal_draft.petition")?.sku).toBe("AI_PECAS");
    expect(resolveAiModuleForFeature("juris_one.chat")?.sku).toBe("AI_ASSISTENTE");
    expect(resolveAiModuleForFeature("contract.review")?.sku).toBe("AI_CONTRATOS");
  });

  it("consome créditos da carteira com idempotência", async () => {
    process.env.FEATURE_AI_MODULE_GATES = "0";
    process.env.FEATURE_AI_CREDIT_BILLING = "1";
    process.env.FEATURE_AI_CREDIT_UNMAPPED = "1";

    let w = await database.db.query.aiCreditWallets.findFirst({
      where: eq(aiCreditWallets.organizationId, s.orgA),
    });
    if (!w) {
      const [created] = await database.db
        .insert(aiCreditWallets)
        .values({
          organizationId: s.orgA,
          userId: null,
          currencyLabel: "credit",
          balanceCredits: 50,
        })
        .returning();
      w = created!;
    } else {
      await database.db
        .update(aiCreditWallets)
        .set({ balanceCredits: 50, updatedAt: new Date() })
        .where(eq(aiCreditWallets.id, w.id));
    }

    await database.db.insert(organizationCommercialGrants).values({
      organizationId: s.orgA,
      skuCode: "AI_PECAS",
      featureKey: "module.AI_PECAS",
      limitType: "boolean",
      limitValue: 1,
      status: "active",
      active: true,
    });

    const key = `test_ai_consume_${Date.now()}`;
    const first = await assertAndConsumeAiCredits(database.db, {
      organizationId: s.orgA,
      feature: "legal_draft.petition",
      idempotencyKey: key,
      actorUserId: ownerUserId,
    });
    expect(first.creditsCharged).toBe(3);
    expect(first.source).toBe("wallet");

    const second = await assertAndConsumeAiCredits(database.db, {
      organizationId: s.orgA,
      feature: "legal_draft.petition",
      idempotencyKey: key,
      actorUserId: ownerUserId,
    });
    expect(second.transactionId).toBe(first.transactionId);

    const txs = await database.db.query.aiCreditTransactions.findMany({
      where: and(
        eq(aiCreditTransactions.walletId, w!.id),
        eq(aiCreditTransactions.idempotencyKey, key),
      ),
    });
    expect(txs).toHaveLength(1);
  });

  it("bloqueia módulo sem grant quando FEATURE_AI_MODULE_GATES=1", async () => {
    process.env.FEATURE_AI_MODULE_GATES = "1";
    process.env.FEATURE_AI_CREDIT_BILLING = "0";
    await expect(
      assertAndConsumeAiCredits(database.db, {
        organizationId: s.orgA,
        feature: "auction.risk_extraction",
        idempotencyKey: `gate_${Date.now()}`,
      }),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
    process.env.FEATURE_AI_MODULE_GATES = "0";
    delete process.env.FEATURE_AI_CREDIT_BILLING;
  });

  it("cria proposta SRV com marcos 30/70 e aceita", async () => {
    expect(splitServiceMilestoneCents(10_000)).toEqual({
      depositCents: 3000,
      deliveryCents: 7000,
    });

    const created = await call(
      app,
      "POST",
      `${root()}/commerce/services/proposals`,
      { sku: "SRV_IMPL_ESSENCIAL", notes: "Kickoff fase 6" },
      s.ownerA,
    );
    expect(created.statusCode).toBe(200);
    const body = created.json<{
      project: { id: string; status: string; totalCents: number; sku: string };
      milestones: Array<{ kind: string; amountCents: number; status: string }>;
      purchaseReady: boolean;
    }>();
    expect(body.purchaseReady).toBe(false);
    expect(body.project.sku).toBe("SRV_IMPL_ESSENCIAL");
    expect(body.project.totalCents).toBe(49000);
    expect(body.milestones).toHaveLength(2);
    expect(body.milestones.find((m) => m.kind === "deposit_30")?.amountCents).toBe(14700);
    expect(body.milestones.find((m) => m.kind === "delivery_70")?.amountCents).toBe(34300);

    const accepted = await call(
      app,
      "POST",
      `${root()}/commerce/services/${body.project.id}/accept`,
      { accept: true },
      s.ownerA,
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<{ project: { status: string } }>().project.status).toBe("accepted");
  });

  it("exige proposedAmountCents para SRV sob proposta", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/commerce/services/proposals`,
      { sku: "SRV_MIG_GRANDE" },
      s.ownerA,
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
