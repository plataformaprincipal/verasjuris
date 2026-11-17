import { recordAudit } from "@verasjuris/audit";
import { policyMonetization } from "@verasjuris/auth";
import { AppError } from "@verasjuris/types";
import {
  acceptServiceDeliverySchema,
  acceptServiceProposalSchema,
  addCommerceCartItemSchema,
  checkoutCommerceCartSchema,
  checkoutServiceMilestoneSchema,
  commercialCatalogQuerySchema,
  createServiceProposalSchema,
  parseInput,
  submitServiceDeliverySchema,
  updateCommerceCartItemSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../ai/shared.js";
import { meta, readAccount, requireAccount, type ApiDeps } from "../auth/routes.js";
import { CheckoutService } from "../finance/checkout-service.js";
import { requirePlatformStaff } from "../platform-admin/authorize.js";
import {
  addCommerceCartItem,
  checkoutCommerceCart,
  getCommerceCart,
  getCommerceOrder,
  listRecentCommerceOrders,
  removeCommerceCartItem,
  updateCommerceCartItem,
} from "./cart-service.js";
import { listCommercialCatalog, syncCommercialCatalog } from "./catalog-sync.js";
import { ensureOabMarketplaceSplitRules } from "./oab-split-seed.js";
import {
  acceptServiceDelivery,
  acceptServiceProposal,
  checkoutServiceMilestone,
  createServiceProposal,
  getServiceProject,
  listServiceProjects,
  submitServiceDelivery,
} from "./service-project-service.js";

type OrgParams = { organizationId?: string };
type ItemParams = OrgParams & { itemId?: string };
type OrderParams = OrgParams & { orderId?: string };
type ProjectParams = OrgParams & { projectId?: string };
type MilestoneParams = ProjectParams & { milestoneId?: string };

/**
 * Commerce API — catálogo (Fase 1) + carrinho/checkout (Fase 2) + splits OAB seed (Fase 4).
 */
export async function registerCommerceRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/commerce/catalog", async (request) => {
    await readAccount(deps, request);
    const query = parseInput(commercialCatalogQuerySchema, request.query ?? {});
    return listCommercialCatalog(deps.db, {
      commercialType: query.commercialType,
      homologationStatus: query.homologationStatus,
      placement: query.placement,
      publicOnly: query.publicOnly ?? true,
      limit: query.limit,
      offset: query.offset,
      ensureSynced: true,
    });
  });

  app.get("/organizations/:organizationId/commerce/catalog", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
    const query = parseInput(commercialCatalogQuerySchema, request.query ?? {});
    return listCommercialCatalog(deps.db, {
      commercialType: query.commercialType,
      homologationStatus: query.homologationStatus,
      placement: query.placement,
      publicOnly: query.publicOnly ?? false,
      limit: query.limit,
      offset: query.offset,
      ensureSynced: true,
    });
  });

  app.post("/organizations/:organizationId/commerce/catalog/sync", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    const isPlatform = Boolean(account.platform && account.platform.roles.length > 0);
    if (!isPlatform) {
      authorize(account, organizationId, (m) =>
        policyMonetization(m, "monetization.product.manage"),
      );
    } else {
      requirePlatformStaff(account);
    }

    const result = await syncCommercialCatalog(deps.db);
    let oab: { created: number; ensured: number; error?: string } = { created: 0, ensured: 0 };
    try {
      oab = await ensureOabMarketplaceSplitRules(deps.db);
    } catch (error) {
      oab = {
        created: 0,
        ensured: 0,
        error: error instanceof Error ? error.message : "oab_seed_failed",
      };
    }
    const requestMeta = meta(request);
    await recordAudit(deps.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "commerce.catalog_synced",
      resourceType: "commercial_catalog",
      resourceId: result.commercialVersion,
      source: "api",
      requestId: requestMeta.requestId,
      ip: requestMeta.ip,
      metadata: { ...result, oabSplitRules: oab },
    });
    const { resolvePurchaseGate } = await import("../platform-admin/homologation-service.js");
    const gate = await resolvePurchaseGate({ db: deps.db });
    return {
      ok: true as const,
      ...result,
      oabSplitRules: oab,
      purchaseReady: gate.purchaseReady,
      homologation: gate.homologation,
    };
  });

  app.post("/commerce/catalog/sync", async (request) => {
    const account = await requireAccount(deps, request);
    requirePlatformStaff(account);
    const result = await syncCommercialCatalog(deps.db);
    let oab: { created: number; ensured: number; error?: string } = { created: 0, ensured: 0 };
    try {
      oab = await ensureOabMarketplaceSplitRules(deps.db);
    } catch (error) {
      oab = {
        created: 0,
        ensured: 0,
        error: error instanceof Error ? error.message : "oab_seed_failed",
      };
    }
    const requestMeta = meta(request);
    await recordAudit(deps.db, {
      actorUserId: account.user.id,
      organizationId: null,
      action: "commerce.catalog_synced",
      resourceType: "commercial_catalog",
      resourceId: result.commercialVersion,
      source: "api",
      requestId: requestMeta.requestId,
      ip: requestMeta.ip,
      metadata: { ...result, oabSplitRules: oab, scope: "platform" },
    });
    const { resolvePurchaseGate } = await import("../platform-admin/homologation-service.js");
    const gate = await resolvePurchaseGate({ db: deps.db });
    return {
      ok: true as const,
      ...result,
      oabSplitRules: oab,
      purchaseReady: gate.purchaseReady,
      homologation: gate.homologation,
    };
  });

  app.get("/commerce/catalog/purchase-status", async () => {
    const { buildLiveChecklist } = await import("../platform-admin/homologation-service.js");
    const checklist = await buildLiveChecklist({
      db: deps.db,
      paymentHealth: async () =>
        deps.paymentProvider
          ? deps.paymentProvider.healthCheck()
          : { status: "not_configured", detail: "ausente" },
    });
    return {
      purchaseReady: checklist.purchaseReady,
      paymentsLive: checklist.paymentsLive,
      publicCheckout: checklist.publicCheckout,
      status: checklist.status,
      note: checklist.note,
      phases: {
        catalog: "seeded",
        universalCart: "implemented_sandbox",
        entitlementEngine: "implemented_post_payment",
        oabSplits: "seeded_0_10_15",
        aiModulesBilling: "implemented_gated",
        serviceMilestones: "implemented_30_70",
        offerSurface: "implemented",
        fiscalDocuments: "not_configured_records",
        liveHomologation: "auditable_gates",
      },
      homologationChecklistSummary: {
        readyForLive: checklist.readyForLive,
        blockingCount: checklist.blocking.length,
        pendingVerificationCount: checklist.pendingVerification.length,
        passedRequired: checklist.passedRequired,
        requiredTotal: checklist.requiredTotal,
        paymentsLiveInsufficientWithoutApproval: checklist.paymentsLiveInsufficientWithoutApproval,
      },
    };
  });

  /* ─── Fase 2: carrinho universal ─── */

  app.get("/organizations/:organizationId/commerce/cart", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    return getCommerceCart(deps.db, account, organizationId);
  });

  app.post("/organizations/:organizationId/commerce/cart/items", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    const body = parseInput(addCommerceCartItemSchema, request.body ?? {});
    return addCommerceCartItem(deps.db, account, organizationId, body, meta(request));
  });

  app.patch("/organizations/:organizationId/commerce/cart/items/:itemId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as ItemParams;
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const itemId = parseInput(uuidSchema, params.itemId);
    const body = parseInput(updateCommerceCartItemSchema, request.body ?? {});
    return updateCommerceCartItem(deps.db, account, organizationId, itemId, body, meta(request));
  });

  app.delete("/organizations/:organizationId/commerce/cart/items/:itemId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as ItemParams;
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const itemId = parseInput(uuidSchema, params.itemId);
    return removeCommerceCartItem(deps.db, account, organizationId, itemId, meta(request));
  });

  app.post("/organizations/:organizationId/commerce/cart/checkout", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    const body = parseInput(checkoutCommerceCartSchema, request.body ?? {});
    if (!deps.paymentProvider) {
      throw new AppError("NOT_CONFIGURED", "PaymentProvider não configurado.");
    }
    const checkout = new CheckoutService(deps.db, deps.paymentProvider, deps.billingProvider);
    return checkoutCommerceCart(deps.db, account, organizationId, body, meta(request), checkout);
  });

  app.get("/organizations/:organizationId/commerce/orders", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    const query = parseInput(
      z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
      request.query ?? {},
    );
    return listRecentCommerceOrders(deps.db, account, organizationId, query.limit);
  });

  app.get("/organizations/:organizationId/commerce/orders/:orderId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrderParams;
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const orderId = parseInput(uuidSchema, params.orderId);
    return getCommerceOrder(deps.db, account, organizationId, orderId);
  });

  app.post("/organizations/:organizationId/commerce/splits/oab/seed", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.product.manage"));
    const result = await ensureOabMarketplaceSplitRules(deps.db);
    const requestMeta = meta(request);
    await recordAudit(deps.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "commerce.oab_split_rules_seeded",
      resourceType: "split_rule",
      resourceId: "oab_marketplace",
      source: "api",
      requestId: requestMeta.requestId,
      ip: requestMeta.ip,
      metadata: result,
    });
    return {
      ok: true as const,
      ...result,
      rules: [
        { serviceType: "legal_fees", bps: 0, note: "Honorários advocatícios — 0% (OAB-safe)" },
        { serviceType: "non_legal_services", bps: 1000, note: "Serviços não jurídicos — 10%" },
        { serviceType: "digital_courses", bps: 1500, note: "Cursos/produtos digitais — 15%" },
      ],
    };
  });

  /* ─── Fase 6: serviços SRV_* 30/70 ─── */

  app.get("/organizations/:organizationId/commerce/services", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    const query = parseInput(
      z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }),
      request.query ?? {},
    );
    return listServiceProjects(deps.db, account, organizationId, query.limit);
  });

  app.post("/organizations/:organizationId/commerce/services/proposals", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = parseInput(uuidSchema, (request.params as OrgParams).organizationId);
    const body = parseInput(createServiceProposalSchema, request.body ?? {});
    return createServiceProposal(deps.db, account, organizationId, body, meta(request));
  });

  app.get("/organizations/:organizationId/commerce/services/:projectId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as ProjectParams;
    const organizationId = parseInput(uuidSchema, params.organizationId);
    const projectId = parseInput(uuidSchema, params.projectId);
    return getServiceProject(deps.db, account, organizationId, projectId);
  });

  app.post(
    "/organizations/:organizationId/commerce/services/:projectId/accept",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as ProjectParams;
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const projectId = parseInput(uuidSchema, params.projectId);
      parseInput(acceptServiceProposalSchema, request.body ?? { accept: true });
      return acceptServiceProposal(deps.db, account, organizationId, projectId, meta(request));
    },
  );

  app.post(
    "/organizations/:organizationId/commerce/services/:projectId/milestones/:milestoneId/checkout",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as MilestoneParams;
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const projectId = parseInput(uuidSchema, params.projectId);
      const milestoneId = parseInput(uuidSchema, params.milestoneId);
      const body = parseInput(checkoutServiceMilestoneSchema, request.body ?? {});
      if (!deps.paymentProvider) {
        throw new AppError("NOT_CONFIGURED", "PaymentProvider não configurado.");
      }
      const checkout = new CheckoutService(deps.db, deps.paymentProvider, deps.billingProvider);
      return checkoutServiceMilestone(
        deps.db,
        account,
        organizationId,
        projectId,
        milestoneId,
        body,
        meta(request),
        checkout,
      );
    },
  );

  app.post(
    "/organizations/:organizationId/commerce/services/:projectId/deliver",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as ProjectParams;
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const projectId = parseInput(uuidSchema, params.projectId);
      const body = parseInput(submitServiceDeliverySchema, request.body ?? {});
      return submitServiceDelivery(
        deps.db,
        account,
        organizationId,
        projectId,
        body,
        meta(request),
      );
    },
  );

  app.post(
    "/organizations/:organizationId/commerce/services/:projectId/accept-delivery",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as ProjectParams;
      const organizationId = parseInput(uuidSchema, params.organizationId);
      const projectId = parseInput(uuidSchema, params.projectId);
      const body = parseInput(acceptServiceDeliverySchema, request.body ?? {});
      return acceptServiceDelivery(
        deps.db,
        account,
        organizationId,
        projectId,
        body,
        meta(request),
      );
    },
  );
}

/**
 * Legado: o módulo commerce não escreve env. PAYMENTS_LIVE é ops-only e
 * insuficiente sem aprovação DB — ver assertPlatformPurchaseReady.
 */
export function assertPaymentsLiveForbidden(_envFlag: string | undefined): void {
  // no-op: gate real é checklist + aprovação em homologation-service
}
