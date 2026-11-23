import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { ChecklistItemStatus } from "@verasjuris/validation";
import type { ApiFailure } from "./types";
import { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure } from "./crm";

export { apiErrorMessage, getActiveMembership, getActiveOrgId, isApiFailure };
export type { ChecklistItemStatus };

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

const org = (orgId: string) => `/api/v1/organizations/${orgId}`;

// ------------------------------------------------------------------ INPI

export type InpiMonitors = {
  processes: Array<{
    id: string;
    processNumber: string;
    label: string | null;
    holderName: string | null;
    active: boolean;
    lastEdition: number | null;
    lastDispatchName: string | null;
    lastDispatchOn: string | null;
    discovered: boolean;
  }>;
  attorneys: Array<{ id: string; attorneyName: string; active: boolean }>;
  lastRun: {
    edition: number;
    publishedOn: string | null;
    status: string;
    processedAt: string;
  } | null;
};

export type InpiDispatch = {
  id: string;
  edition: number;
  publishedOn: string;
  processNumber: string;
  markName: string | null;
  holders: Array<{ name: string; country: string | null; uf: string | null }>;
  attorney: string | null;
  code: string | null;
  name: string;
  complement: string | null;
  procedureKey: string | null;
  procedureName: string | null;
  suggestedDays: number | null;
  suggestedDueOn: string | null;
  suggestionBasis: string | null;
  status: "new" | "triaged" | "dismissed";
  deadlineId: string | null;
  taskId: string | null;
  dismissedReason: string | null;
  consultUrl: string;
};

export const inpi = {
  monitors: (orgId: string) => api<InpiMonitors>(`${org(orgId)}/inpi/monitors`),
  addProcess: (orgId: string, input: { processNumber: string; label?: string }) =>
    api<{ process: { id: string } }>(`${org(orgId)}/inpi/processes`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  setProcessActive: (orgId: string, id: string, active: boolean) =>
    api(`${org(orgId)}/inpi/processes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  addAttorney: (orgId: string, attorneyName: string) =>
    api(`${org(orgId)}/inpi/attorneys`, { method: "POST", body: JSON.stringify({ attorneyName }) }),
  setAttorneyActive: (orgId: string, id: string, active: boolean) =>
    api(`${org(orgId)}/inpi/attorneys/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  run: (orgId: string) =>
    api<{
      result: {
        edition: number;
        publishedOn: string | null;
        status: string;
        createdDispatches: number;
        discoveredProcesses: number;
        message: string | null;
      };
    }>(`${org(orgId)}/inpi/run`, { method: "POST", body: JSON.stringify({}) }),
  dispatches: (orgId: string, status?: string) =>
    api<{ items: InpiDispatch[]; total: number }>(
      `${org(orgId)}/inpi/dispatches${status ? `?status=${status}` : ""}`,
    ),
  triage: (
    orgId: string,
    id: string,
    input: { createDeadline: boolean; createTask: boolean; ruleDays?: number },
  ) =>
    api<{ deadlineId: string | null; taskId: string | null }>(
      `${org(orgId)}/inpi/dispatches/${id}/triage`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
  dismiss: (orgId: string, id: string, reason: string) =>
    api(`${org(orgId)}/inpi/dispatches/${id}/dismiss`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};

// ---------------------------------------------------- catálogo e protocolo

export type DeadlineRule = {
  key: string;
  label: string;
  actor: "party" | "agency";
  days: number | null;
  counting: "calendar_days" | "business_days" | "event";
  startsFrom: string;
  basis: string;
};

export type Procedure = {
  key: string;
  agencyCode: string;
  name: string;
  summary: string;
  portalName: string;
  portalUrl: string;
  steps: string[];
  documents: string[];
  deadlines: DeadlineRule[];
};

export type Agency = {
  code: string;
  name: string;
  acronym: string;
  portalName: string;
  portalUrl: string;
};

export type BenefitDefinition = {
  key: string;
  name: string;
  priority: number;
  summary: string;
  requirements: Array<{ key: string; label: string; basis: string; evidence: string[] }>;
};

export type Catalog = {
  agencies: Agency[];
  procedures: Procedure[];
  benefits: BenefitDefinition[];
  checklistStatuses: Record<ChecklistItemStatus, string>;
};

export const catalog = (orgId: string) =>
  api<Catalog>(`${org(orgId)}/administrative-procedures/catalog`);

export type GuidedProtocol = {
  id: string;
  procedureKey: string;
  procedureName: string;
  protocolNumber: string | null;
  submittedAt: string | null;
  receiptDocumentId: string | null;
  status: string;
};

export const guidedProtocol = {
  list: (orgId: string, processId: string) =>
    api<{ items: GuidedProtocol[] }>(
      `${org(orgId)}/administrative-processes/${processId}/guided-protocols`,
    ),
  plan: (orgId: string, processId: string, input: { procedureKey: string; startDate: string }) =>
    api<{ deadlineIds: string[]; taskId: string }>(
      `${org(orgId)}/administrative-processes/${processId}/guided-protocols/plan`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  register: (
    orgId: string,
    processId: string,
    input: {
      procedureKey: string;
      protocolNumber: string;
      protocolDate: string;
      receiptDocumentId: string;
    },
  ) =>
    api<{ request: GuidedProtocol; followUpTaskIds: string[] }>(
      `${org(orgId)}/administrative-processes/${processId}/guided-protocols`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};

// ---------------------------------------------------------- checklists

export type BenefitChecklist = {
  id: string;
  benefitKey: string;
  benefitName: string;
  legalMatterId: string | null;
  administrativeProcessId: string | null;
  clientLabel: string | null;
  requirements: Array<{
    key: string;
    label: string;
    basis: string;
    evidence: string[];
    status: ChecklistItemStatus;
    note: string | null;
    documentId: string | null;
    updatedAt: string | null;
  }>;
  summary: { total: number; counts: Record<ChecklistItemStatus, number>; open: string[] };
  updatedAt: string;
};

export const checklists = {
  list: (
    orgId: string,
    query: { legalMatterId?: string; administrativeProcessId?: string } = {},
  ) => {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, v]) => Boolean(v)) as Array<[string, string]>,
    );
    return api<{ items: BenefitChecklist[] }>(`${org(orgId)}/benefit-checklists?${params}`);
  },
  create: (
    orgId: string,
    input: {
      benefitKey: string;
      legalMatterId?: string;
      administrativeProcessId?: string;
      clientLabel?: string;
    },
  ) =>
    api<{ checklist: BenefitChecklist }>(`${org(orgId)}/benefit-checklists`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  get: (orgId: string, id: string) =>
    api<{ checklist: BenefitChecklist }>(`${org(orgId)}/benefit-checklists/${id}`),
  updateItem: (
    orgId: string,
    id: string,
    key: string,
    input: { status: ChecklistItemStatus; note?: string; documentId?: string | null },
  ) =>
    api<{ checklist: BenefitChecklist }>(`${org(orgId)}/benefit-checklists/${id}/items/${key}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function deadlineText(rule: DeadlineRule): string {
  if (!rule.days) return "prazo na notificação";
  const unit = rule.counting === "business_days" ? "dias úteis" : "dias corridos";
  return `${rule.days} ${unit} (termo inicial: ${rule.startsFrom})`;
}
