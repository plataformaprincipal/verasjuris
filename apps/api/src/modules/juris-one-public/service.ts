import type { AIGateway } from "@verasjuris/ai";
import { AppError } from "@verasjuris/types";
import type { MemoryRateLimiter } from "@verasjuris/security";

/** UUIDs estáveis só para contabilização do gateway (sem FK de org/usuário real). */
export const PUBLIC_JURIS_ONE_ORG_ID = "00000000-0000-4000-8000-6a7572697301";
export const PUBLIC_JURIS_ONE_USER_ID = "00000000-0000-4000-8000-6a7572697302";

const PUBLIC_FEATURE = "juris_one.public_chat";
const MAX_OUTPUT_TOKENS = 800;
const DAILY_LIMIT = 5;
const PER_MINUTE_LIMIT = 6;

const dailyCounts = new Map<string, { day: string; count: number }>();
const inFlight = new Set<string>();

function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function systemPrompt(locale: string): string {
  const base =
    locale === "en-US"
      ? "You are Juris One, VerasJuris' assistive legal-platform guide. Answer helpfully in English."
      : locale === "es-ES"
        ? "Eres Juris One, guía asistiva de la plataforma jurídica VerasJuris. Responde en español."
        : "Você é o Juris One, guia assistivo da plataforma jurídica VerasJuris. Responda em português do Brasil.";
  return [
    base,
    "Você NÃO é advogado e NÃO substitui revisão profissional.",
    "Não invente jurisprudência, números de processo, dispositivos legais ou precedentes.",
    "Não execute pagamentos, protocolos, assinaturas nem exclusões.",
    "Se não souber, diga que não sabe e oriente caminhos da plataforma (cadastro, ferramentas, marketplace).",
    "FAQ institucional pode complementar, mas a resposta principal vem do modelo quando disponível.",
  ].join(" ");
}

function buildInput(
  message: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  if (!history?.length) return message;
  const lines = history.slice(-6).map((item) => `${item.role}: ${item.content}`);
  lines.push(`user: ${message}`);
  return lines.join("\n");
}

export type PublicChatDeps = {
  gateway: AIGateway;
  rateLimiter: MemoryRateLimiter;
};

export type PublicChatResult = {
  reply: string;
  provider: string;
  model: string;
  remainingToday: number;
  dailyLimit: number;
  faqHint: string | null;
};

export async function publicJurisOneChat(
  deps: PublicChatDeps,
  input: {
    message: string;
    locale?: string;
    visitorId?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    ip: string;
  },
): Promise<PublicChatResult> {
  const locale = input.locale ?? "pt-BR";
  const visitorKey = (input.visitorId ?? "anon").slice(0, 80);
  const ipKey = input.ip || "unknown";

  const minute = deps.rateLimiter.consume(
    `juris-one-public:min:${ipKey}:${visitorKey}`,
    PER_MINUTE_LIMIT,
    60_000,
  );
  if (!minute.allowed) {
    throw new AppError(
      "RATE_LIMIT",
      `Muitas solicitações. Aguarde ${minute.retryAfterSeconds}s e tente novamente.`,
    );
  }

  const day = utcDayKey();
  const dailyKey = `${visitorKey}|${ipKey}`;
  const current = dailyCounts.get(dailyKey);
  const used = current?.day === day ? current.count : 0;
  if (used >= DAILY_LIMIT) {
    throw new AppError(
      "RATE_LIMIT",
      `Você atingiu o limite gratuito de ${DAILY_LIMIT} mensagens com IA neste período. Crie uma conta para continuar com o Juris One autenticado.`,
    );
  }

  if (inFlight.has(dailyKey)) {
    throw new AppError(
      "RATE_LIMIT",
      "Já existe uma resposta sendo gerada. Aguarde a conclusão antes de enviar outra mensagem.",
    );
  }

  const health = await deps.gateway.healthCheck();
  const description = deps.gateway.describe();
  if (description.status === "not_configured" || health.status === "not_configured") {
    throw new AppError(
      "AI_PROVIDER_NOT_CONFIGURED",
      "O serviço de inteligência artificial está temporariamente indisponível. Tente novamente mais tarde.",
    );
  }
  if (health.status === "unavailable") {
    throw new AppError(
      "UNAVAILABLE",
      "O provedor de inteligência artificial está indisponível no momento. Tente novamente mais tarde.",
    );
  }

  inFlight.add(dailyKey);
  try {
    const result = await deps.gateway.generateText({
      userId: PUBLIC_JURIS_ONE_USER_ID,
      organizationId: PUBLIC_JURIS_ONE_ORG_ID,
      feature: PUBLIC_FEATURE,
      promptVersion: "juris-one-public-v1",
      instructions: systemPrompt(locale),
      input: buildInput(input.message, input.history),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      retrySafe: false,
    });

    dailyCounts.set(dailyKey, { day, count: used + 1 });
    const remainingToday = Math.max(0, DAILY_LIMIT - (used + 1));

    return {
      reply: result.data,
      provider: result.provider,
      model: result.model,
      remainingToday,
      dailyLimit: DAILY_LIMIT,
      faqHint: null,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "UNAVAILABLE",
      "Não foi possível obter resposta da inteligência artificial. Tente novamente mais tarde.",
    );
  } finally {
    inFlight.delete(dailyKey);
  }
}

/** Exposto para testes — não usar em produção. */
export function __resetPublicJurisOneCountersForTests(): void {
  dailyCounts.clear();
  inFlight.clear();
}
