import {
  commercialEntitlements,
  isUniqueViolation,
  monetizationProducts,
  productPrices,
  type AppDatabase,
} from "@verasjuris/database";
import {
  ANNUAL_DISCOUNT_BPS,
  COMMERCIAL_CATALOG,
  COMMERCIAL_VERSION,
  LEGACY_PLAN_KEYS,
  MARKETPLACE_COMMISSION_RULES,
  yearlyAmountCents,
  type CommercialSkuDefinition,
} from "@verasjuris/validation";
import { and, asc, eq, inArray } from "drizzle-orm";

export type CatalogSyncResult = {
  commercialVersion: typeof COMMERCIAL_VERSION;
  upserted: number;
  pricesCreated: number;
  entitlementsUpserted: number;
  legacyDeactivated: number;
  totalSkus: number;
};

export type CatalogItemView = {
  sku: string;
  key: string;
  name: string;
  description: string | null;
  commercialType: string | null;
  productType: string;
  commercialVersion: string | null;
  homologationStatus: string | null;
  purchaseReady: false;
  purchaseStatus: "CATALOG_SEEDED" | "NOT_READY_FOR_PURCHASE";
  requiresProposal: boolean;
  priceMode: string | null;
  amountCents: number | null;
  currency: string;
  interval: string | null;
  yearlyAmountCents: number | null;
  placementPaths: string[];
  franchises: Record<string, unknown>;
  creditsGranted: number | null;
  cancelPolicyKey: string | null;
  refundPolicyKey: string | null;
  dependencies: string[];
  planTier: string | null;
  planTarget: string | null;
  active: boolean;
  public: boolean;
  prices: Array<{
    amountCents: number;
    currency: string;
    interval: string | null;
    active: boolean;
    version: number;
  }>;
  entitlements: Array<{
    featureKey: string;
    limitType: string;
    limitValue: number | null;
  }>;
  source: "database" | "definition";
};

function metadataFromSku(sku: CommercialSkuDefinition): Record<string, unknown> {
  return {
    commercialVersion: COMMERCIAL_VERSION,
    priceMode: sku.priceMode,
    requiresProposal: sku.requiresProposal,
    franchises: sku.franchises ?? {},
    creditsGranted: sku.creditsGranted ?? null,
    cancelPolicyKey: sku.cancelPolicyKey,
    refundPolicyKey: sku.refundPolicyKey,
    dependencies: sku.dependencies ?? [],
    annualDiscountBps: ANNUAL_DISCOUNT_BPS,
    marketplaceCommissionRules: MARKETPLACE_COMMISSION_RULES,
    sortOrder: sku.sortOrder,
  };
}

/**
 * Idempotent upsert of the 2026-09 commercial catalog into monetization_products /
 * product_prices / commercial_entitlements. Creates a new price version only when
 * amount or interval changes; never overwrites historical price rows.
 */
