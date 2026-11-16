import { recordAudit } from "@verasjuris/audit";
import {
  policyMarketplaceEngagement,
  policyMarketplaceRequest,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  conversationParticipants,
  conversationThreads,
  isUniqueViolation,
  marketplaceCartItems,
  marketplaceCarts,
  marketplaceEngagements,
  marketplaceProposals,
  marketplaceRequests,
  professionalServices,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, eq, inArray } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  initiateMarketplaceProviderPayment,
  type MarketplaceModuleDeps,
} from "./service.js";

function sanitizeText(value: string): string {
  return Array.from(value)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("")
    .trim();
}

async function ensureOpenCart(
  db: AppDatabase,
  organizationId: string,
  userId: string,
): Promise<typeof marketplaceCarts.$inferSelect> {
  const existing = await db.query.marketplaceCarts.findFirst({
    where: and(
      eq(marketplaceCarts.organizationId, organizationId),
      eq(marketplaceCarts.userId, userId),
      eq(marketplaceCarts.status, "open"),
    ),
    orderBy: asc(marketplaceCarts.createdAt),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(marketplaceCarts)
    .values({ organizationId, userId, status: "open" })
    .returning();
  return created!;
}

function serverUnitPriceCents(service: typeof professionalServices.$inferSelect): number | null {
  if (service.pricingModel === "fixed" && service.basePriceCents != null && service.basePriceCents > 0) {
    return service.basePriceCents;
  }
  if (
    service.pricingModel === "starting_at" &&
    service.minPriceCents != null &&
    service.minPriceCents > 0
  ) {
    return null;
  }
  return null;
}

export async function getMarketplaceCart(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.read"),
  );
  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  const items = await db.query.marketplaceCartItems.findMany({
    where: eq(marketplaceCartItems.cartId, cart.id),
    orderBy: asc(marketplaceCartItems.createdAt),
  });
  const serviceIds = items.map((i) => i.professionalServiceId);
  const services =
    serviceIds.length === 0
      ? []
      : await db.query.professionalServices.findMany({
          where: inArray(professionalServices.id, serviceIds),
        });
  const byId = new Map(services.map((s) => [s.id, s]));

  let totalCents = 0;
  let checkoutReady = true;
  const serialized = items.map((item) => {
    const service = byId.get(item.professionalServiceId);
    const unit = service ? serverUnitPriceCents(service) : null;
    const lineTotal = unit != null ? unit * item.quantity : null;
    if (lineTotal == null) checkoutReady = false;
    else totalCents += lineTotal;
    return {
      id: item.id,
      professionalServiceId: item.professionalServiceId,
      quantity: item.quantity,
      notes: item.notes,
      service: service
        ? {
            id: service.id,
            title: service.title,
            professionalProfileId: service.professionalProfileId,
            pricingModel: service.pricingModel,
            unitPriceCents: unit,
            quoteRequired: unit == null,
          }
        : null,
      lineTotalCents: lineTotal,
      createdAt: iso(item.createdAt),
      updatedAt: iso(item.updatedAt),
    };
  });

  return {
    cart: {
      id: cart.id,
      organizationId: cart.organizationId,
      status: cart.status,
      totalCents: checkoutReady ? totalCents : null,
      checkoutReady,
      currency: "BRL",
      itemCount: serialized.length,
      createdAt: iso(cart.createdAt),
      updatedAt: iso(cart.updatedAt),
    },
    items: serialized,
  };
}

export async function addMarketplaceCartItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { professionalServiceId: string; quantity: number; notes?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.request.create"),
  );
  const service = await db.query.professionalServices.findFirst({
    where: and(
      eq(professionalServices.id, input.professionalServiceId),
      eq(professionalServices.active, true),
    ),
  });
  if (!service) throw new AppError("NOT_FOUND", "Serviço não encontrado ou indisponível.");

  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  const now = new Date();
  try {
    const existing = await db.query.marketplaceCartItems.findFirst({
      where: and(
        eq(marketplaceCartItems.cartId, cart.id),
        eq(marketplaceCartItems.professionalServiceId, service.id),
      ),
    });
    if (existing) {
      const [updated] = await db
        .update(marketplaceCartItems)
        .set({
          quantity: Math.min(20, existing.quantity + input.quantity),
          notes: input.notes != null ? sanitizeText(input.notes) || null : existing.notes,
          updatedAt: now,
        })
        .where(eq(marketplaceCartItems.id, existing.id))
        .returning();
      await recordAudit(db, {
        actorUserId: account.user.id,
        organizationId,
        action: "marketplace.cart_item_updated",
        resourceType: "marketplace_cart_item",
        resourceId: updated!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });
    } else {
      const [created] = await db
        .insert(marketplaceCartItems)
        .values({
          cartId: cart.id,
          organizationId,
          professionalServiceId: service.id,
          quantity: input.quantity,
          notes: input.notes ? sanitizeText(input.notes) || null : null,
        })
        .returning();
      await recordAudit(db, {
        actorUserId: account.user.id,
        organizationId,
        action: "marketplace.cart_item_added",
        resourceType: "marketplace_cart_item",
        resourceId: created!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Item já presente no carrinho.");
    }
    throw error;
  }

  return getMarketplaceCart(db, account, organizationId);
}

export async function updateMarketplaceCartItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  itemId: string,
  input: { quantity: number; notes?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.request.create"),
  );
  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  const item = await db.query.marketplaceCartItems.findFirst({
    where: and(
      eq(marketplaceCartItems.id, itemId),
      eq(marketplaceCartItems.cartId, cart.id),
      eq(marketplaceCartItems.organizationId, organizationId),
    ),
  });
  if (!item) throw new AppError("NOT_FOUND", "Item do carrinho não encontrado.");

  await db
    .update(marketplaceCartItems)
    .set({
      quantity: input.quantity,
      notes: input.notes != null ? sanitizeText(input.notes) || null : item.notes,
      updatedAt: new Date(),
    })
    .where(eq(marketplaceCartItems.id, item.id));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.cart_item_updated",
    resourceType: "marketplace_cart_item",
    resourceId: item.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return getMarketplaceCart(db, account, organizationId);
}

export async function removeMarketplaceCartItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  itemId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceRequest(access, "marketplace.request.create"),
  );
  const cart = await ensureOpenCart(db, organizationId, account.user.id);
  const item = await db.query.marketplaceCartItems.findFirst({
    where: and(
      eq(marketplaceCartItems.id, itemId),
      eq(marketplaceCartItems.cartId, cart.id),
      eq(marketplaceCartItems.organizationId, organizationId),
    ),
  });
  if (!item) throw new AppError("NOT_FOUND", "Item do carrinho não encontrado.");

  await db.delete(marketplaceCartItems).where(eq(marketplaceCartItems.id, item.id));
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.cart_item_removed",
    resourceType: "marketplace_cart_item",
    resourceId: item.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return getMarketplaceCart(db, account, organizationId);
}

