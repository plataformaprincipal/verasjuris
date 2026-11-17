import { monetizationProducts, productPrices, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { COMMERCIAL_CATALOG, COMMERCIAL_VERSION, yearlyAmountCents } from "@verasjuris/validation";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { syncCommercialCatalog } from "./modules/commerce/catalog-sync.js";
import { call } from "./test-helpers.js";

describe("Commercial catalog Phase 1", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;

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
    s = await bootstrapEtapa6(app, email, "commerce-catalog");
  });

  afterAll(async () => {
    await app?.close();
    await database?.close();
  });

  it("catalog definitions use centavos and include 24 AI modules", () => {
    const ai = COMMERCIAL_CATALOG.filter((s) => s.commercialType === "ai_module");
    expect(ai).toHaveLength(24);
    for (const sku of COMMERCIAL_CATALOG) {
      expect(Number.isInteger(sku.amountCents)).toBe(true);
      expect(sku.amountCents).toBeGreaterThanOrEqual(0);
      expect(sku.currency).toBe("BRL");
    }
    expect(yearlyAmountCents(10_000)).toBe(102_000); // 12 * 10000 * 0.85
  });

  it("sync is idempotent and versions prices on change", async () => {
    const first = await syncCommercialCatalog(database.db);
    expect(first.commercialVersion).toBe(COMMERCIAL_VERSION);
    expect(first.upserted).toBe(COMMERCIAL_CATALOG.length);
    expect(first.pricesCreated).toBeGreaterThan(0);

    const second = await syncCommercialCatalog(database.db);
    expect(second.upserted).toBe(COMMERCIAL_CATALOG.length);
    expect(second.pricesCreated).toBe(0);

    const product = await database.db.query.monetizationProducts.findFirst({
      where: eq(monetizationProducts.key, "PLAN_CIDADAO_PLUS"),
      with: { prices: true },
    });
    expect(product?.commercialVersion).toBe(COMMERCIAL_VERSION);
    expect(product?.skuCode).toBe("PLAN_CIDADAO_PLUS");
    const monthly = product?.prices?.find((p) => p.active && p.interval === "monthly");
    expect(monthly?.amountCents).toBe(2990);

    // Force a price change → new version, history preserved.
    await database.db
      .update(productPrices)
      .set({ amountCents: 1 })
      .where(eq(productPrices.id, monthly!.id));
    const third = await syncCommercialCatalog(database.db);
    expect(third.pricesCreated).toBeGreaterThan(0);
    const refreshed = await database.db.query.monetizationProducts.findFirst({
      where: eq(monetizationProducts.key, "PLAN_CIDADAO_PLUS"),
      with: { prices: true },
    });
    const versions = refreshed?.prices?.map((p) => p.version) ?? [];
    expect(new Set(versions).size).toBe(versions.length);
    expect(refreshed?.prices?.some((p) => p.amountCents === 1 && !p.active)).toBe(true);
    expect(
      refreshed?.prices?.some(
        (p) => p.amountCents === 2990 && p.active && p.interval === "monthly",
      ),
    ).toBe(true);
  });

  it("GET /v1/commerce/catalog returns canonical SKUs without secrets", async () => {
    await syncCommercialCatalog(database.db);
    const res = await call(app, "GET", "/v1/commerce/catalog?commercialType=plan&limit=50");
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      commercialVersion: string;
      purchaseReady: boolean;
      paymentsLiveForbidden: boolean;
      items: Array<{ sku: string; amountCents: number | null; purchaseReady: boolean }>;
    }>();
    expect(body.commercialVersion).toBe(COMMERCIAL_VERSION);
    expect(body.purchaseReady).toBe(false);
    expect(body.paymentsLiveForbidden).toBe(false);
    expect(body.items.some((i) => i.sku === "PLAN_PRO_INDIVIDUAL")).toBe(true);
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/asaas/i);
    expect(raw).not.toMatch(/api[_-]?key/i);
    expect(raw).not.toMatch(/secret/i);
  });

  it("GET /v1/planos prefers commercial plan SKUs", async () => {
    await syncCommercialCatalog(database.db);
    const res = await call(app, "GET", "/v1/planos");
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      items: Array<{ key: string; commercialType?: string | null; purchaseReady?: boolean }>;
      purchaseReady: boolean;
    }>();
    expect(body.purchaseReady).toBe(false);
    expect(body.items.every((i) => i.commercialType === "plan" || i.key.startsWith("PLAN_"))).toBe(
      true,
    );
    expect(body.items.some((i) => i.key.startsWith("plan_"))).toBe(false);
  });

  it("org sync requires auth and marks NOT_READY_FOR_PURCHASE", async () => {
    const denied = await call(app, "POST", `/v1/organizations/${s.orgA}/commerce/catalog/sync`);
    expect(denied.statusCode).toBeGreaterThanOrEqual(401);

    const ok = await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/commerce/catalog/sync`,
      {},
      s.ownerA,
    );
    expect(ok.statusCode, JSON.stringify(ok.json())).toBe(200);
    const body = ok.json<{ ok: boolean; purchaseReady: boolean; commercialVersion: string }>();
    expect(body.ok).toBe(true);
    expect(body.purchaseReady).toBe(false);
    expect(body.commercialVersion).toBe(COMMERCIAL_VERSION);
  });
});
