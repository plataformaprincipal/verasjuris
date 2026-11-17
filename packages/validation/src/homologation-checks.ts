import { z } from "zod";

export const HOMOLOGATION_RESULTS = ["PASS", "FAIL", "NOT_VERIFIED"] as const;
export type HomologationResult = (typeof HOMOLOGATION_RESULTS)[number];

/** Checks de plataforma Asaas / pagamentos (required = bloqueia readyForLive). */
export const PLATFORM_HOMOLOGATION_CHECKS = [
  { key: "payment_provider_asaas", label: "PAYMENT_PROVIDER=asaas", required: true, auto: true },
  { key: "asaas_api_key", label: "ASAAS_API_KEY presente", required: true, auto: true },
  { key: "asaas_webhook_token", label: "ASAAS_WEBHOOK_TOKEN presente", required: true, auto: true },
  { key: "payment_health", label: "PaymentProvider healthCheck", required: true, auto: true },
  {
    key: "sandbox_environment",
    label: "ASAAS_ENVIRONMENT sandbox (ou evidência de prod)",
    required: true,
    auto: true,
  },
  {
    key: "webhook_events_persisted",
    label: "Tabela payment_webhook_events disponível",
    required: true,
    auto: true,
  },
  {
    key: "payment_intents_idempotency",
    label: "Idempotência de payment_intents",
    required: true,
    auto: true,
  },
  {
    key: "refund_path_exists",
    label: "Caminho de estorno (PaymentService)",
    required: true,
    auto: true,
  },
  {
    key: "cancel_path_exists",
    label: "Caminho de cancelamento de intent",
    required: true,
    auto: true,
  },
  {
    key: "reconciliation_module_present",
    label: "Módulo de reconciliação presente",
    required: true,
    auto: true,
  },
  {
    key: "admin_approval",
    label: "Aprovação administrativa ativa",
    required: true,
    auto: true,
  },
] as const;

/** Checks mínimos por SKU comercial. */
export const SKU_HOMOLOGATION_CHECKS = [
  { key: "price_defined", label: "Preço definido (>0 ou proposta)", required: true, auto: true },
  {
    key: "not_not_implemented",
    label: "homologationStatus ≠ not_implemented",
    required: true,
    auto: true,
  },
  {
    key: "entitlements_or_credits",
    label: "Entitlements ou creditsGranted definidos",
    required: false,
    auto: true,
  },
  {
    key: "feature_binding",
    label: "Binding de feature (módulos AI_*)",
    required: false,
    auto: true,
  },
  {
    key: "cart_or_service_flow",
    label: "Fluxo carrinho ou serviço 30/70",
    required: true,
    auto: true,
  },
  {
    key: "e2e_sandbox_purchase",
    label: "Compra sandbox ponta a ponta",
    required: true,
    auto: false,
  },
  {
    key: "deliverability",
    label: "Entregabilidade operacional",
    required: true,
    auto: false,
  },
] as const;

export const recordSkuEvidenceSchema = z.object({
  checkKey: z.string().trim().min(2).max(80),
  result: z.enum(["pass", "fail", "not_verified"]),
  notes: z.string().trim().max(2000).optional(),
  evidenceJson: z.record(z.string(), z.unknown()).optional(),
});

export const createHomologationApprovalSchema = z.object({
  reason: z.string().trim().min(12).max(2000),
  validUntil: z.string().datetime().optional(),
});

export const revokeHomologationApprovalSchema = z.object({
  reason: z.string().trim().min(12).max(2000),
  approvalId: z.string().uuid().optional(),
});

export type RecordSkuEvidenceInput = z.infer<typeof recordSkuEvidenceSchema>;
export type CreateHomologationApprovalInput = z.infer<typeof createHomologationApprovalSchema>;
