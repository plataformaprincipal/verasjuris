import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, isApiFailure } from "./ai";

export type CommercialCatalogItem = {
  sku: string;
  key: string;
  name: string;
  description: string | null;
  commercialType: string | null;
  productType: string;
  commercialVersion: string | null;
  homologationStatus: string | null;
  purchaseReady: boolean;
  purchaseStatus: "CATALOG_SEEDED" | "NOT_READY_FOR_PURCHASE" | "PURCHASE_READY";
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

export type CommercialCatalogResponse = {
  commercialVersion: string;
  purchaseReady: boolean;
  paymentsLiveForbidden: boolean;
  readyForLive?: boolean;
  homologationStatus?: string;
  commissionRules: Array<{ category: string; bps: number; note: string }>;
  items: CommercialCatalogItem[];
  total: number;
  limit: number;
  offset: number;
};

function qs(query: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(path: string): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "include",
      headers: { Accept: "application/json", [CSRF_HEADER]: "1" },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Falha de rede ao consultar o catálogo comercial.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? "REQUEST_FAILED",
        message: body.error?.message ?? "Não foi possível carregar o catálogo comercial.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

export async function fetchCommercialCatalog(
  query: Record<string, string | number | boolean | undefined> = {},
) {
  return request<CommercialCatalogResponse>(`/api/v1/commerce/catalog${qs(query)}`);
}

export function commerceErrorMessage(res: AiApiFailure): string {
  return aiErrorMessage(res, "Não foi possível carregar o catálogo comercial.");
}

export { isApiFailure };

export const HOMOLOGATION_LABELS: Record<string, string> = {
  catalog_only: "Somente catálogo",
  partial: "Parcial",
  not_implemented: "Não implementado",
};

export type PurchaseGateBadge = "PURCHASE_READY" | "NOT_HOMOLOGATED" | "PENDING_EVIDENCE";

export function purchaseGateBadge(item: {
  purchaseReady: boolean;
  purchaseStatus?: string;
  homologationStatus?: string | null;
}): PurchaseGateBadge {
  if (item.purchaseReady || item.purchaseStatus === "PURCHASE_READY") return "PURCHASE_READY";
  if (item.homologationStatus === "not_implemented") return "NOT_HOMOLOGATED";
  if (
    item.purchaseStatus === "CATALOG_SEEDED" ||
    item.purchaseStatus === "NOT_READY_FOR_PURCHASE"
  ) {
    return "PENDING_EVIDENCE";
  }
  return "NOT_HOMOLOGATED";
}

/** @deprecated use purchaseGateBadge — mantido para imports legados */
export const PURCHASE_GATE_LABEL = "NOT_HOMOLOGATED" as const;
export const PURCHASE_READY_LABEL = "NOT_READY_FOR_PURCHASE" as const;

export type CommercePurchaseStatusResponse = {
  purchaseReady: boolean;
  paymentsLive: boolean;
  publicCheckout: boolean;
  status: "READY_FOR_LIVE" | "NOT_HOMOLOGATED" | "PENDING_EVIDENCE";
  note: string;
  phases?: Record<string, string>;
  homologationChecklistSummary?: {
    readyForLive: boolean;
    blockingCount: number;
    pendingVerificationCount?: number;
    passedRequired?: number;
    requiredTotal?: number;
    paymentsLiveInsufficientWithoutApproval?: boolean;
  };
};

export async function fetchCommercePurchaseStatus() {
  return request<CommercePurchaseStatusResponse>("/api/v1/commerce/catalog/purchase-status");
}

export function formatCatalogPrice(item: CommercialCatalogItem): string {
  if (item.requiresProposal && (item.priceMode === "proposal" || item.amountCents == null)) {
    return "Sob consulta";
  }
  if (item.amountCents == null) return "Sob consulta";
  const formatted = (item.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: item.currency || "BRL",
  });
  if (item.priceMode === "starting_at") return `Desde ${formatted}`;
  if (item.interval === "monthly") return `${formatted}/mês`;
  if (item.interval === "yearly") return `${formatted}/ano`;
  if (item.interval === "per_session") return `${formatted}/sessão`;
  if (item.interval === "per_cycle") return `${formatted}/ciclo`;
  return formatted;
}
