/**
 * Fase 9 — checklist de evidências para cobrança live.
 * Somente leitura: nunca altera PAYMENTS_LIVE.
 */

export type HomologationCheck = {
  key: string;
  label: string;
  ok: boolean;
  required: boolean;
  evidence: string;
};

export type PaymentsHomologationChecklist = {
  generatedAt: string;
  readyForLive: false;
  paymentsLive: boolean;
  publicCheckout: boolean;
  purchaseReady: false;
  status: "NOT_HOMOLOGATED";
  note: string;
  checks: HomologationCheck[];
  blocking: string[];
  passedRequired: number;
  requiredTotal: number;
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
  catalogPurchaseReady: false;
  isProduction: boolean;
};

export function buildPaymentsHomologationChecklist(
  input: HomologationChecklistInput,
): PaymentsHomologationChecklist {
  const checks: HomologationCheck[] = [
    {
      key: "payment_provider_asaas",
      label: "PAYMENT_PROVIDER=asaas",
      ok: input.paymentProviderMode === "asaas",
      required: true,
      evidence: `mode=${input.paymentProviderMode}`,
    },
    {
      key: "asaas_api_key",
      label: "ASAAS_API_KEY presente",
      ok: input.asaasApiKeyPresent,
      required: true,
      evidence: input.asaasApiKeyPresent ? "present" : "missing",
    },
    {
      key: "asaas_webhook_token",
      label: "ASAAS_WEBHOOK_TOKEN presente",
      ok: input.asaasWebhookTokenPresent,
      required: true,
      evidence: input.asaasWebhookTokenPresent ? "present" : "missing",
    },
    {
      key: "payment_health",
      label: "PaymentProvider healthCheck",
      ok: input.paymentHealthStatus === "ok" || input.paymentHealthStatus === "degraded",
      required: true,
      evidence: `${input.paymentHealthStatus}${input.paymentHealthDetail ? `: ${input.paymentHealthDetail}` : ""}`,
    },
    {
      key: "sandbox_before_live",
      label: "Ambiente sandbox antes de live (ou evidência explícita)",
      ok:
        (input.asaasEnvironment ?? "sandbox") !== "production" ||
        input.paymentHealthStatus === "ok",
      required: true,
      evidence: `ASAAS_ENVIRONMENT=${input.asaasEnvironment ?? "unset"}`,
    },
    {
      key: "payments_live_gate",
      label: "PAYMENTS_LIVE reportado (não alterado por esta API)",
      ok: true,
      required: false,
      evidence: input.paymentsLive ? "PAYMENTS_LIVE=1 (atenção)" : "PAYMENTS_LIVE≠1 (seguro)",
    },
    {
      key: "public_checkout_gate",
      label: "FEATURE_PUBLIC_CHECKOUT",
      ok: true,
      required: false,
      evidence: input.publicCheckout ? "FEATURE_PUBLIC_CHECKOUT=1" : "FEATURE_PUBLIC_CHECKOUT≠1",
    },
    {
      key: "catalog_purchase_ready",
      label: "Catálogo purchaseReady",
      ok: input.catalogPurchaseReady === false,
      required: true,
      evidence: "purchaseReady=false (esperado até homologação humana)",
    },
    {
      key: "human_signoff",
      label: "Sign-off humano de homologação live",
      ok: false,
      required: true,
      evidence: "Pendente — checklist não promove live automaticamente",
    },
  ];

  const required = checks.filter((c) => c.required);
  const blocking = required.filter((c) => !c.ok).map((c) => c.key);
  const passedRequired = required.filter((c) => c.ok).length;

  return {
    generatedAt: new Date().toISOString(),
    readyForLive: false,
    paymentsLive: input.paymentsLive,
    publicCheckout: input.publicCheckout,
    purchaseReady: false,
    status: "NOT_HOMOLOGATED",
    note: input.isProduction
      ? "Produção: mantenha PAYMENTS_LIVE≠1 até sign-off e evidências verdes."
      : "Ambiente não-produção: use sandbox Asaas; esta API nunca escreve PAYMENTS_LIVE.",
    checks,
    blocking,
    passedRequired,
    requiredTotal: required.length,
  };
}
