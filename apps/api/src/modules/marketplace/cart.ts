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
  marketplaceCheckoutAttemptItems,
  marketplaceCheckoutAttempts,
  marketplaceEngagements,
  marketplaceProposals,
  marketplaceRequests,
  paymentIntents,
  professionalServices,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, eq, inArray } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { initiateMarketplaceProviderPayment, type MarketplaceModuleDeps } from "./service.js";

type CheckoutAttemptRow = typeof marketplaceCheckoutAttempts.$inferSelect;

const CHECKOUT_TERMINAL = new Set(["completed", "failed"]);
const ITEM_PAYMENT_DONE = new Set(["payment_initiated", "skipped"]);

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
  const checkingOut = await db.query.marketplaceCarts.findFirst({
    where: and(
      eq(marketplaceCarts.organizationId, organizationId),
      eq(marketplaceCarts.userId, userId),
      eq(marketplaceCarts.status, "checking_out"),
    ),
    orderBy: asc(marketplaceCarts.createdAt),
  });
  if (checkingOut) return checkingOut;

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
  if (
    service.pricingModel === "fixed" &&
    service.basePriceCents != null &&
    service.basePriceCents > 0
  ) {
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

  const activeCheckout =
    cart.status === "checking_out"
      ? await db.query.marketplaceCheckoutAttempts.findFirst({
          where: and(
            eq(marketplaceCheckoutAttempts.cartId, cart.id),
            eq(marketplaceCheckoutAttempts.organizationId, organizationId),
          ),
          orderBy: asc(marketplaceCheckoutAttempts.createdAt),
        })
      : null;

  return {
    cart: {
      id: cart.id,
      organizationId: cart.organizationId,
      status: cart.status,
      totalCents: checkoutReady ? totalCents : null,
      checkoutReady: checkoutReady && cart.status === "open",
      currency: "BRL",
      itemCount: serialized.length,
      activeCheckoutId: activeCheckout?.id ?? null,
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
  if (cart.status !== "open") {
    throw new AppError(
      "CONFLICT",
      "Há um checkout em andamento neste carrinho. Conclua ou consulte a tentativa antes de alterar itens.",
    );
  }
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
  if (cart.status !== "open") {
    throw new AppError(
      "CONFLICT",
      "Há um checkout em andamento neste carrinho. Conclua ou consulte a tentativa antes de alterar itens.",
    );
  }
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
  if (cart.status !== "open") {
    throw new AppError(
      "CONFLICT",
      "Há um checkout em andamento neste carrinho. Conclua ou consulte a tentativa antes de alterar itens.",
    );
  }
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

function paymentInstructionsFromMeta(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, string | null> {
  const m = metadata ?? {};
  const str = (key: string) => (typeof m[key] === "string" ? (m[key] as string) : null);
  return {
    checkoutUrl: str("checkoutUrl") ?? str("invoiceUrl"),
    invoiceUrl: str("invoiceUrl"),
    bankSlipUrl: str("bankSlipUrl"),
    pixCopyPaste: str("pixCopyPaste"),
    pixQrCodeBase64: str("pixQrCodeBase64"),
    pixExpiresAt: str("pixExpiresAt"),
    boletoDigitableLine: str("boletoDigitableLine"),
    billingType: str("billingType"),
  };
}

async function loadCheckoutAttemptBundle(db: AppDatabase, attempt: CheckoutAttemptRow) {
  const items = await db.query.marketplaceCheckoutAttemptItems.findMany({
    where: eq(marketplaceCheckoutAttemptItems.attemptId, attempt.id),
    orderBy: asc(marketplaceCheckoutAttemptItems.sortOrder),
  });
  const intentIds = items
    .map((i) => i.paymentIntentId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const intents =
    intentIds.length === 0
      ? []
      : await db.query.paymentIntents.findMany({
          where: inArray(paymentIntents.id, intentIds),
        });
  const intentById = new Map(intents.map((i) => [i.id, i]));

  return {
    checkoutId: attempt.id,
    cartId: attempt.cartId,
    status: attempt.status,
    paymentMethod: attempt.paymentMethod,
    totalCents: attempt.totalCents,
    currency: attempt.currency,
    idempotencyKey: attempt.idempotencyKey,
    lastError: attempt.lastError,
    completedAt: iso(attempt.completedAt),
    createdAt: iso(attempt.createdAt),
    updatedAt: iso(attempt.updatedAt),
    items: items.map((item) => {
      const intent = item.paymentIntentId ? intentById.get(item.paymentIntentId) : undefined;
      const meta =
        intent?.metadata && typeof intent.metadata === "object"
          ? (intent.metadata as Record<string, unknown>)
          : {};
      const instructions = paymentInstructionsFromMeta(meta);
      return {
        id: item.id,
        cartItemId: item.cartItemId,
        professionalServiceId: item.professionalServiceId,
        serviceTitle: item.serviceTitle,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        amountCents: item.amountCents,
        status: item.status,
        engagementId: item.engagementId,
        paymentIntentId: item.paymentIntentId,
        paymentStatus: intent?.status ?? null,
        checkoutUrl: instructions.checkoutUrl,
        paymentInstructions: instructions,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
      };
    }),
  };
}

async function createEngagementForCheckoutItem(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    clientId?: string | null;
    service: typeof professionalServices.$inferSelect;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
    notes?: string | null;
  },
) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [request] = await tx
      .insert(marketplaceRequests)
      .values({
        organizationId,
        requesterUserId: account.user.id,
        clientId: input.clientId ?? null,
        categoryId: input.service.categoryId,
        title: sanitizeText(input.service.title).slice(0, 180),
        description:
          input.notes?.trim() ||
          `Contratação imediata via carrinho — serviço ${input.service.id.slice(0, 8)}.`,
        urgency: "normal",
        remoteAllowed: true,
        status: "in_progress",
      })
      .returning();

    const [proposal] = await tx
      .insert(marketplaceProposals)
      .values({
        requestId: request!.id,
        professionalProfileId: input.service.professionalProfileId,
        amountCents: input.amountCents,
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
        subject: `Marketplace — ${sanitizeText(input.service.title).slice(0, 100)}`,
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
        userId: input.service.professionalProfileId,
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
        professionalProfileId: input.service.professionalProfileId,
        conversationThreadId: thread!.id,
        status: "pending_payment",
        financialStatus: "payment_processing",
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

    return engagement!.id;
  });
}

async function processCheckoutAttemptItems(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  attempt: CheckoutAttemptRow,
  paymentMethod: "pix" | "boleto" | "credit_card",
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  const now = new Date();
  await db
    .update(marketplaceCheckoutAttempts)
    .set({ status: "processing", updatedAt: now, lastError: null })
    .where(eq(marketplaceCheckoutAttempts.id, attempt.id));

  const items = await db.query.marketplaceCheckoutAttemptItems.findMany({
    where: eq(marketplaceCheckoutAttemptItems.attemptId, attempt.id),
    orderBy: asc(marketplaceCheckoutAttemptItems.sortOrder),
  });

  for (const item of items) {
    if (ITEM_PAYMENT_DONE.has(item.status)) continue;

    try {
      let working = item;

      // Claim atômico: só um worker processa pending/failed; engagement_created retoma cobrança.
      if (working.status === "pending" || working.status === "failed") {
        const [claimed] = await db
          .update(marketplaceCheckoutAttemptItems)
          .set({
            status: "processing",
            updatedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          })
          .where(
            and(
              eq(marketplaceCheckoutAttemptItems.id, working.id),
              inArray(marketplaceCheckoutAttemptItems.status, ["pending", "failed"]),
            ),
          )
          .returning();
        if (!claimed) {
          const latest = await db.query.marketplaceCheckoutAttemptItems.findFirst({
            where: eq(marketplaceCheckoutAttemptItems.id, working.id),
          });
          if (!latest || ITEM_PAYMENT_DONE.has(latest.status) || latest.status === "processing") {
            continue;
          }
          working = latest;
        } else {
          working = claimed;
        }
      }

      let engagementId = working.engagementId;
      if (!engagementId) {
        const service = await db.query.professionalServices.findFirst({
          where: eq(professionalServices.id, working.professionalServiceId),
        });
        if (!service || !service.active) {
          throw new AppError("CONFLICT", "Um serviço do carrinho deixou de estar disponível.");
        }
        const unit = serverUnitPriceCents(service);
        if (unit == null || unit !== working.unitPriceCents) {
          throw new AppError(
            "CONFLICT",
            "O preço do serviço mudou. Atualize o carrinho e tente novamente.",
          );
        }
        const expected = unit * working.quantity;
        if (expected !== working.amountCents) {
          throw new AppError("CONFLICT", "Subtotal inconsistente com o snapshot do checkout.");
        }

        engagementId = await createEngagementForCheckoutItem(db, account, organizationId, {
          clientId: attempt.clientId,
          service,
          quantity: working.quantity,
          unitPriceCents: unit,
          amountCents: working.amountCents,
        });

        await db
          .update(marketplaceCheckoutAttemptItems)
          .set({
            status: "engagement_created",
            engagementId,
            updatedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          })
          .where(eq(marketplaceCheckoutAttemptItems.id, working.id));
      }

      const payment = await initiateMarketplaceProviderPayment(
        db,
        account,
        organizationId,
        engagementId,
        { paymentMethod },
        deps,
        meta,
      );

      await db
        .update(marketplaceCheckoutAttemptItems)
        .set({
          status: "payment_initiated",
          engagementId,
          paymentIntentId: payment.paymentIntentId,
          updatedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(marketplaceCheckoutAttemptItems.id, working.id));
    } catch (error) {
      const code = error instanceof AppError ? error.code : "CHECKOUT_ITEM_FAILED";
      const message =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Falha ao processar item do checkout.";
      await db
        .update(marketplaceCheckoutAttemptItems)
        .set({
          status: "failed",
          errorCode: code,
          errorMessage: message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(marketplaceCheckoutAttemptItems.id, item.id));
      await db
        .update(marketplaceCheckoutAttempts)
        .set({ lastError: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(marketplaceCheckoutAttempts.id, attempt.id));
    }
  }

  const refreshed = await db.query.marketplaceCheckoutAttemptItems.findMany({
    where: eq(marketplaceCheckoutAttemptItems.attemptId, attempt.id),
  });
  const allOk = refreshed.every((i) => ITEM_PAYMENT_DONE.has(i.status));
  const anyOk = refreshed.some((i) => i.status === "payment_initiated");
  const anyFailed = refreshed.some((i) => i.status === "failed" || i.status === "pending");

  let nextStatus: string;
  if (allOk) nextStatus = "completed";
  else if (anyOk && anyFailed) nextStatus = "partial_failed";
  else if (!anyOk) nextStatus = "failed";
  else nextStatus = "processing";

  await db
    .update(marketplaceCheckoutAttempts)
    .set({
      status: nextStatus,
      completedAt:
        CHECKOUT_TERMINAL.has(nextStatus) || nextStatus === "partial_failed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(marketplaceCheckoutAttempts.id, attempt.id));

  if (anyOk) {
    await db
      .update(marketplaceCarts)
      .set({
        status: allOk ? "checked_out" : "checking_out",
        updatedAt: new Date(),
      })
      .where(eq(marketplaceCarts.id, attempt.cartId));
  }

  return db.query.marketplaceCheckoutAttempts.findFirst({
    where: eq(marketplaceCheckoutAttempts.id, attempt.id),
  });
}

/**
 * Checkout idempotente: snapshot de preços no servidor, tentativa persistente,
 * recuperação de falha parcial sem re-cobrar itens já processados.
 * Chamadas ao Asaas ocorrem fora de transações de banco abertas.
 */
export async function checkoutMarketplaceCart(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    paymentMethod: "pix" | "boleto" | "credit_card";
    acceptTerms: true;
    clientId?: string;
    idempotencyKey: string;
  },
  deps: MarketplaceModuleDeps,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.engagement.manage"),
  );

  const existing = await db.query.marketplaceCheckoutAttempts.findFirst({
    where: and(
      eq(marketplaceCheckoutAttempts.organizationId, organizationId),
      eq(marketplaceCheckoutAttempts.userId, account.user.id),
      eq(marketplaceCheckoutAttempts.idempotencyKey, input.idempotencyKey),
    ),
  });

  let attempt = existing ?? null;

  if (attempt && CHECKOUT_TERMINAL.has(attempt.status)) {
    const bundle = await loadCheckoutAttemptBundle(db, attempt);
    return { ...bundle, replayed: true as const };
  }

  if (attempt && (attempt.status === "processing" || attempt.status === "partial_failed")) {
    const resumed = await processCheckoutAttemptItems(
      db,
      account,
      organizationId,
      attempt,
      (attempt.paymentMethod as "pix" | "boleto" | "credit_card") || input.paymentMethod,
      deps,
      meta,
    );
    const finalAttempt = resumed ?? attempt;
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "marketplace.checkout_resumed",
      resourceType: "marketplace_checkout_attempt",
      resourceId: finalAttempt.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: finalAttempt.status },
    });
    const bundle = await loadCheckoutAttemptBundle(db, finalAttempt);
    return { ...bundle, replayed: true as const };
  }

  if (!attempt) {
    const snapshot = await getMarketplaceCart(db, account, organizationId);
    if (!snapshot.cart.checkoutReady || snapshot.items.length === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "O carrinho contém itens que exigem proposta personalizada ou está vazio. Remova serviços sob consulta antes do checkout imediato.",
      );
    }

    const lockedCart = await db.query.marketplaceCarts.findFirst({
      where: and(eq(marketplaceCarts.id, snapshot.cart.id), eq(marketplaceCarts.status, "open")),
    });
    if (!lockedCart) {
      throw new AppError(
        "CONFLICT",
        "Este carrinho já está em checkout. Consulte a tentativa existente ou use a mesma chave de idempotência.",
      );
    }

    const lineSnapshots: Array<{
      cartItemId: string;
      professionalServiceId: string;
      quantity: number;
      unitPriceCents: number;
      amountCents: number;
      serviceTitle: string;
      notes: string | null;
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
      lineSnapshots.push({
        cartItemId: item.id,
        professionalServiceId: service.id,
        quantity: item.quantity,
        unitPriceCents: unit,
        amountCents: unit * item.quantity,
        serviceTitle: sanitizeText(service.title).slice(0, 180),
        notes: item.notes ?? null,
      });
    }

    const totalCents = lineSnapshots.reduce((sum, l) => sum + l.amountCents, 0);
    const now = new Date();

    try {
      attempt = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(marketplaceCheckoutAttempts)
          .values({
            organizationId,
            cartId: snapshot.cart.id,
            userId: account.user.id,
            idempotencyKey: input.idempotencyKey,
            status: "pending",
            paymentMethod: input.paymentMethod,
            clientId: input.clientId ?? null,
            totalCents,
            currency: "BRL",
            snapshotJson: {
              items: lineSnapshots,
              paymentMethod: input.paymentMethod,
              acceptTerms: true,
            },
          })
          .returning();

        await tx.insert(marketplaceCheckoutAttemptItems).values(
          lineSnapshots.map((line, index) => ({
            attemptId: created!.id,
            organizationId,
            cartItemId: line.cartItemId,
            professionalServiceId: line.professionalServiceId,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            amountCents: line.amountCents,
            serviceTitle: line.serviceTitle,
            status: "pending",
            sortOrder: index,
          })),
        );

        await tx
          .update(marketplaceCarts)
          .set({ status: "checking_out", updatedAt: now })
          .where(eq(marketplaceCarts.id, snapshot.cart.id));

        return created!;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await db.query.marketplaceCheckoutAttempts.findFirst({
          where: and(
            eq(marketplaceCheckoutAttempts.organizationId, organizationId),
            eq(marketplaceCheckoutAttempts.userId, account.user.id),
            eq(marketplaceCheckoutAttempts.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (!raced) throw error;
        attempt = raced;
      } else {
        throw error;
      }
    }
  }

  const processed = await processCheckoutAttemptItems(
    db,
    account,
    organizationId,
    attempt,
    input.paymentMethod,
    deps,
    meta,
  );
  const finalAttempt = processed ?? attempt;

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "marketplace.cart_checked_out",
    resourceType: "marketplace_checkout_attempt",
    resourceId: finalAttempt.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      status: finalAttempt.status,
      cartId: finalAttempt.cartId,
      totalCents: finalAttempt.totalCents,
    },
  });

  const bundle = await loadCheckoutAttemptBundle(db, finalAttempt);
  return { ...bundle, replayed: false as const };
}

export async function getMarketplaceCheckoutAttempt(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  checkoutId: string,
) {
  authorize(account, organizationId, (access) =>
    policyMarketplaceEngagement(access, "marketplace.read"),
  );
  const attempt = await db.query.marketplaceCheckoutAttempts.findFirst({
    where: and(
      eq(marketplaceCheckoutAttempts.id, checkoutId),
      eq(marketplaceCheckoutAttempts.organizationId, organizationId),
      eq(marketplaceCheckoutAttempts.userId, account.user.id),
    ),
  });
  if (!attempt) {
    throw new AppError("NOT_FOUND", "Tentativa de checkout não encontrada.");
  }
  return loadCheckoutAttemptBundle(db, attempt);
}
