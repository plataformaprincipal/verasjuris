import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { isApiFailure } from "./ai";
import { getActiveOrgId } from "./crm";
import type { Locale } from "./i18n";

export type AssistantMode = "support" | "product" | "legal" | "work";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

type FaqEntry = { q: string; a: string; mode?: AssistantMode };

const FAQ: Partial<Record<Locale, FaqEntry[]>> & {
  "pt-BR": FaqEntry[];
  "en-US": FaqEntry[];
  "es-ES": FaqEntry[];
} = {
  "pt-BR": [
    {
      q: "Como entrar na conta?",
      a: "Use Entrar com e-mail e senha. Se esqueceu a senha, use Recuperar conta.",
      mode: "support",
    },
    {
      q: "Onde fica a acessibilidade?",
      a: "Abra o botão flutuante de acessibilidade ou a página /acessibilidade.",
      mode: "product",
    },
    {
      q: "Vocês são um escritório de advocacia?",
      a: "Não. O VerasJuris é uma plataforma. Este assistente não é advogado e não presta consultoria jurídica.",
      mode: "legal",
    },
    {
      q: "Como ver o status do sistema?",
      a: "Consulte a página pública /status.",
      mode: "support",
    },
    {
      q: "O que é Work?",
      a: "Work planeja e executa tarefas internas com aprovação humana em /app/juris-one/work. Ações externas ficam bloqueadas até homologação.",
      mode: "work",
    },
    {
      q: "Onde estão as políticas?",
      a: "No rodapé institucional e em /politicas/* (conteúdo DRAFT até aprovação).",
      mode: "product",
    },
  ],
  "en-US": [
    {
      q: "How do I sign in?",
      a: "Use Sign in with email and password. Use account recovery if needed.",
    },
    {
      q: "Where is accessibility?",
      a: "Open the floating accessibility button or /acessibilidade.",
    },
    {
      q: "Are you a law firm?",
      a: "No. VerasJuris is a platform. This assistant is not a lawyer and does not give legal advice.",
      mode: "legal",
    },
    {
      q: "What is Work?",
      a: "Work plans internal tasks with human approval at /app/juris-one/work. External actions stay blocked until homologated.",
      mode: "work",
    },
  ],
  "es-ES": [
    {
      q: "¿Cómo inicio sesión?",
      a: "Use Entrar con correo y contraseña. Si olvidó la contraseña, recupere la cuenta.",
    },
    {
      q: "¿Son un bufete?",
      a: "No. VerasJuris es una plataforma. Este asistente no es abogado y no da asesoría jurídica.",
      mode: "legal",
    },
  ],
};

function faqForLocale(locale: Locale): FaqEntry[] {
  if (FAQ[locale]) return FAQ[locale]!;
  if (locale.startsWith("es")) return FAQ["es-ES"];
  if (locale.startsWith("en")) return FAQ["en-US"];
  return FAQ["pt-BR"];
}

export function faqFor(locale: Locale, mode: AssistantMode): Array<{ q: string; a: string }> {
  const entries = faqForLocale(locale);
  return entries
    .filter((item) => !item.mode || item.mode === mode)
    .concat(entries.filter((item) => item.mode && item.mode !== mode).slice(0, 2));
}

export function matchFaq(locale: Locale, mode: AssistantMode, question: string): string | null {
  const q = question.trim().toLowerCase();
  if (!q) return null;
  const entries = faqForLocale(locale);
  const hit =
    entries.find(
      (item) => (!item.mode || item.mode === mode) && item.q.toLowerCase().includes(q),
    ) ??
    entries.find(
      (item) => item.a.toLowerCase().includes(q) || q.includes(item.q.toLowerCase().slice(0, 12)),
    );
  if (hit) return hit.a;
  if (mode === "legal" || /advogad|lawyer|abogad|consultoria|parecer/i.test(q)) {
    return entries.find((item) => item.mode === "legal")?.a ?? null;
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { httpStatus: 0, error: { code: "network", message: "Falha de rede." } };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AiApiFailure;
    return { httpStatus: response.status, ...body };
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function sendAssistantMessage(input: {
  mode: AssistantMode;
  message: string;
  conversationId?: string | null;
  locale: Locale;
  path?: string;
}): Promise<
  | {
      conversationId: string;
      reply: string;
      aiAvailable: boolean;
      messages?: AssistantMessage[];
      processing?: { streamed: boolean; reason?: string };
    }
  | AiApiFailure
> {
  const orgId = await getActiveOrgId();
  if (!orgId) {
    return {
      httpStatus: 401,
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "Entre na conta e selecione uma organização para usar o Assistente com IA real.",
      },
    };
  }

  let conversationId = input.conversationId ?? null;
  if (!conversationId) {
    const created = await request<{ conversation: { id: string } }>(
      `/api/v1/organizations/${orgId}/assistant/conversations`,
      {
        method: "POST",
        body: JSON.stringify({
          title: `Assistente (${input.mode})`,
          locale: input.locale,
        }),
      },
    );
    if (isApiFailure(created)) return created;
    conversationId = created.conversation.id;
  }

  const content =
    input.mode === "work"
      ? `[modo=work] ${input.message}`
      : input.path
        ? `${input.message}\n(contexto de página: ${input.path})`
        : input.message;

  const res = await request<{
    message: { id: string; content: string };
    providerKey?: string;
    model?: string;
    processing?: { streamed: boolean; reason?: string };
  }>(`/api/v1/organizations/${orgId}/assistant/messages`, {
    method: "POST",
    body: JSON.stringify({
      sessionId: conversationId,
      content,
    }),
  });
  if (isApiFailure(res)) return res;

  return {
    conversationId,
    reply: res.message.content,
    aiAvailable: true,
    processing: res.processing ?? { streamed: false },
  };
}

export function localFallbackReply(locale: Locale, mode: AssistantMode, question: string): string {
  const faq = matchFaq(locale, mode, question);
  if (faq) {
    return `${faq} (FAQ complementar — a IA não está disponível neste momento.)`;
  }
  const disclaimers: Partial<Record<Locale, string>> = {
    "pt-BR":
      "A inteligência artificial está indisponível. Não inventei uma resposta. Entre, selecione organização e tente novamente, ou consulte a Central de Ajuda.",
    "en-US":
      "AI is unavailable. No fabricated reply. Sign in, select an organization, and retry — or use Help Center.",
    "es-ES":
      "La IA no está disponible. No inventé una respuesta. Inicie sesión, seleccione organización e intente de nuevo.",
  };
  if (disclaimers[locale]) return disclaimers[locale]!;
  if (locale.startsWith("es")) return disclaimers["es-ES"]!;
  if (locale.startsWith("en")) return disclaimers["en-US"]!;
  return disclaimers["pt-BR"]!;
}
