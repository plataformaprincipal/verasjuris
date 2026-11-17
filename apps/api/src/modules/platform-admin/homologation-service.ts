/**
 * Homologação comercial auditável — evidências SKU, aprovação live, gates de compra.
 * Nunca escreve PAYMENTS_LIVE / FEATURE_PUBLIC_CHECKOUT.
 */
import { recordAudit } from "@verasjuris/audit";
import type { SessionAccount } from "@verasjuris/auth";
import {
  monetizationProducts,
  paymentsHomologationApprovals,
  skuHomologationEvidence,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import {
  AI_MODULE_FEATURE_BINDINGS,
  COMMERCIAL_CATALOG,
  PURCHASABLE_COMMERCIAL_TYPES,
  SKU_HOMOLOGATION_CHECKS,
  getCommercialSku,
  type CreateHomologationApprovalInput,
  type RecordSkuEvidenceInput,
} from "@verasjuris/validation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import {
  buildPaymentsHomologationChecklist,
  type ActiveHomologationApprovalSummary,
  type HomologationCheckResult,
  type HomologationStaticProbes,
  type PaymentsHomologationChecklist,
} from "./homologation-checklist.js";
import { requirePlatformPermission } from "./authorize.js";

const PURCHASABLE = new Set<string>(PURCHASABLE_COMMERCIAL_TYPES);

const AI_BOUND_SKUS = new Set<string>(AI_MODULE_FEATURE_BINDINGS.map((b) => b.sku));

export type HomologationServiceDeps = {
  db: AppDatabase;
  paymentHealth?: () => Promise<{ status: string; detail?: string | null }>;
};

export type SkuCheckView = {
  key: string;
  label: string;
  required: boolean;
  auto: boolean;
  result: HomologationCheckResult;
  evidence: string;
  source: "catalog" | "admin_evidence" | "default";
};

export type SkuPurchaseReadyResult = {
  sku: string;
  purchaseReady: boolean;
  platformReadyForLive: boolean;
  status: "PURCHASE_READY" | "NOT_HOMOLOGATED" | "PENDING_EVIDENCE";
  blocking: string[];
  pendingVerification: string[];
  checks: SkuCheckView[];
};

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function paymentsLive(): boolean {
  return process.env.PAYMENTS_LIVE === "1";
}

function publicCheckout(): boolean {
  return process.env.FEATURE_PUBLIC_CHECKOUT === "1";
}

function mapStoredResult(raw: string): HomologationCheckResult {
  if (raw === "pass" || raw === "PASS") return "PASS";
  if (raw === "fail" || raw === "FAIL") return "FAIL";
  return "NOT_VERIFIED";
}

export async function findActiveApproval(
  db: AppDatabase,
  now = new Date(),
): Promise<ActiveHomologationApprovalSummary | null> {
  const rows = await db.query.paymentsHomologationApprovals.findMany({
    where: and(
      eq(paymentsHomologationApprovals.decision, "approved"),
      isNull(paymentsHomologationApprovals.supersededAt),
    ),
    orderBy: [desc(paymentsHomologationApprovals.validFrom)],
    limit: 20,
  });
  for (const row of rows) {
    if (row.validUntil && row.validUntil.getTime() < now.getTime()) continue;
    return {
      id: row.id,
      decision: "approved",
      approverUserId: row.approverUserId,
      validFrom: row.validFrom.toISOString(),
      validUntil: iso(row.validUntil),
      reason: row.reason,
    };
  }
  return null;
}

async function probeSchema(db: AppDatabase): Promise<Partial<HomologationStaticProbes>> {
  const probes: Partial<HomologationStaticProbes> = {
    refundPathExists: "PASS",
    cancelPathExists: "PASS",
    reconciliationModulePresent: "PASS",
  };
  try {
    await db.execute(sql`select 1 from payment_webhook_events limit 1`);
    probes.webhookEventsPersisted = "PASS";
  } catch {
    probes.webhookEventsPersisted = "FAIL";
  }
  try {
    const rows = await db.execute(sql`
      select 1
      from pg_indexes
      where schemaname = 'public'
        and indexname = 'payment_intents_idempotency_unique'
      limit 1
    `);
    const found = Array.isArray(rows)
      ? rows.length > 0
      : ((rows as { rows?: unknown[] }).rows?.length ?? 0) > 0;
    probes.paymentIntentsIdempotency = found ? "PASS" : "FAIL";
  } catch {
    probes.paymentIntentsIdempotency = "NOT_VERIFIED";
  }
  return probes;
}

