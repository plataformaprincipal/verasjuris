import { AppError } from "@verasjuris/types";
import { AICapability } from "./capabilities.js";
import { AiNotConfiguredError, toAiAppError } from "./errors.js";
import type {
  AIProvider,
  AIProviderBaseRequest,
  AIProviderHealth,
  AIProviderStructuredRequest,
  AIProviderStructuredResult,
  AIProviderTextResult,
  AIProviderUsage,
} from "./provider.js";

export type OpenAIProviderOptions = {
  apiKey: string;
  defaultModel?: string | undefined;
  /** Quando true, healthCheck consulta GET /v1/models com timeout curto. */
  healthCheckNetwork?: boolean;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
};

type ChatCompletionResponse = {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

const DEFAULT_MODEL = "gpt-4o-mini";
const CHAT_PATH = "/chat/completions";
const MODELS_PATH = "/models";

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new AppError("AI_INVALID_RESPONSE", "O provedor de IA devolveu uma resposta vazia.");
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as unknown;
      } catch {
        // fall through
      }
    }
    throw new AppError(
      "AI_INVALID_RESPONSE",
      "A resposta estruturada do provedor de IA não é um JSON válido.",
    );
  }
}

function mapUsage(usage: ChatCompletionResponse["usage"]): AIProviderUsage {
  return {
    ...(typeof usage?.prompt_tokens === "number" ? { inputTokens: usage.prompt_tokens } : {}),
    ...(typeof usage?.completion_tokens === "number"
      ? { outputTokens: usage.completion_tokens }
      : {}),
  };
}

/**
 * Adapter OpenAI via fetch — sem SDK.
 * Nunca registra a API key. Só é instanciado quando FEATURE_AI=1 e a chave existe.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly capabilities: readonly AICapability[] = [
    AICapability.TEXT,
    AICapability.STRUCTURED_OUTPUT,
  ];

  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly healthCheckNetwork: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: OpenAIProviderOptions) {
    const apiKey = options.apiKey.trim();
    if (!apiKey) {
      throw new AiNotConfiguredError(
        "OPENAI_API_KEY ausente. Nenhum texto foi gerado e nenhum fornecedor foi chamado.",
      );
    }
    this.apiKey = apiKey;
    this.defaultModel = options.defaultModel?.trim() || DEFAULT_MODEL;
    this.healthCheckNetwork = options.healthCheckNetwork === true;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  }

  private resolveModel(requested: string | null): string {
    return requested?.trim() || this.defaultModel;
  }

  private async chat(
    request: AIProviderBaseRequest,
    extra: { jsonObject?: boolean },
  ): Promise<AIProviderTextResult> {
    const model = this.resolveModel(request.model);
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.input },
      ],
      ...(request.maxOutputTokens !== undefined ? { max_tokens: request.maxOutputTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(extra.jsonObject ? { response_format: { type: "json_object" } } : {}),
    };

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${CHAT_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });
    } catch (error) {
      throw toAiAppError(error);
    }

    if (response.status === 429) {
      throw new AppError(
        "AI_PROVIDER_RATE_LIMITED",
        "O provedor de IA limitou a taxa de requisições.",
      );
    }
    if (!response.ok) {
      throw new AppError(
        "AI_PROVIDER_UNAVAILABLE",
        "O provedor de IA está indisponível no momento.",
      );
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const text = payload.choices?.[0]?.message?.content ?? "";
    if (!text) {
      throw new AppError("AI_INVALID_RESPONSE", "O provedor de IA devolveu uma resposta vazia.");
    }

    return {
      text,
      model: payload.model ?? model,
      usage: mapUsage(payload.usage),
      ...(payload.choices?.[0]?.finish_reason
        ? { finishReason: payload.choices[0].finish_reason }
        : {}),
    };
  }

  async generateText(request: AIProviderBaseRequest): Promise<AIProviderTextResult> {
    return this.chat(request, {});
  }

  async generateStructured(
    request: AIProviderStructuredRequest,
  ): Promise<AIProviderStructuredResult> {
    const textResult = await this.chat(request, { jsonObject: true });
    return {
      data: parseJsonContent(textResult.text),
      model: textResult.model,
      usage: textResult.usage,
      ...(textResult.finishReason ? { finishReason: textResult.finishReason } : {}),
    };
  }

  async healthCheck(): Promise<AIProviderHealth> {
    const checkedAt = new Date().toISOString();
    if (!this.apiKey) {
      return {
        status: "not_configured",
        detail: "OPENAI_API_KEY ausente.",
        checkedAt,
      };
    }
    if (!this.healthCheckNetwork) {
      return {
        status: "ok",
        detail: "OPENAI_API_KEY presente; verificação de rede desativada (OPENAI_HEALTHCHECK≠1).",
        checkedAt,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_500);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${MODELS_PATH}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          status: "degraded",
          detail: "Falha ao listar modelos OpenAI.",
          checkedAt: new Date().toISOString(),
        };
      }
      return { status: "ok", detail: "OpenAI alcançável.", checkedAt: new Date().toISOString() };
    } catch {
      return {
        status: "unavailable",
        detail: "OpenAI indisponível no health check.",
        checkedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