export async function syncCommercialCatalog(db: AppDatabase): Promise<CatalogSyncResult> {
  let upserted = 0;
  let pricesCreated = 0;
  let entitlementsUpserted = 0;

  for (const sku of COMMERCIAL_CATALOG) {
    const existing = await db.query.monetizationProducts.findFirst({
      where: eq(monetizationProducts.key, sku.sku),
      with: { prices: true },
    });

    let productId: string;
    if (existing) {
      await db
        .update(monetizationProducts)
        .set({
          name: sku.name,
          description: sku.description,
          productType: sku.productType,
          planTier: sku.planTier ?? null,
          planTarget: sku.planTarget ?? null,
          skuCode: sku.sku,
          commercialType: sku.commercialType,
          commercialVersion: COMMERCIAL_VERSION,
          homologationStatus: sku.homologationStatus,
          metadataJson: metadataFromSku(sku),
          placementJson: sku.placementPaths,
          active: true,
          public: sku.public,
          updatedAt: new Date(),
        })
        .where(eq(monetizationProducts.id, existing.id));
      productId = existing.id;
    } else {
      try {
        const [row] = await db
          .insert(monetizationProducts)
          .values({
            organizationId: null,
            key: sku.sku,
            name: sku.name,
            description: sku.description,
            productType: sku.productType,
            planTier: sku.planTier ?? null,
            planTarget: sku.planTarget ?? null,
            skuCode: sku.sku,
            commercialType: sku.commercialType,
            commercialVersion: COMMERCIAL_VERSION,
            homologationStatus: sku.homologationStatus,
            metadataJson: metadataFromSku(sku),
            placementJson: sku.placementPaths,
            active: true,
            public: sku.public,
          })
          .returning();
        productId = row!.id;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const raced = await db.query.monetizationProducts.findFirst({
          where: eq(monetizationProducts.key, sku.sku),
        });
        if (!raced) throw error;
        productId = raced.id;
      }
    }
    upserted += 1;

    const prices = existing?.prices ?? [];
    const activeMonthly =
      prices.find(
        (p) => p.active && (p.interval === sku.interval || (!p.interval && !sku.interval)),
      ) ?? prices.find((p) => p.active);
    const needsNewPrice =
      !activeMonthly ||
      activeMonthly.amountCents !== sku.amountCents ||
      (activeMonthly.interval ?? null) !== (sku.interval ?? null);

    if (needsNewPrice) {
      const maxVersion = prices.reduce((max, p) => Math.max(max, p.version), 0);
      if (activeMonthly) {
        await db
          .update(productPrices)
          .set({ active: false, validTo: new Date() })
          .where(eq(productPrices.id, activeMonthly.id));
      }
      await db.insert(productPrices).values({
        productId,
        amountCents: sku.amountCents,
        currency: sku.currency,
        interval: sku.interval,
        usageBased: false,
        active: true,
        version: maxVersion + 1,
      });
      pricesCreated += 1;

      // Mirror yearly list price for monthly subscriptions (15% discount reference).
      if (sku.interval === "monthly" && sku.amountCents > 0 && !sku.requiresProposal) {
        const yearly = yearlyAmountCents(sku.amountCents);
        const activeYearly = prices.find((p) => p.active && p.interval === "yearly");
        if (!activeYearly || activeYearly.amountCents !== yearly) {
          if (activeYearly) {
            await db
              .update(productPrices)
              .set({ active: false, validTo: new Date() })
              .where(eq(productPrices.id, activeYearly.id));
          }
          const nextVersion = maxVersion + 2;
          await db.insert(productPrices).values({
            productId,
            amountCents: yearly,
            currency: sku.currency,
            interval: "yearly",
            usageBased: false,
            active: true,
            version: nextVersion,
          });
          pricesCreated += 1;
        }
      }
    }

    if (sku.entitlements?.length) {
      for (const ent of sku.entitlements) {
        const existingEnt = await db.query.commercialEntitlements.findFirst({
          where: and(
            eq(commercialEntitlements.skuCode, sku.sku),
            eq(commercialEntitlements.featureKey, ent.featureKey),
          ),
        });
        if (existingEnt) {
          await db
            .update(commercialEntitlements)
            .set({
              productId,
              limitType: ent.limitType,
              limitValue: ent.limitValue ?? null,
              commercialVersion: COMMERCIAL_VERSION,
              active: true,
              updatedAt: new Date(),
            })
            .where(eq(commercialEntitlements.id, existingEnt.id));
        } else {
          await db.insert(commercialEntitlements).values({
            productId,
            skuCode: sku.sku,
            featureKey: ent.featureKey,
            limitType: ent.limitType,
            limitValue: ent.limitValue ?? null,
            commercialVersion: COMMERCIAL_VERSION,
            active: true,
          });
        }
        entitlementsUpserted += 1;
      }
    }
  }

  let legacyDeactivated = 0;
  const legacy = await db.query.monetizationProducts.findMany({
    where: inArray(monetizationProducts.key, [...LEGACY_PLAN_KEYS]),
  });
  for (const row of legacy) {
    if (!row.active) continue;
    await db
      .update(monetizationProducts)
      .set({
        active: false,
        public: false,
        metadataJson: {
          ...(row.metadataJson ?? {}),
          supersededBy: "commercial_catalog_2026-09",
          deactivatedReason: "legacy_seed_replaced",
        },
        updatedAt: new Date(),
      })
      .where(eq(monetizationProducts.id, row.id));
    legacyDeactivated += 1;
  }

  return {
    commercialVersion: COMMERCIAL_VERSION,
    upserted,
    pricesCreated,
    entitlementsUpserted,
    legacyDeactivated,
    totalSkus: COMMERCIAL_CATALOG.length,
  };
}