export async function buildLiveChecklist(
  deps: HomologationServiceDeps,
): Promise<PaymentsHomologationChecklist> {
  const paymentHealth = deps.paymentHealth
    ? await deps.paymentHealth()
    : { status: "not_configured", detail: "Provider não injetado." };
  const [activeApproval, probes] = await Promise.all([
    findActiveApproval(deps.db),
    probeSchema(deps.db),
  ]);
  return buildPaymentsHomologationChecklist({
    paymentProviderMode: process.env.PAYMENT_PROVIDER ?? "not_configured",
    billingProviderMode: process.env.BILLING_PROVIDER ?? "not_configured",
    asaasEnvironment: process.env.ASAAS_ENVIRONMENT ?? null,
    asaasApiKeyPresent: Boolean(process.env.ASAAS_API_KEY?.trim()),
    asaasWebhookTokenPresent: Boolean(process.env.ASAAS_WEBHOOK_TOKEN?.trim()),
    paymentsLive: paymentsLive(),
    publicCheckout: publicCheckout(),
    paymentHealthStatus: paymentHealth.status,
    paymentHealthDetail: paymentHealth.detail ?? null,
    isProduction: process.env.NODE_ENV === "production",
    probes,
    activeApproval,
  });
}

export async function getHomologationChecklist(
  deps: HomologationServiceDeps,
  account: SessionAccount,
): Promise<PaymentsHomologationChecklist> {
  requirePlatformPermission(account, "platform.integrations.read");
  return buildLiveChecklist(deps);
}

function autoSkuChecks(skuCode: string): SkuCheckView[] {
  const def = getCommercialSku(skuCode);
  const views: SkuCheckView[] = [];

  for (const defCheck of SKU_HOMOLOGATION_CHECKS) {
    if (!defCheck.auto) continue;
    let result: HomologationCheckResult = "NOT_VERIFIED";
    let evidence = "sem definição de catálogo";

    if (!def) {
      result = defCheck.key === "not_not_implemented" ? "FAIL" : "NOT_VERIFIED";
      evidence = "sku_unknown";
    } else if (defCheck.key === "price_defined") {
      const ok = def.requiresProposal || def.priceMode === "proposal" || def.amountCents > 0;
      result = ok ? "PASS" : "FAIL";
      evidence = `amountCents=${def.amountCents}; priceMode=${def.priceMode}`;
    } else if (defCheck.key === "not_not_implemented") {
      result = def.homologationStatus === "not_implemented" ? "FAIL" : "PASS";
      evidence = `homologationStatus=${def.homologationStatus}`;
    } else if (defCheck.key === "entitlements_or_credits") {
      const ok =
        (def.entitlements?.length ?? 0) > 0 ||
        (typeof def.creditsGranted === "number" && def.creditsGranted > 0);
      result = ok ? "PASS" : "NOT_VERIFIED";
      evidence = `entitlements=${def.entitlements?.length ?? 0}; credits=${def.creditsGranted ?? 0}`;
    } else if (defCheck.key === "feature_binding") {
      if (def.commercialType !== "ai_module") {
        result = "PASS";
        evidence = "n/a_non_ai_module";
      } else {
        const bound = AI_BOUND_SKUS.has(skuCode);
        result = bound ? "PASS" : "FAIL";
        evidence = bound ? "bound" : "missing_binding";
      }
    } else if (defCheck.key === "cart_or_service_flow") {
      const ok = PURCHASABLE.has(def.commercialType) || def.commercialType === "service";
      result = ok ? "PASS" : "FAIL";
      evidence = `commercialType=${def.commercialType}`;
    }

    views.push({
      key: defCheck.key,
      label: defCheck.label,
      required: defCheck.required,
      auto: true,
      result,
      evidence,
      source: "catalog",
    });
  }

  for (const defCheck of SKU_HOMOLOGATION_CHECKS) {
    if (defCheck.auto) continue;
    views.push({
      key: defCheck.key,
      label: defCheck.label,
      required: defCheck.required,
      auto: false,
      result: "NOT_VERIFIED",
      evidence: "aguardando evidência admin",
      source: "default",
    });
  }

  return views;
}

