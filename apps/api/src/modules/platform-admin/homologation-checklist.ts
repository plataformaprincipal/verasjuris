/**
 * Checklist de homologação comercial Asaas — PASS / FAIL / NOT_VERIFIED.
 * Nunca escreve PAYMENTS_LIVE. readyForLive exige checks required PASS + aprovação DB.
 */

export type HomologationCheckResult = "PASS" | "FAIL" | "NOT_VERIFIED";

export type HomologationCheck = {
  key: string;
  label: string;
  result: HomologationCheckResult;
  /** Compat: true somente quando result === PASS */
  ok: boolean;
  required: boolean;
  evidence: string;
};

export type ActiveHomologationApprovalSummary = {
  id: string;
  decision: "approved";
  approverUserId: string;
  validFrom: string;
  validUntil: string | null;
  reason: string;
};

export type PaymentsHomologationChecklist = {
  generatedAt: string;
  readyForLive: boolean;
  paymentsLive: boolean;
  publicCheckout: boolean;
  /** Gate global de compra = readyForLive (SKU ainda exige evidência própria). */
  purchaseReady: boolean;
  status: "READY_FOR_LIVE" | "NOT_HOMOLOGATED" | "PENDING_EVIDENCE";
  note: string;
  checks: HomologationCheck[];
  blocking: string[];
  pendingVerification: string[];
  passedRequired: number;
  requiredTotal: number;
  activeApproval: ActiveHomologationApprovalSummary | null;
  /** Env sozinho nunca libera compra comercial. */
  paymentsLiveInsufficientWithoutApproval: boolean;
};

export type HomologationStaticProbes = {
  webhookEventsPersisted: HomologationCheckResult;
  paymentIntentsIdempotency: HomologationCheckResult;
  refundPathExists: HomologationCheckResult;
  cancelPathExists: HomologationCheckResult;
  reconciliationModulePresent: HomologationCheckResult;
};

export type HomologationChecklistInput = {
  paymentProviderMode: string;
  billingProviderMode?: string;
  asaasEnvironment?: string | null;
  asaasApiKeyPresent: boolean;
  asaasWebhookTokenPresent: boolean;
  paymentsLive: boolean;
  publicCheckout: boolean;
  paymentHealthStatus: string;
  paymentHealthDetail?: string | null;
  isProduction: boolean;
  probes?: Partial<HomologationStaticProbes>;
  activeApproval?: ActiveHomologationApprovalSummary | null;
};

function check(
  key: string,
  label: string,
  result: HomologationCheckResult,
  required: boolean,
  evidence: string,
): HomologationCheck {
  return { key, label, result, ok: result === "PASS", required, evidence };
}

function passFail(ok: boolean): HomologationCheckResult {
  return ok ? "PASS" : "FAIL";
}

/** Probes estáticos do código — existem no monorepo; não inventam cobranças. */
export const CODE_PATH_PROBES: HomologationStaticProbes = {
  webhookEventsPersisted: "NOT_VERIFIED",
  paymentIntentsIdempotency: "NOT_VERIFIED",
  refundPathExists: "PASS",
  cancelPathExists: "PASS",
  reconciliationModulePresent: "PASS",
};