function viewFromDefinition(sku: CommercialSkuDefinition): CatalogItemView {
  const yearly =
    sku.interval === "monthly" && sku.amountCents > 0 && !sku.requiresProposal
      ? yearlyAmountCents(sku.amountCents)
      : null;
  return {
    sku: sku.sku,
    key: sku.sku,
    name: sku.name,
    description: sku.description,
    commercialType: sku.commercialType,
    productType: sku.productType,
    commercialVersion: COMMERCIAL_VERSION,
    homologationStatus: sku.homologationStatus,
    purchaseReady: false,
    purchaseStatus: "NOT_READY_FOR_PURCHASE",
    requiresProposal: sku.requiresProposal,
    priceMode: sku.priceMode,
    amountCents: sku.priceMode === "proposal" ? null : sku.amountCents,
    currency: sku.currency,
    interval: sku.interval,
    yearlyAmountCents: yearly,
    placementPaths: sku.placementPaths,
    franchises: sku.franchises ?? {},
    creditsGranted: sku.creditsGranted ?? null,
    cancelPolicyKey: sku.cancelPolicyKey,
    refundPolicyKey: sku.refundPolicyKey,
    dependencies: sku.dependencies ?? [],
    planTier: sku.planTier ?? null,
    planTarget: sku.planTarget ?? null,
    active: true,
    public: sku.public,
    prices: [
      {
        amountCents: sku.amountCents,
        currency: sku.currency,
        interval: sku.interval,
        active: true,
        version: 1,
      },
    ],
    entitlements: (sku.entitlements ?? []).map((e) => ({
      featureKey: e.featureKey,
      limitType: e.limitType,
      limitValue: e.limitValue ?? null,
    })),
    source: "definition",
  };
}

function viewFromRow(
  row: typeof monetizationProducts.$inferSelect,
  prices: (typeof productPrices.$inferSelect)[],
  entitlements: (typeof commercialEntitlements.$inferSelect)[],
): CatalogItemView {
  const meta = (row.metadataJson ?? {}) as Record<string, unknown>;
  const activePrices = prices.filter((p) => p.active);
  const primary =
    activePrices.find((p) => p.interval === "monthly") ??
    activePrices.find((p) => p.interval === "one_time") ??
    activePrices[0];
  const yearly = activePrices.find((p) => p.interval === "yearly");
  const priceMode = typeof meta.priceMode === "string" ? meta.priceMode : null;
  const requiresProposal = Boolean(meta.requiresProposal);
  const amountCents = priceMode === "proposal" ? null : (primary?.amountCents ?? null);

  return {
    sku: row.skuCode ?? row.key,
    key: row.key,
    name: row.name,
    description: row.description,
    commercialType: row.commercialType,
    productType: row.productType,
    commercialVersion: row.commercialVersion,
    homologationStatus: row.homologationStatus,
    purchaseReady: false,
    purchaseStatus: "CATALOG_SEEDED",
    requiresProposal,
    priceMode,
    amountCents,
    currency: primary?.currency ?? "BRL",
    interval: primary?.interval ?? null,
    yearlyAmountCents: yearly?.amountCents ?? null,
    placementPaths: Array.isArray(row.placementJson) ? row.placementJson : [],
    franchises:
      meta.franchises && typeof meta.franchises === "object"
        ? (meta.franchises as Record<string, unknown>)
        : {},
    creditsGranted: typeof meta.creditsGranted === "number" ? meta.creditsGranted : null,
    cancelPolicyKey: typeof meta.cancelPolicyKey === "string" ? meta.cancelPolicyKey : null,
    refundPolicyKey: typeof meta.refundPolicyKey === "string" ? meta.refundPolicyKey : null,
    dependencies: Array.isArray(meta.dependencies)
      ? meta.dependencies.filter((d): d is string => typeof d === "string")
      : [],
    planTier: row.planTier,
    planTarget: row.planTarget,
    active: row.active,
    public: row.public,
    prices: activePrices.map((p) => ({
      amountCents: p.amountCents,
      currency: p.currency,
      interval: p.interval,
      active: p.active,
      version: p.version,
    })),
    entitlements: entitlements
      .filter((e) => e.active)
      .map((e) => ({
        featureKey: e.featureKey,
        limitType: e.limitType,
        limitValue: e.limitValue,
      })),
    source: "database",
  };
}