async function loadSkuEvidenceMap(
  db: AppDatabase,
  skuCode: string,
): Promise<Map<string, { result: HomologationCheckResult; notes: string | null }>> {
  const rows = await db.query.skuHomologationEvidence.findMany({
    where: and(
      eq(skuHomologationEvidence.skuCode, skuCode),
      isNull(skuHomologationEvidence.supersededAt),
    ),
  });
  const map = new Map<string, { result: HomologationCheckResult; notes: string | null }>();
  for (const row of rows) {
    map.set(row.checkKey, { result: mapStoredResult(row.result), notes: row.notes });
  }
  return map;
}

export async function computeSkuPurchaseReady(
  deps: HomologationServiceDeps,
  skuCode: string,
  platformChecklist?: PaymentsHomologationChecklist,
): Promise<SkuPurchaseReadyResult> {
  const checklist = platformChecklist ?? (await buildLiveChecklist(deps));
  const checks = autoSkuChecks(skuCode);
  const evidence = await loadSkuEvidenceMap(deps.db, skuCode);

  for (const check of checks) {
    const ev = evidence.get(check.key);
    if (!ev) continue;
    check.result = ev.result;
    check.evidence = ev.notes ?? `admin_evidence=${ev.result}`;
    check.source = "admin_evidence";
  }

  const required = checks.filter((c) => c.required);
  const blocking = required.filter((c) => c.result === "FAIL").map((c) => c.key);
  const pendingVerification = required.filter((c) => c.result === "NOT_VERIFIED").map((c) => c.key);
  const skuOk = blocking.length === 0 && pendingVerification.length === 0;
  const purchaseReady = checklist.readyForLive && skuOk;

  let status: SkuPurchaseReadyResult["status"] = "NOT_HOMOLOGATED";
  if (purchaseReady) status = "PURCHASE_READY";
  else if (pendingVerification.length > 0 || checklist.status === "PENDING_EVIDENCE") {
    status = "PENDING_EVIDENCE";
  }

  return {
    sku: skuCode,
    purchaseReady,
    platformReadyForLive: checklist.readyForLive,
    status,
    blocking: [...(checklist.readyForLive ? [] : ["platform_not_ready"]), ...blocking],
    pendingVerification: [
      ...(checklist.pendingVerification.length && !checklist.readyForLive
        ? ["platform_pending"]
        : []),
      ...pendingVerification,
    ],
    checks,
  };
}

export async function listSkuHomologationMatrix(deps: HomologationServiceDeps): Promise<{
  checklist: PaymentsHomologationChecklist;
  skus: SkuPurchaseReadyResult[];
}> {
  const checklist = await buildLiveChecklist(deps);
  const skus: SkuPurchaseReadyResult[] = [];
  for (const item of COMMERCIAL_CATALOG) {
    skus.push(await computeSkuPurchaseReady(deps, item.sku, checklist));
  }
  return { checklist, skus };
}

export async function getEvidenceReport(deps: HomologationServiceDeps, account: SessionAccount) {
  requirePlatformPermission(account, "platform.integrations.read");
  const { checklist, skus } = await listSkuHomologationMatrix(deps);
  return {
    generatedAt: new Date().toISOString(),
    checklist,
    skuSummary: {
      total: skus.length,
      purchaseReady: skus.filter((s) => s.purchaseReady).length,
      pendingEvidence: skus.filter((s) => s.status === "PENDING_EVIDENCE").length,
      notHomologated: skus.filter((s) => s.status === "NOT_HOMOLOGATED").length,
    },
    skus,
  };
}

export async function getSkuEvidence(
  deps: HomologationServiceDeps,
  account: SessionAccount,
  skuCode: string,
) {
  requirePlatformPermission(account, "platform.commercial.homologate");
  const ready = await computeSkuPurchaseReady(deps, skuCode);
  const rows = await deps.db.query.skuHomologationEvidence.findMany({
    where: eq(skuHomologationEvidence.skuCode, skuCode),
    orderBy: [desc(skuHomologationEvidence.recordedAt)],
    limit: 100,
  });
  return {
    ...ready,
    history: rows.map((r) => ({
      id: r.id,
      checkKey: r.checkKey,
      result: r.result,
      notes: r.notes,
      evidenceJson: r.evidenceJson,
      recordedByUserId: r.recordedByUserId,
      recordedAt: r.recordedAt.toISOString(),
      supersededAt: iso(r.supersededAt),
    })),
  };
}