/**
 * Checkout: só serviços com preço fixo recalculado no servidor.
 * Cria request + proposta imutável aceita + engagement pending_payment + intent PSP.
 */
export async function checkoutMarketplaceCart(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    paymentMethod: "pix" | "boleto" | "credit_card";
    acceptTerms: true;
    clientId?: string;
  },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.engagement.manage"),
  );
  const snapshot = await getMarketplaceCart(db, account, organizationId);
  if (!snapshot.cart.checkoutReady || snapshot.items.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "O carrinho contém itens que exigem proposta personalizada ou está vazio. Remova serviços sob consulta antes do checkout imediato.",
    );
  }

  const now = new Date();
  const results: Array<{
    engagementId: string;
    paymentIntentId: string;
    checkoutUrl: string | null;
    amountCents: number;
  }> = [];

  for (const item of snapshot.items) {
    if (!item.service || item.lineTotalCents == null || item.service.unitPriceCents == null) {
      throw new AppError("VALIDATION_ERROR", "Preço do serviço inválido no checkout.");
    }
    const service = await db.query.professionalServices.findFirst({
      where: eq(professionalServices.id, item.professionalServiceId),
    });
    if (!service || !service.active) {
      throw new AppError("CONFLICT", "Um serviço do carrinho deixou de estar disponível.");
    }
    const unit = serverUnitPriceCents(service);
    if (unit == null || unit !== item.service.unitPriceCents) {
      throw new AppError(
        "CONFLICT",
        "O preço do serviço mudou. Atualize o carrinho e tente novamente.",
      );
    }
    const amountCents = unit * item.quantity;

    const created = await db.transaction(async (tx) => {
      const [request] = await tx
        .insert(marketplaceRequests)
        .values({
          organizationId,
          requesterUserId: account.user.id,
          clientId: input.clientId ?? null,
          categoryId: service.categoryId,
          title: sanitizeText(service.title).slice(0, 180),
          description:
            item.notes?.trim() ||
            `Contratação imediata via carrinho — serviço ${service.id.slice(0, 8)}.`,
          urgency: "normal",
          remoteAllowed: true,
          status: "in_progress",
        })
        .returning();

      const [proposal] = await tx
        .insert(marketplaceProposals)
        .values({
          requestId: request!.id,
          professionalProfileId: service.professionalProfileId,
          amountCents,
          message: "Proposta gerada no checkout de preço fixo (versão contratada).",
          status: "accepted",
          version: 1,
        })
        .returning();

      await tx
        .update(marketplaceRequests)
        .set({ acceptedProposalId: proposal!.id, updatedAt: now })
        .where(eq(marketplaceRequests.id, request!.id));

      const [thread] = await tx
        .insert(conversationThreads)
        .values({
          organizationId,
          clientId: input.clientId ?? null,
          subject: `Marketplace — ${sanitizeText(service.title).slice(0, 100)}`,
          status: "open",
          createdByUserId: account.user.id,
          contextType: "marketplace_proposal",
          contextId: proposal!.id,
        })
        .returning();

      await tx.insert(conversationParticipants).values([
        {
          organizationId,
          threadId: thread!.id,
          userId: account.user.id,
          participantRole: "client",
        },
        {
          organizationId,
          threadId: thread!.id,
          userId: service.professionalProfileId,
          participantRole: "provider",
        },
      ]);

      const [engagement] = await tx
        .insert(marketplaceEngagements)
        .values({
          organizationId,
          requestId: request!.id,
          proposalId: proposal!.id,
          clientId: input.clientId ?? null,
          professionalProfileId: service.professionalProfileId,
          conversationThreadId: thread!.id,
          status: "pending_payment",
          revisionLimit: 2,
          startedAt: now,
        })
        .returning();

      await tx
        .update(conversationThreads)
        .set({
          contextType: "marketplace_engagement",
          contextId: engagement!.id,
          updatedAt: now,
        })
        .where(eq(conversationThreads.id, thread!.id));

      return { engagementId: engagement!.id, amountCents };
    });

    const payment = await initiateMarketplaceProviderPayment(
      db,
      account,
      organizationId,
      created.engagementId,
      { paymentMethod: input.paymentMethod },
      deps,
      meta,
    );

    results.push({
      engagementId: created.engagementId,
      paymentIntentId: payment.paymentIntentId,
      checkoutUrl: payment.checkoutUrl,
      amountCents: created.amountCents,
    });
  }

  await db
    .update(marketplaceCarts)
    .set({ status: "checked_out", updatedAt: now })
    .where(eq(marketplaceCarts.id, snapshot.cart.id));

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.cart_checked_out",
    resourceType: "marketplace_cart",
    resourceId: snapshot.cart.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { engagements: results.map((r) => r.engagementId) },
  });

  return {
    cartId: snapshot.cart.id,
    status: "pending_payment" as const,
    items: results,
    totalCents: results.reduce((sum, r) => sum + r.amountCents, 0),
    currency: "BRL",
  };
}
