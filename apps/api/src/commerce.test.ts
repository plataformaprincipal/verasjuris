import {
  commerceOrderItems,
  commerceOrders,
  seedReferenceData,
  splitRules,
} from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { COMMERCIAL_CATALOG, getCommercialSku } from "@verasjuris/validation";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { syncCommercialCatalog } from "./modules/commerce/catalog-sync.js";
import { fulfillCommerceOrderOnPayment } from "./modules/commerce/fulfillment-service.js";
import { ensureOabMarketplaceSplitRules } from "./modules/commerce/oab-split-seed.js";
import { call } from "./test-helpers.js";

describe("Commerce phases 1–4", () => {
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
    s = await bootstrapEtapa6(app, email, "commerce");
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("catálogo inclui planos e packs de crédito 2026-09", async () => {
    expect(COMMERCIAL_CATALOG.some((x) => x.sku === "PLAN_CIDADAO_PLUS")).toBe(true);
    expect(getCommercialSku("CREDITS_500")?.creditsGranted).toBe(500);

    const sync = await call(app, "POST", `${root()}/commerce/catalog/sync`, {}, s.ownerA);
    expect(sync.statusCode).toBe(200);
    const body = sync.json<{
      ok: boolean;
      purchaseReady: boolean;
      upserted: number;
      commercialVersion: string;
    }>();
    expect(body.ok).toBe(true);
    expect(body.purchaseReady).toBe(false);
    expect(body.commercialVersion).toBe("2026-09");
    expect(body.upserted).toBeGreaterThan(10);

    const catalog = await call(
      app,
      "GET",
      "/v1/commerce/catalog?publicOnly=true",
      undefined,
      s.ownerA,
    );
    expect(catalog.statusCode).toBe(200);
    const listed = catalog.json<{ items: Array<{ sku: string; purchaseReady: boolean }> }>();
    expect(listed.items.some((i) => i.sku === "PLAN_CIDADAO_PLUS")).toBe(true);
    expect(listed.items.every((i) => i.purchaseReady === false)).toBe(true);
  });

  it("carrinho rejeita SKU que exige proposta", async () => {
    await syncCommercialCatalog(database.db);
    const add = await call(
      app,
      "POST",
      `${root()}/commerce/cart/items`,
      { sku: "ADDON_CSM", quantity: 1 },
      s.ownerA,
    );
    expect(add.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("carrinho aceita pack de créditos e reporta total servidor", async () => {
    await syncCommercialCatalog(database.db);
    const add = await call(
      app,
      "POST",
      `${root()}/commerce/cart/items`,
      { sku: "CREDITS_100", quantity: 1 },
      s.ownerA,
    );
    expect(add.statusCode).toBe(200);
    const cart = add.json<{
      totalCents: number;
      checkoutReady: boolean;
      purchaseReady: boolean;
      items: Array<{ sku: string; unitAmountCents: number }>;
    }>();
    expect(cart.purchaseReady).toBe(false);
    expect(cart.items[0]?.sku).toBe("CREDITS_100");
    expect(cart.items[0]?.unitAmountCents).toBe(1990);
    expect(cart.totalCents).toBe(1990);
    expect(cart.checkoutReady).toBe(true);
  });

  it("fulfillment concede créditos e grants de forma idempotente", async () => {
    await syncCommercialCatalog(database.db);
    const [order] = await database.db
      .insert(commerceOrders)
      .values({
        organizationId: s.orgA,
        userId: (await call(app, "GET", "/v1/auth/session", undefined, s.ownerA)).json<{
          account: { user: { id: string } };
        }>().account.user.id,
        status: "pending_payment",
        totalCents: 1990,
        currency: "BRL",
        idempotencyKey: `test_fulfill_${Date.now()}`,
        commercialVersion: "2026-09",
      })
      .returning();

    await database.db.insert(commerceOrderItems).values({
      orderId: order!.id,
      organizationId: s.orgA,
      skuCode: "CREDITS_100",
      commercialType: "ai_credit_pack",
      quantity: 1,
      unitAmountCents: 1990,
      lineTotalCents: 1990,
      creditsGranted: 100,
    });

    // Fake payment intent id (nullable FK) — fulfillment only needs order + org.
    const first = await fulfillCommerceOrderOnPayment(database.db, {
      organizationId: s.orgA,
      orderId: order!.id,
      paymentIntentId: order!.id,
    });
    expect(first.alreadyFulfilled).toBe(false);
    expect(first.creditsGranted).toBe(100);

    const second = await fulfillCommerceOrderOnPayment(database.db, {
      organizationId: s.orgA,
      orderId: order!.id,
      paymentIntentId: order!.id,
    });
    expect(second.alreadyFulfilled).toBe(true);
  });

  it("seed OAB cria regras 0/10/15 bps", async () => {
    const seeded = await ensureOabMarketplaceSplitRules(database.db);
    expect(seeded.ensured).toBeGreaterThanOrEqual(6);
    const legal = await database.db.query.splitRules.findFirst({
      where: and(
        isNull(splitRules.organizationId),
        eq(splitRules.key, "oab_legal_fees_platform"),
        eq(splitRules.status, "active"),
      ),
    });
    expect(legal?.percentageBps).toBe(0);
    const digital = await database.db.query.splitRules.findFirst({
      where: and(
        isNull(splitRules.organizationId),
        eq(splitRules.key, "oab_digital_courses_platform"),
        eq(splitRules.status, "active"),
      ),
    });
    expect(digital?.percentageBps).toBe(1500);
  });

  it("purchase-status declara NOT_HOMOLOGATED", async () => {
    const res = await call(app, "GET", "/v1/commerce/catalog/purchase-status");
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe("NOT_HOMOLOGATED");
  });
});