export async function recordSkuEvidence(
  deps: HomologationServiceDeps,
  account: SessionAccount,
  skuCode: string,
  input: RecordSkuEvidenceInput,
  meta: RequestMeta,
) {
  requirePlatformPermission(account, "platform.commercial.homologate");
  const known = SKU_HOMOLOGATION_CHECKS.some((c) => c.key === input.checkKey);
  if (!known) {
    throw new AppError("VALIDATION_ERROR", `checkKey desconhecido: ${input.checkKey}`);
  }
  if (!getCommercialSku(skuCode)) {
    throw new AppError("VALIDATION_ERROR", `SKU desconhecido: ${skuCode}`);
  }

  const product = await deps.db.query.monetizationProducts.findFirst({
    where: eq(monetizationProducts.key, skuCode),
  });

  const existing = await deps.db.query.skuHomologationEvidence.findMany({
    where: and(
      eq(skuHomologationEvidence.skuCode, skuCode),
      eq(skuHomologationEvidence.checkKey, input.checkKey),
      isNull(skuHomologationEvidence.supersededAt),
    ),
  });
  const now = new Date();
  for (const row of existing) {
    await deps.db
      .update(skuHomologationEvidence)
      .set({ supersededAt: now, updatedAt: now })
      .where(eq(skuHomologationEvidence.id, row.id));
  }

  const [created] = await deps.db
    .insert(skuHomologationEvidence)
    .values({
      skuCode,
      productId: product?.id ?? null,
      checkKey: input.checkKey,
      result: input.result,
      evidenceJson: (input.evidenceJson ?? {}) as Record<string, unknown>,
      notes: input.notes ?? null,
      recordedByUserId: account.user.id,
      recordedAt: now,
    })
    .returning();

  await recordAudit(deps.db, {
    actorUserId: account.user.id,
    organizationId: null,
    action: "platform.commerce.sku_evidence_recorded",
    resourceType: "sku_homologation_evidence",
    resourceId: created!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      skuCode,
      checkKey: input.checkKey,
      result: input.result,
    },
  });

  return {
    evidence: {
      id: created!.id,
      skuCode,
      checkKey: input.checkKey,
      result: input.result,
      recordedAt: created!.recordedAt.toISOString(),
    },
    readiness: await computeSkuPurchaseReady(deps, skuCode),
  };
}

export async function createHomologationApproval(
  deps: HomologationServiceDeps,
  account: SessionAccount,
  input: CreateHomologationApprovalInput,
  meta: RequestMeta,
) {
  requirePlatformPermission(account, "platform.payments.approve");

  const checklistBefore = await buildLiveChecklist(deps);
  const blockingWithoutApproval = checklistBefore.checks
    .filter((c) => c.required && c.key !== "admin_approval" && c.result !== "PASS")
    .map((c) => c.key);

  if (blockingWithoutApproval.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Checklist ainda possui pendências/fails (exceto aprovação). Não é possível aprovar.",
      blockingWithoutApproval.map((key) => ({ path: key, message: "not_pass" })),
    );
  }

  const now = new Date();
  const active = await deps.db.query.paymentsHomologationApprovals.findMany({
    where: and(
      eq(paymentsHomologationApprovals.decision, "approved"),
      isNull(paymentsHomologationApprovals.supersededAt),
    ),
  });
  for (const row of active) {
    await deps.db
      .update(paymentsHomologationApprovals)
      .set({ supersededAt: now, updatedAt: now })
      .where(eq(paymentsHomologationApprovals.id, row.id));
  }

  const validUntil = input.validUntil ? new Date(input.validUntil) : null;
  const [created] = await deps.db
    .insert(paymentsHomologationApprovals)
    .values({
      decision: "approved",
      reason: input.reason,
      approverUserId: account.user.id,
      checklistSnapshot: checklistBefore as unknown as Record<string, unknown>,
      blockingAtDecision: checklistBefore.blocking,
      validFrom: now,
      validUntil,
    })
    .returning();

  await recordAudit(deps.db, {
    actorUserId: account.user.id,
    organizationId: null,
    action: "platform.payments.approval_created",
    resourceType: "payments_homologation_approval",
    resourceId: created!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      decision: "approved",
      validUntil: iso(validUntil),
      note: "Não altera PAYMENTS_LIVE",
    },
  });

  const checklist = await buildLiveChecklist(deps);
  return {
    approval: {
      id: created!.id,
      decision: created!.decision,
      reason: created!.reason,
      validFrom: created!.validFrom.toISOString(),
      validUntil: iso(created!.validUntil),
    },
    checklist,
    envNote: "Aprovação DB registrada. PAYMENTS_LIVE continua controlado só por env/ops.",
  };
}

