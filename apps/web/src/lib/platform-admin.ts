import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import { isApiFailure } from "./crm";
import { mapErrorCode } from "./i18n/api-errors";

export type PlatformAdminFailure = ApiFailure & { httpStatus?: number };

async function request<T>(path: string, init?: RequestInit): Promise<T | PlatformAdminFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Não foi possível concluir a operação.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

export function platformAdminErrorMessage(
  failure: PlatformAdminFailure,
  t: (key: string, fallback?: string) => string = (k, f) => f ?? k,
): string {
  return mapErrorCode(failure.error?.code, t, failure.error?.message);
}

export type PlatformMe = {
  platform: {
    roles: string[];
    permissions: string[];
    mfaRequired: boolean;
    forcePasswordChange: boolean;
    mfaEnabled: boolean;
    adminReady: boolean;
  };
};

export type PlatformDashboard = {
  period: { dayStart: string; monthStart: string; generatedAt: string };
  metrics: Record<string, number | null>;
  notes: string[];
};

export type IntegrationHealthItem = {
  key: string;
  name: string;
  environment: string;
  status: string;
  detail: string | null;
  lastCheckedAt: string;
  classification: string;
  label: string;
  pendencies: string[];
  paymentsLive?: boolean;
  featureAi?: boolean;
  keyPresent?: boolean;
};

export async function fetchPlatformMe() {
  return request<PlatformMe>("/api/v1/platform/me");
}

export async function fetchPlatformDashboard() {
  return request<PlatformDashboard>("/api/v1/platform/dashboard");
}

export async function fetchPlatformIntegrations() {
  return request<{ generatedAt: string; items: IntegrationHealthItem[] }>(
    "/api/v1/platform/integrations/health",
  );
}

export async function fetchPlatformUsers(params?: { q?: string; status?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.status) qs.set("status", params.status);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<{
    items: Array<{
      id: string;
      email: string;
      displayName: string | null;
      status: string;
      emailVerified: boolean;
      lastLoginAt: string | null;
      mfaEnabled: boolean;
      createdAt: string;
    }>;
  }>(`/api/v1/platform/users${suffix}`);
}

export async function fetchPlatformOrganizations(params?: { q?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request<{
    items: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      internalCompany: boolean;
      createdAt: string;
    }>;
  }>(`/api/v1/platform/organizations${suffix}`);
}

export async function fetchPlatformStaff() {
  return request<{
    items: Array<{
      id: string;
      userId: string;
      email: string | null;
      displayName: string | null;
      roleKey: string;
      status: string;
      mfaRequired: boolean;
      mfaEnabled: boolean;
      forcePasswordChange: boolean;
      activatedAt: string | null;
      createdAt: string;
    }>;
  }>("/api/v1/platform/staff");
}

export async function activatePlatformInvite(input: {
  token: string;
  password: string;
  displayName?: string;
}) {
  return request<{
    userId: string;
    email: string;
    roleKey: string;
    next: { loginRequired: boolean; mfaSetupRequired: boolean; message: string };
  }>("/api/v1/platform/activate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateUserStatus(
  userId: string,
  input: { status: "active" | "suspended" | "disabled"; reason: string },
) {
  return request<{ id: string; status: string }>(`/api/v1/platform/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type HomologationCheckRow = {
  key: string;
  label: string;
  result: "PASS" | "FAIL" | "NOT_VERIFIED";
  ok: boolean;
  required: boolean;
  evidence: string;
};

export type HomologationChecklist = {
  generatedAt: string;
  readyForLive: boolean;
  paymentsLive: boolean;
  publicCheckout: boolean;
  purchaseReady: boolean;
  status: "READY_FOR_LIVE" | "NOT_HOMOLOGATED" | "PENDING_EVIDENCE";
  note: string;
  checks: HomologationCheckRow[];
  blocking: string[];
  pendingVerification: string[];
  passedRequired: number;
  requiredTotal: number;
  activeApproval: {
    id: string;
    decision: "approved";
    approverUserId: string;
    validFrom: string;
    validUntil: string | null;
    reason: string;
  } | null;
  paymentsLiveInsufficientWithoutApproval: boolean;
};

export type HomologationReport = {
  generatedAt: string;
  checklist: HomologationChecklist;
  skuSummary: {
    total: number;
    purchaseReady: number;
    pendingEvidence: number;
    notHomologated: number;
  };
  skus: Array<{
    sku: string;
    purchaseReady: boolean;
    status: string;
    blocking: string[];
    pendingVerification: string[];
  }>;
};

export async function fetchHomologationChecklist() {
  return request<HomologationChecklist>("/api/v1/platform/payments/homologation-checklist");
}

export async function fetchHomologationReport() {
  return request<HomologationReport>("/api/v1/platform/payments/homologation-report");
}

export async function createHomologationApproval(input: { reason: string; validUntil?: string }) {
  return request<{
    approval: { id: string; decision: string; reason: string };
    checklist: HomologationChecklist;
    envNote: string;
  }>("/api/v1/platform/payments/homologation-approvals", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeHomologationApproval(input: { reason: string; approvalId?: string }) {
  return request<{
    revocation: { id: string; decision: string; reason: string };
    checklist: HomologationChecklist;
  }>("/api/v1/platform/payments/homologation-approvals/revoke", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function recordSkuHomologationEvidence(
  sku: string,
  input: {
    checkKey: string;
    result: "pass" | "fail" | "not_verified";
    notes?: string;
    evidenceJson?: Record<string, unknown>;
  },
) {
  return request<{
    evidence: { id: string; skuCode: string; checkKey: string; result: string };
    readiness: { purchaseReady: boolean; status: string };
  }>(`/api/v1/platform/commerce/sku-homologation/${encodeURIComponent(sku)}/evidence`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export { isApiFailure };