export function buildPaymentsHomologationChecklist(
  input: HomologationChecklistInput,
): PaymentsHomologationChecklist {
  const probes: HomologationStaticProbes = {
    ...CODE_PATH_PROBES,
    ...input.probes,
  };
  const activeApproval = input.activeApproval ?? null;
  const approvalActive = activeApproval != null;

  const asaasEnv = input.asaasEnvironment ?? "sandbox";
  const sandboxOk =
    asaasEnv !== "production" || (input.paymentHealthStatus === "ok" && approvalActive);

  const checks: HomologationCheck[] = [
    check(
      "payment_provider_asaas",
      "PAYMENT_PROVIDER=asaas",
      passFail(input.paymentProviderMode === "asaas"),
      true,
      `mode=${input.paymentProviderMode}`,
    ),
    check(
      "asaas_api_key",
      "ASAAS_API_KEY presente",
      passFail(input.asaasApiKeyPresent),
      true,
      input.asaasApiKeyPresent ? "present" : "missing",
    ),
    check(
      "asaas_webhook_token",
      "ASAAS_WEBHOOK_TOKEN presente",
      passFail(input.asaasWebhookTokenPresent),
      true,
      input.asaasWebhookTokenPresent ? "present" : "missing",
    ),
    check(
      "payment_health",
      "PaymentProvider healthCheck",
      passFail(input.paymentHealthStatus === "ok" || input.paymentHealthStatus === "degraded"),
      true,
      `${input.paymentHealthStatus}${input.paymentHealthDetail ? `: ${input.paymentHealthDetail}` : ""}`,
    ),
    check(
      "sandbox_environment",
      "ASAAS_ENVIRONMENT sandbox (ou evidência de prod)",
      passFail(sandboxOk),
      true,
      `ASAAS_ENVIRONMENT=${asaasEnv}`,
    ),
    check(
      "webhook_events_persisted",
      "Tabela payment_webhook_events disponível",
      probes.webhookEventsPersisted,
      true,
      `probe=${probes.webhookEventsPersisted}`,
    ),
    check(
      "payment_intents_idempotency",
      "Idempotência de payment_intents",
      probes.paymentIntentsIdempotency,
      true,
      `probe=${probes.paymentIntentsIdempotency}`,
    ),
    check(
      "refund_path_exists",
      "Caminho de estorno (PaymentService)",
      probes.refundPathExists,
      true,
      `probe=${probes.refundPathExists}`,
    ),
    check(
      "cancel_path_exists",
      "Caminho de cancelamento de intent",
      probes.cancelPathExists,
      true,
      `probe=${probes.cancelPathExists}`,
    ),
    check(
      "reconciliation_module_present",
      "Módulo de reconciliação presente",
      probes.reconciliationModulePresent,
      true,
      `probe=${probes.reconciliationModulePresent}`,
    ),
    check(
      "admin_approval",
      "Aprovação administrativa ativa",
      passFail(approvalActive),
      true,
      approvalActive
        ? `approval=${activeApproval!.id}; until=${activeApproval!.validUntil ?? "open"}`
        : "Nenhuma aprovação approved ativa",
    ),
    check(
      "payments_live_gate",
      "PAYMENTS_LIVE reportado (não alterado por esta API)",
      "PASS",
      false,
      input.paymentsLive ? "PAYMENTS_LIVE=1 (insuficiente sem aprovação DB)" : "PAYMENTS_LIVE≠1",
    ),
    check(
      "public_checkout_gate",
      "FEATURE_PUBLIC_CHECKOUT",
      "PASS",
      false,
      input.publicCheckout ? "FEATURE_PUBLIC_CHECKOUT=1" : "FEATURE_PUBLIC_CHECKOUT≠1",
    ),
  ];

  const required = checks.filter((c) => c.required);
  const blocking = required.filter((c) => c.result === "FAIL").map((c) => c.key);
  const pendingVerification = required.filter((c) => c.result === "NOT_VERIFIED").map((c) => c.key);
  const passedRequired = required.filter((c) => c.result === "PASS").length;
  const readyForLive = blocking.length === 0 && pendingVerification.length === 0 && approvalActive;

  let status: PaymentsHomologationChecklist["status"] = "NOT_HOMOLOGATED";
  if (readyForLive) status = "READY_FOR_LIVE";
  else if (blocking.length === 0 && pendingVerification.length > 0) status = "PENDING_EVIDENCE";

  return {
    generatedAt: new Date().toISOString(),
    readyForLive,
    paymentsLive: input.paymentsLive,
    publicCheckout: input.publicCheckout,
    purchaseReady: readyForLive,
    status,
    note: input.isProduction
      ? "Produção: PAYMENTS_LIVE=1 é necessário mas insuficiente — exige checklist PASS + aprovação DB."
      : "Não-produção: use sandbox Asaas; esta API nunca escreve PAYMENTS_LIVE.",
    checks,
    blocking,
    pendingVerification,
    passedRequired,
    requiredTotal: required.length,
    activeApproval,
    paymentsLiveInsufficientWithoutApproval: input.paymentsLive && !approvalActive,
  };
}