export async function revokeHomologationApproval(
  deps: HomologationServiceDeps,
  account: SessionAccount,
  input: { reason: string; approvalId?: string },
  meta: RequestMeta,
) {
  requirePlatformPermission(account, "platform.payments.approve");
  const now = new Date();

  const active = await deps.db.query.paymentsHomologationApprovals.findMany({
    where: and(
      eq(paymentsHomologationApprovals.decision, "approved"),
      isNull(paymentsHomologationApprovals.supersededAt),
    ),
  });
  const targets = input.approvalId ? active.filter((a) => a.id === input.approvalId) : active;
  if (targets.length === 0) {
    throw new AppError("NOT_FOUND", "Nenhuma aprovação ativa para revogar.");
  }

  for (const row of targets) {
    await deps.db
      .update(paymentsHomologationApprovals)
      .set({ supersededAt: now, updatedAt: now })
      .where(eq(paymentsHomologationApprovals.id, row.id));
  }

  const checklist = await buildLiveChecklist(deps);
  const [revoked] = await deps.db
    .insert(paymentsHomologationApprovals)
    .values({
      decision: "revoked",
      reason: input.reason,
      approverUserId: account.user.id,
      checklistSnapshot: checklist as unknown as Record<string, unknown>,
      blockingAtDecision: checklist.blocking,
      validFrom: now,
      validUntil: now,
    })
    .returning();

  await recordAudit(deps.db, {
    actorUserId: account.user.id,
    organizationId: null,
    action: "platform.payments.approval_revoked",
    resourceType: "payments_homologation_approval",
    resourceId: revoked!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: {
      revokedIds: targets.map((t) => t.id),
      reason: input.reason,
    },
  });

  return {
    revocation: {
      id: revoked!.id,
      decision: "revoked" as const,
      reason: input.reason,
    },
    checklist: await buildLiveChecklist(deps),
  };
}

/** Gate serializado para respostas commerce (não hardcode false). */
export async function resolvePurchaseGate(deps: HomologationServiceDeps) {
  const checklist = await buildLiveChecklist(deps);
  return {
    purchaseReady: checklist.purchaseReady,
    paymentsLive: checklist.paymentsLive,
    homologation: checklist.status,
    readyForLive: checklist.readyForLive,
    note: checklist.paymentsLiveInsufficientWithoutApproval
      ? "PAYMENTS_LIVE=1 sem aprovação DB — checkout comercial bloqueado."
      : checklist.readyForLive
        ? "Plataforma homologada (aprovação DB ativa). SKUs ainda exigem evidência individual."
        : "Homologação incompleta — compra comercial bloqueada até checklist PASS + aprovação.",
    blocking: checklist.blocking,
    pendingVerification: checklist.pendingVerification,
  };
}

export async function assertSkuPurchasable(
  deps: HomologationServiceDeps,
  skuCode: string,
): Promise<SkuPurchaseReadyResult> {
  const ready = await computeSkuPurchaseReady(deps, skuCode);
  if (!ready.purchaseReady) {
    throw new AppError(
      "VALIDATION_ERROR",
      `SKU ${skuCode} não homologado para compra (${ready.status}).`,
      [
        { path: "sku", message: ready.status },
        ...ready.blocking.map((b) => ({ path: "blocking", message: b })),
        ...ready.pendingVerification.map((p) => ({ path: "pending", message: p })),
      ],
    );
  }
  return ready;
}

export async function assertPlatformPurchaseReady(deps: HomologationServiceDeps) {
  const checklist = await buildLiveChecklist(deps);
  if (!checklist.readyForLive) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Checkout comercial bloqueado: plataforma não homologada (checklist + aprovação DB).",
      [
        ...checklist.blocking.map((b) => ({ path: "blocking", message: b })),
        ...checklist.pendingVerification.map((p) => ({ path: "pending", message: p })),
      ],
    );
  }
  if (checklist.paymentsLiveInsufficientWithoutApproval) {
    throw new AppError(
      "VALIDATION_ERROR",
      "PAYMENTS_LIVE=1 é insuficiente sem aprovação administrativa ativa.",
    );
  }
  return checklist;
}
