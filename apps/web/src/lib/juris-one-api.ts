import { CSRF_HEADER } from "@verasjuris/security/constants";
import { isApiFailure, type AiApiFailure } from "./ai";
import type { ApiFailure } from "./types";

export type { AiApiFailure };

export type JurisConversationStatus = "active" | "archived" | "deleted" | string;

export type JurisConversationMetadata = {
  favorite?: boolean;
  displayName?: string;
  tone?: string;
  detail?: string;
  [key: string]: unknown;
};

export type JurisConversation = {
  id: string;
  title: string | null;
  locale?: string | null;
  status: JurisConversationStatus;
  organizationId?: string | null;
  metadata?: JurisConversationMetadata | null;
  createdAt?: string;
  updatedAt?: string;
};

export type JurisMessageRole = "user" | "assistant" | "system" | "tool";

export type JurisMessage = {
  id: string;
  conversationId?: string;
  role: JurisMessageRole;
  content: string;
  providerKey?: string | null;
  createdAt?: string;
};

export type JurisWorkCredits = {
  balance: number;
  lifetimeGranted: number;
  organizationId?: string;
  userId?: string;
  updatedAt?: string;
};

export type JurisWorkTask = {
  id: string;
  title: string;
  objective: string;
  status: string;
  spentMicros: number;
  budgetMicros: number | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      httpStatus: 0,
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }

  if (response.status === 204) return {} as T;

  const body = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

function orgAssistantPath(orgId: string, suffix = ""): string {
  return `/api/v1/organizations/${orgId}/assistant${suffix}`;
}

function orgWorkPath(orgId: string, suffix = ""): string {
  return `/api/v1/organizations/${orgId}/juris-work${suffix}`;
}

export function jurisOneApiErrorMessage(failure: AiApiFailure, fallback: string): string {
  return failure.error?.message ?? fallback;
}

export async function listConversations(
  orgId: string,
): Promise<{ items: JurisConversation[] } | AiApiFailure> {
  return request<{ items: JurisConversation[] }>(orgAssistantPath(orgId, "/conversations"));
}

export async function createConversation(
  orgId: string,
  input: { title?: string; locale?: string } = {},
): Promise<{ conversation: JurisConversation } | AiApiFailure> {
  return request<{ conversation: JurisConversation }>(orgAssistantPath(orgId, "/conversations"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getMessages(
  orgId: string,
  conversationId: string,
): Promise<{ items: JurisMessage[] } | AiApiFailure> {
  return request<{ items: JurisMessage[] }>(
    orgAssistantPath(orgId, `/conversations/${conversationId}/messages`),
  );
}

export async function sendMessage(
  orgId: string,
  input: {
    sessionId: string;
    content: string;
    requestCriticalAction?: boolean;
    criticalActionKey?: string;
  },
): Promise<
  | {
      message: JurisMessage;
      providerKey?: string;
      tools?: string[];
    }
  | AiApiFailure
> {
  return request<{ message: JurisMessage; providerKey?: string; tools?: string[] }>(
    orgAssistantPath(orgId, "/messages"),
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateConversation(
  orgId: string,
  conversationId: string,
  input: { title?: string; status?: "active" | "archived"; favorite?: boolean },
): Promise<{ conversation: JurisConversation } | AiApiFailure> {
  return request<{ conversation: JurisConversation }>(
    orgAssistantPath(orgId, `/conversations/${conversationId}`),
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export async function deleteConversation(
  orgId: string,
  conversationId: string,
): Promise<{ conversation: JurisConversation } | AiApiFailure> {
  return request<{ conversation: JurisConversation }>(
    orgAssistantPath(orgId, `/conversations/${conversationId}`),
    { method: "DELETE" },
  );
}

export async function sendFeedback(
  orgId: string,
  input: {
    conversationId?: string;
    messageId?: string;
    rating: "positive" | "negative" | "neutral";
    comment?: string;
  },
): Promise<{ feedback: unknown } | AiApiFailure> {
  return request<{ feedback: unknown }>(orgAssistantPath(orgId, "/feedback"), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getWorkCredits(
  orgId: string,
): Promise<{ credits: JurisWorkCredits; ledger?: unknown[] } | AiApiFailure> {
  return request<{ credits: JurisWorkCredits; ledger?: unknown[] }>(
    orgWorkPath(orgId, "/credits"),
  );
}

export async function ensureInitialWorkCredits(
  orgId: string,
): Promise<{ granted: boolean; credits: JurisWorkCredits } | AiApiFailure> {
  return request<{ granted: boolean; credits: JurisWorkCredits }>(
    orgWorkPath(orgId, "/credits/ensure-initial"),
    {
      method: "POST",
      body: "{}",
    },
  );
}

export async function listWorkTasks(
  orgId: string,
): Promise<{ items: JurisWorkTask[]; credits?: JurisWorkCredits } | AiApiFailure> {
  return request<{ items: JurisWorkTask[]; credits?: JurisWorkCredits }>(orgWorkPath(orgId));
}

export async function createWorkTask(
  orgId: string,
  input: { title: string; objective: string; budgetMicros?: number; maxSteps?: number },
): Promise<{ task: JurisWorkTask; credits?: JurisWorkCredits } | AiApiFailure> {
  return request<{ task: JurisWorkTask; credits?: JurisWorkCredits }>(orgWorkPath(orgId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export { isApiFailure };