export async function listCommercialCatalog(
  db: AppDatabase,
  query: {
    commercialType?: string;
    homologationStatus?: string;
    placement?: string;
    publicOnly?: boolean;
    limit: number;
    offset: number;
    /** When true, prefer DB rows after ensuring sync; when false/empty DB, fall back to definitions. */
    ensureSynced?: boolean;
  },
): Promise<{
  commercialVersion: typeof COMMERCIAL_VERSION;
  purchaseReady: false;
  paymentsLiveForbidden: true;
  commissionRules: typeof MARKETPLACE_COMMISSION_RULES;
  items: CatalogItemView[];
  total: number;
  limit: number;
  offset: number;
}> {
  if (query.ensureSynced !== false) {
    const anyCatalog = await db.query.monetizationProducts.findFirst({
      where: eq(monetizationProducts.commercialVersion, COMMERCIAL_VERSION),
    });
    if (!anyCatalog) {
      await syncCommercialCatalog(db);
    }
  }

  const filters = [eq(monetizationProducts.commercialVersion, COMMERCIAL_VERSION)];
  if (query.publicOnly !== false) filters.push(eq(monetizationProducts.public, true));
  filters.push(eq(monetizationProducts.active, true));
  if (query.commercialType) {
    filters.push(eq(monetizationProducts.commercialType, query.commercialType));
  }
  if (query.homologationStatus) {
    filters.push(
      eq(
        monetizationProducts.homologationStatus,
        query.homologationStatus as "catalog_only" | "partial" | "not_implemented",
      ),
    );
  }

  const rows = await db.query.monetizationProducts.findMany({
    where: and(...filters),
    orderBy: [asc(monetizationProducts.commercialType), asc(monetizationProducts.name)],
    with: {
      prices: true,
      commercialEntitlements: true,
    },
  });

  let items = rows.map((row) =>
    viewFromRow(row, row.prices ?? [], row.commercialEntitlements ?? []),
  );

  if (query.placement) {
    items = items.filter((item) =>
      item.placementPaths.some((p) => p === query.placement || p.startsWith(`${query.placement}/`)),
    );
  }

  // Fallback to immutable definitions if DB empty (e.g. migration not applied yet in unit context).
  if (items.length === 0) {
    items = COMMERCIAL_CATALOG.filter((sku) => {
      if (query.publicOnly !== false && !sku.public) return false;
      if (query.commercialType && sku.commercialType !== query.commercialType) return false;
      if (query.homologationStatus && sku.homologationStatus !== query.homologationStatus) {
        return false;
      }
      if (
        query.placement &&
        !sku.placementPaths.some(
          (p) => p === query.placement || p.startsWith(`${query.placement}/`),
        )
      ) {
        return false;
      }
      return true;
    }).map(viewFromDefinition);
  }

  const total = items.length;
  const sliced = items.slice(query.offset, query.offset + query.limit);

  return {
    commercialVersion: COMMERCIAL_VERSION,
    purchaseReady: false,
    paymentsLiveForbidden: true,
    commissionRules: MARKETPLACE_COMMISSION_RULES,
    items: sliced,
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Ensures catalog is seeded; used by MonetizationService.ensureDefaultPlanProducts. */
export async function ensureCommercialCatalogSeeded(
  db: AppDatabase,
): Promise<CatalogSyncResult | { seeded: false; legacyTouched: number }> {
  const existing = await db.query.monetizationProducts.findFirst({
    where: eq(monetizationProducts.commercialVersion, COMMERCIAL_VERSION),
  });
  if (existing) {
    const legacy = await db
      .update(monetizationProducts)
      .set({
        active: false,
        public: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(monetizationProducts.key, [...LEGACY_PLAN_KEYS]),
          eq(monetizationProducts.active, true),
        ),
      )
      .returning({ id: monetizationProducts.id });
    return { seeded: false, legacyTouched: legacy.length };
  }
  return syncCommercialCatalog(db);
}
