import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ApiFailure } from "./types";
import { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";

export { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure };

async function api<T>(path: string, init?: RequestInit): Promise<T | ApiFailure> {
  const response = await fetch(path, {
    ...init,
    headers: {
      [CSRF_HEADER]: "1",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    return {
      error: {
        code: (body as ApiFailure).error?.code ?? "INTERNAL_ERROR",
        message: (body as ApiFailure).error?.message ?? "Falha na requisição.",
        details: (body as ApiFailure).error?.details,
      },
    };
  }
  return body;
}

export type CommunicationStatus = "new" | "linked" | "triaged" | "dismissed";

export const STATUS_LABEL: Record<CommunicationStatus, string> = {
  new: "Nova",
  linked: "Vinculada",
  triaged: "Triada",
  dismissed: "Descartada",
};

export const STATUS_TONE: Record<CommunicationStatus, "success" | "warning" | "neutral"> = {
  new: "warning",
  linked: "neutral",
  triaged: "success",
  dismissed: "neutral",
};

export type CourtMonitor = {
  id: string;
  lawyerName: string;
  oabNumber: string;
  oabUf: string;
  active: boolean;
  capturedThrough: string | null;
  lastRunAt: string | null;
  lastRunStatus: "never_run" | "ok" | "partial" | "error";
  lastRunMessage: string | null;
  lastRunFound: number;
  lastRunCreated: number;
};

export type CourtCommunication = {
  id: string;
  tribunal: string | null;
  communicationType: string | null;
  documentType: string | null;
  courtBody: string | null;
  className: string | null;
  processNumber: string | null;
  processNumberMasked: string | null;
  preview: string;
  content?: string;
  link: string | null;
  certificateUrl: string | null;
  recipients: Array<{ name: string; side: string | null }>;
  lawyers: Array<{ name: string; oabNumber: string | null; oabUf: string | null }>;
  availableOn: string;
  publishedOn: string | null;
  termStartsOn: string | null;
  status: CommunicationStatus;
  category: string | null;
  suggestedAction: string | null;
  suggestedDays: number | null;
  suggestionBasis: string | null;
  suggestedDueOn: string | null;
  judicialProcessId: string | null;
  deadlineId: string | null;
  taskId: string | null;
  dismissedReason: string | null;
};

export type CommunicationList = {
  items: CourtCommunication[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<CommunicationStatus, number>;
};

const base = (orgId: string) => `/api/v1/organizations/${orgId}/court-communications`;

export function listMonitors(orgId: string) {
  return api<{ items: CourtMonitor[] }>(`${base(orgId)}/monitors`);
}

export function listOabSuggestions(orgId: string) {
  return api<{
    items: Array<{ membershipId: string; lawyerName: string; oabNumber: string; oabUf: string }>;
  }>(`${base(orgId)}/monitors/suggestions`);
}

export function createMonitor(
  orgId: string,
  input: { lawyerName: string; oabNumber: string; oabUf: string; membershipId?: string },
) {
  return api<{ monitor: CourtMonitor }>(`${base(orgId)}/monitors`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMonitor(orgId: string, monitorId: string, input: { active: boolean }) {
  return api<{ monitor: CourtMonitor }>(`${base(orgId)}/monitors/${monitorId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function runMonitor(
  orgId: string,
  monitorId: string,
  input: { from?: string; to?: string } = {},
) {
  return api<{
    result: {
      created: number;
      found: number;
      linked: number;
      status: string;
      message: string | null;
    };
    monitor: CourtMonitor;
  }>(`${base(orgId)}/monitors/${monitorId}/run`, { method: "POST", body: JSON.stringify(input) });
}

export function listCommunications(
  orgId: string,
  query: { status?: string; q?: string; from?: string; to?: string; page?: number } = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return api<CommunicationList>(`${base(orgId)}?${params}`);
}

export function getCommunication(orgId: string, id: string) {
  return api<{
    communication: CourtCommunication;
    judicialProcess: { id: string; cnjNumber: string; legalMatterId: string } | null;
  }>(`${base(orgId)}/${id}`);
}

export function linkCommunication(orgId: string, id: string, judicialProcessId: string | null) {
  return api<{ communication: CourtCommunication }>(`${base(orgId)}/${id}/link`, {
    method: "POST",
    body: JSON.stringify({ judicialProcessId }),
  });
}

export function dismissCommunication(orgId: string, id: string, reason: string) {
  return api<{ communication: CourtCommunication }>(`${base(orgId)}/${id}/dismiss`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function triageCommunication(
  orgId: string,
  id: string,
  input: {
    createDeadline: boolean;
    createTask: boolean;
    ruleDays?: number;
    deadlineTitle?: string;
    taskTitle?: string;
    priority?: "low" | "normal" | "high" | "urgent";
  },
) {
  return api<{
    communication: CourtCommunication;
    deadlineId: string | null;
    taskId: string | null;
  }>(`${base(orgId)}/${id}/triage`, { method: "POST", body: JSON.stringify(input) });
}

export function syncProcessFromDatajud(orgId: string, processId: string) {
  return api<{
    found: boolean;
    created: number;
    message: string | null;
    records: Array<{
      tribunal: string;
      degree: string | null;
      className: string | null;
      subjects: string[];
      courtBody: string | null;
      movements: number;
      lastUpdatedAt: string | null;
    }>;
  }>(`/api/v1/organizations/${orgId}/judicial-processes/${processId}/datajud-sync`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function searchProcessOptions(orgId: string, q: string) {
  return api<{
    items: Array<{ id: string; cnjNumber: string; matterId: string; matterTitle: string }>;
  }>(`${base(orgId)}/process-options?q=${encodeURIComponent(q)}`);
}
