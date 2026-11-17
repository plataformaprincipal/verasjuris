import { CSRF_HEADER } from "@verasjuris/security/constants";

const VISITOR_KEY = "vj.juris-one.visitor-id";

export function getOrCreateJurisOneVisitorId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
    const id = `v_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return `v_${Date.now().toString(36)}`;
  }
}

export type JurisOnePublicChatResponse = {
  reply: string;
  provider: string;
  model: string;
  remainingToday: number;
  dailyLimit: number;
  faqHint: string | null;
};

export type JurisOnePublicStatus = {
  status: string;
  provider: string | null;
  health: string;
  detail: string | null;
  publicChat: { dailyLimit: number; maxMessageChars: number };
};

export async function fetchJurisOnePublicStatus(): Promise<JurisOnePublicStatus | null> {
  try {
    const res = await fetch("/api/v1/juris-one/public/status", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as JurisOnePublicStatus;
  } catch {
    return null;
  }
}

export async function sendJurisOnePublicChat(input: {
  message: string;
  locale: string;
  visitorId: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<JurisOnePublicChatResponse | { error: { code: string; message: string } }> {
  try {
    const res = await fetch("/api/v1/juris-one/public/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        /** Obrigatório: o BFF repassa ao Fastify; `registerHttpGuards` rejeita mutações sem este valor. */
        [CSRF_HEADER]: "1",
      },
      body: JSON.stringify({
        message: input.message,
        locale: input.locale,
        visitorId: input.visitorId,
        history: input.history.slice(-6),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as JurisOnePublicChatResponse & {
      error?: { code?: string; message?: string };
      message?: string;
    };
    if (!res.ok) {
      return {
        error: {
          code: body.error?.code ?? (res.status === 429 ? "RATE_LIMIT" : "UNAVAILABLE"),
          message:
            body.error?.message ??
            body.message ??
            "Não foi possível obter resposta da inteligência artificial.",
        },
      };
    }
    return body;
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Falha de rede. Verifique a conexão e tente novamente.",
      },
    };
  }
}
