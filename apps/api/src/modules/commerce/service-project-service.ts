import { recordAudit } from "@verasjuris/audit";
import { policyMonetization, policyPaymentIntent, type SessionAccount } from "@verasjuris/auth";
import {
  commerceServiceMilestones,
  commerceServiceProjects,
  monetizationProducts,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import {
  getCommercialSku,
  splitServiceMilestoneCents,
  type CheckoutCommerceCartInput,
} from "@verasjuris/validation";
import { and, asc, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import type { CheckoutService } from "../finance/checkout-service.js";
import {
  assertPlatformPurchaseReady,
  assertSkuPurchasable,
  resolvePurchaseGate,
} from "../platform-admin/homologation-service.js";
import { ensureCommercialCatalogSeeded } from "./catalog-sync.js";

async function serviceGate(db: AppDatabase) {
  const gate = await resolvePurchaseGate({ db });
  return {
    purchaseReady: gate.purchaseReady,
    homologation: gate.homologation,
  };
}

function serializeProject(row: typeof commerceServiceProjects.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requesterUserId: row.requesterUserId,
    sku: row.skuCode,
    productId: row.productId,
    status: row.status,
    totalCents: row.totalCents,
    currency: row.currency,
    requiresProposal: row.requiresProposal,
    notes: row.notes,
    acceptedAt: iso(row.acceptedAt),
    deliveredAt: iso(row.deliveredAt),
    deliveryAcceptedAt: iso(row.deliveryAcceptedAt),
    deliverySummary: row.deliverySummary,
    deliveryArtifactUrl: row.deliveryArtifactUrl,
    metadata: row.metadataJson,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function serializeMilestone(row: typeof commerceServiceMilestones.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind,
    label: row.label,
    pctBps: row.pctBps,
    amountCents: row.amountCents,
    status: row.status,
    paymentIntentId: row.paymentIntentId,
    paidAt: iso(row.paidAt),
    dueAt: iso(row.dueAt),
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function loadProjectBundle(db: AppDatabase, organizationId: string, projectId: string) {
  const project = await db.query.commerceServiceProjects.findFirst({
    where: and(
      eq(commerceServiceProjects.id, projectId),
      eq(commerceServiceProjects.organizationId, organizationId),
    ),
  });
  if (!project) throw new AppError("NOT_FOUND", "Projeto de serviço não encontrado.");
  const milestones = await db.query.commerceServiceMilestones.findMany({
    where: eq(commerceServiceMilestones.projectId, project.id),
    orderBy: [asc(commerceServiceMilestones.sortOrder)],
  });
  return { project, milestones };
}

export async function createServiceProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { sku: string; notes?: string; proposedAmountCents?: number },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  await ensureCommercialCatalogSeeded(db);

  const sku = input.sku.trim().toUpperCase();
  const def = getCommercialSku(sku);
  if (!def || def.commercialType !== "service") {
    throw new AppError("NOT_FOUND", `SKU de serviço não encontrado: ${sku}`);
  }
  const product = await db.query.monetizationProducts.findFirst({
    where: eq(monetizationProducts.key, sku),
    with: { prices: true },
  });

  let totalCents = def.amountCents;
  if (def.requiresProposal || def.priceMode === "proposal" || def.priceMode === "starting_at") {
    if (!input.proposedAmountCents || input.proposedAmountCents <= 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Informe proposedAmountCents para serviço sob proposta / starting_at.",
        [{ path: "proposedAmountCents", message: "required" }],
      );
    }
    if (def.priceMode === "starting_at" && input.proposedAmountCents < def.amountCents) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Valor proposto abaixo do mínimo do catálogo (${def.amountCents} centavos).`,
      );
    }
    totalCents = input.proposedAmountCents;
  } else {
    const activePrice = [...(product?.prices ?? [])]
      .filter((p) => p.active)
      .sort((a, b) => b.version - a.version)[0];
    totalCents = activePrice?.amountCents ?? def.amountCents;
  }

  if (totalCents <= 0) {
    throw new AppError("VALIDATION_ERROR", "Valor total do serviço inválido.");
  }

  const { depositCents, deliveryCents } = splitServiceMilestoneCents(totalCents);
  const [project] = await db
    .insert(commerceServiceProjects)
    .values({
      organizationId,
      requesterUserId: account.user.id,
      skuCode: sku,
      productId: product?.id ?? null,
      status: "proposed",
      totalCents,
      currency: "BRL",
      requiresProposal: def.requiresProposal,
      notes: input.notes ?? null,
      metadataJson: {
        commercialVersion: "2026-09",
        refundPolicyKey: def.refundPolicyKey,
        homologation: "NOT_HOMOLOGATED",
      },
    })
    .returning();

  await db.insert(commerceServiceMilestones).values([
    {
      projectId: project!.id,
      organizationId,
      kind: "deposit_30",
      label: "Sinal 30%",
      pctBps: 3000,
      amountCents: depositCents,
      status: "pending",
      sortOrder: 10,
    },
    {
      projectId: project!.id,
      organizationId,
      kind: "delivery_70",
      label: "Entrega 70%",
      pctBps: 7000,
      amountCents: deliveryCents,
      status: "locked",
      sortOrder: 20,
    },
  ]);

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.service_proposal_created",
    resourceType: "commerce_service_project",
    resourceId: project!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { sku, totalCents },
  });

  return getServiceProject(db, account, organizationId, project!.id);
}

export async function acceptServiceProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  projectId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const { project, milestones } = await loadProjectBundle(db, organizationId, projectId);
  if (project.status !== "proposed") {
    throw new AppError("CONFLICT", "Somente propostas em status proposed podem ser aceitas.");
  }

  const [updated] = await db
    .update(commerceServiceProjects)
    .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(commerceServiceProjects.id, project.id))
    .returning();

  // Libera checkout do sinal 30%.
  const deposit = milestones.find((m) => m.kind === "deposit_30");
  if (deposit && deposit.status === "pending") {
    await db
      .update(commerceServiceMilestones)
      .set({ status: "awaiting_payment", updatedAt: new Date() })
      .where(eq(commerceServiceMilestones.id, deposit.id));
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.service_proposal_accepted",
    resourceType: "commerce_service_project",
    resourceId: project.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return {
    project: serializeProject(updated!),
    milestones: (await loadProjectBundle(db, organizationId, projectId)).milestones.map(
      serializeMilestone,
    ),
    ...(await serviceGate(db)),
  };
}

export async function getServiceProject(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  projectId: string,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const { project, milestones } = await loadProjectBundle(db, organizationId, projectId);
  return {
    project: serializeProject(project),
    milestones: milestones.map(serializeMilestone),
    ...(await serviceGate(db)),
  };
}

export async function listServiceProjects(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  limit = 30,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const rows = await db.query.commerceServiceProjects.findMany({
    where: eq(commerceServiceProjects.organizationId, organizationId),
    orderBy: [desc(commerceServiceProjects.createdAt)],
    limit: Math.min(100, Math.max(1, limit)),
  });
  return {
    projects: rows.map(serializeProject),
    ...(await serviceGate(db)),
  };
}

export async function checkoutServiceMilestone(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  projectId: string,
  milestoneId: string,
  input: CheckoutCommerceCartInput,
  meta: RequestMeta,
  checkoutService: CheckoutService,
) {
  authorize(account, organizationId, (m) => policyPaymentIntent(m, "finance.payment.read"));
  await assertPlatformPurchaseReady({ db });
  const { project, milestones } = await loadProjectBundle(db, organizationId, projectId);
  await assertSkuPurchasable({ db }, project.skuCode);
  const milestone = milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new AppError("NOT_FOUND", "Marco não encontrado.");

  if (project.status === "proposed") {
    throw new AppError("CONFLICT", "Aceite a proposta antes do checkout.");
  }
  if (
    milestone.kind === "deposit_30" &&
    !["awaiting_payment", "pending"].includes(milestone.status)
  ) {
    if (milestone.status === "paid") {
      throw new AppError("CONFLICT", "Sinal 30% já pago.");
    }
  }
  if (milestone.kind === "delivery_70") {
    if (project.status !== "delivered" && project.status !== "delivery_accepted") {
      throw new AppError(
        "CONFLICT",
        "Marco de 70% só libera após entrega registrada (e tipicamente aceite).",
      );
    }
    if (milestone.status === "locked") {
      throw new AppError("CONFLICT", "Marco 70% ainda bloqueado — aceite a entrega.");
    }
  }
  if (
    !["awaiting_payment", "pending", "invoiced"].includes(milestone.status) &&
    milestone.status !== "paid"
  ) {
    // allow awaiting_payment / invoiced
  }
  if (milestone.status === "paid") {
    throw new AppError("CONFLICT", "Marco já pago.");
  }
  if (milestone.amountCents <= 0) {
    throw new AppError("VALIDATION_ERROR", "Valor do marco inválido.");
  }

  const checkout = await checkoutService.checkout(
    account,
    organizationId,
    {
      payerType: "organization",
      payerId: organizationId,
      referenceType: "commerce_service_milestone",
      referenceId: milestone.id,
      amountCents: milestone.amountCents,
      currency: "BRL",
      paymentMethod: input.paymentMethod,
      description: `${project.skuCode} — ${milestone.label}`,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      idempotencyKey: `svc_ms:${input.idempotencyKey}`,
      createInvoiceIfMissing: true,
      metadata: {
        commerceServiceProjectId: project.id,
        milestoneKind: milestone.kind,
        sku: project.skuCode,
        homologation: "NOT_HOMOLOGATED",
        paymentsLive: process.env.PAYMENTS_LIVE === "1" ? "1" : "0",
      },
    },
    meta,
  );

  await db
    .update(commerceServiceMilestones)
    .set({
      status: "invoiced",
      paymentIntentId: checkout.paymentIntent.id,
      updatedAt: new Date(),
    })
    .where(eq(commerceServiceMilestones.id, milestone.id));

  if (project.status === "accepted" && milestone.kind === "deposit_30") {
    await db
      .update(commerceServiceProjects)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(commerceServiceProjects.id, project.id));
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.service_milestone_checkout",
    resourceType: "commerce_service_milestone",
    resourceId: milestone.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      amountCents: milestone.amountCents,
      paymentIntentId: checkout.paymentIntent.id,
      unavailable: checkout.unavailable,
    },
  });

  return {
    project: serializeProject((await loadProjectBundle(db, organizationId, projectId)).project),
    milestone: serializeMilestone({
      ...milestone,
      status: "invoiced",
      paymentIntentId: checkout.paymentIntent.id,
    }),
    paymentIntent: checkout.paymentIntent,
    checkout: checkout.checkout,
    providerStatus: checkout.providerStatus,
    unavailable: checkout.unavailable,
    ...(await serviceGate(db)),
  };
}

export async function submitServiceDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  projectId: string,
  input: { summary: string; artifactUrl?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.product.manage"));
  const { project } = await loadProjectBundle(db, organizationId, projectId);
  if (!["accepted", "in_progress", "delivered"].includes(project.status)) {
    throw new AppError("CONFLICT", "Projeto não está em estado de entrega.");
  }

  const [updated] = await db
    .update(commerceServiceProjects)
    .set({
      status: "delivered",
      deliveredAt: new Date(),
      deliverySummary: input.summary,
      deliveryArtifactUrl: input.artifactUrl ?? null,
      updatedAt: new Date(),
    })
    .where(eq(commerceServiceProjects.id, project.id))
    .returning();

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.service_delivery_submitted",
    resourceType: "commerce_service_project",
    resourceId: project.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return {
    project: serializeProject(updated!),
    ...(await serviceGate(db)),
  };
}

export async function acceptServiceDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  projectId: string,
  input: { accept: boolean; notes?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
  const { project, milestones } = await loadProjectBundle(db, organizationId, projectId);
  if (project.status !== "delivered") {
    throw new AppError("CONFLICT", "Não há entrega pendente de aceite.");
  }

  if (!input.accept) {
    const [updated] = await db
      .update(commerceServiceProjects)
      .set({
        status: "in_progress",
        deliveredAt: null,
        deliverySummary: input.notes ? `Rejeitado: ${input.notes}` : project.deliverySummary,
        updatedAt: new Date(),
      })
      .where(eq(commerceServiceProjects.id, project.id))
      .returning();
    await recordAudit(db, {
      actorUserId: account.user.id,
      organizationId,
      action: "commerce.service_delivery_rejected",
      resourceType: "commerce_service_project",
      resourceId: project.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      project: serializeProject(updated!),
      milestones: milestones.map(serializeMilestone),
      ...(await serviceGate(db)),
    };
  }

  const [updated] = await db
    .update(commerceServiceProjects)
    .set({
      status: "delivery_accepted",
      deliveryAcceptedAt: new Date(),
      updatedAt: new Date(),
      metadataJson: {
        ...(project.metadataJson ?? {}),
        deliveryAcceptNotes: input.notes ?? null,
      },
    })
    .where(eq(commerceServiceProjects.id, project.id))
    .returning();

  const deliveryMs = milestones.find((m) => m.kind === "delivery_70");
  if (deliveryMs && deliveryMs.status !== "paid") {
    await db
      .update(commerceServiceMilestones)
      .set({ status: "awaiting_payment", updatedAt: new Date() })
      .where(eq(commerceServiceMilestones.id, deliveryMs.id));
  }

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "commerce.service_delivery_accepted",
    resourceType: "commerce_service_project",
    resourceId: project.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });

  return getServiceProject(db, account, organizationId, projectId);
}

/** Marca marco como pago após confirmPayment (webhook). */
export async function markServiceMilestonePaid(
  db: AppDatabase,
  input: { organizationId: string; milestoneId: string; paymentIntentId: string },
) {
  const milestone = await db.query.commerceServiceMilestones.findFirst({
    where: and(
      eq(commerceServiceMilestones.id, input.milestoneId),
      eq(commerceServiceMilestones.organizationId, input.organizationId),
    ),
  });
  if (!milestone) return { updated: false as const };
  if (milestone.status === "paid") return { updated: false as const, alreadyPaid: true as const };

  await db
    .update(commerceServiceMilestones)
    .set({
      status: "paid",
      paidAt: new Date(),
      paymentIntentId: input.paymentIntentId,
      updatedAt: new Date(),
    })
    .where(eq(commerceServiceMilestones.id, milestone.id));

  const project = await db.query.commerceServiceProjects.findFirst({
    where: eq(commerceServiceProjects.id, milestone.projectId),
  });
  if (project) {
    const all = await db.query.commerceServiceMilestones.findMany({
      where: eq(commerceServiceMilestones.projectId, project.id),
    });
    const allPaid = all.every((m) => (m.id === milestone.id ? true : m.status === "paid"));
    if (allPaid) {
      await db
        .update(commerceServiceProjects)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(commerceServiceProjects.id, project.id));
    } else if (milestone.kind === "deposit_30" && project.status === "accepted") {
      await db
        .update(commerceServiceProjects)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(commerceServiceProjects.id, project.id));
    }
  }

  await recordAudit(db, {
    actorUserId: null,
    organizationId: input.organizationId,
    action: "commerce.service_milestone_paid",
    resourceType: "commerce_service_milestone",
    resourceId: milestone.id,
    source: "system",
    after: { paymentIntentId: input.paymentIntentId, kind: milestone.kind },
  });

  return { updated: true as const, kind: milestone.kind };
}
