import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiGatewayFromEnv } from "./gateway.js";
import { OpenAIProvider } from "./openai-provider.js";

describe("OpenAIProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("generateText chama chat/completions com Bearer e modelo padrão", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            choices: [{ message: { content: "olá" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 2 },
          }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAIProvider({ apiKey: "sk-test" });
    const result = await provider.generateText({
      feature: "foundation-check",
      model: null,
      system: "sys",
      input: "in",
      signal: new AbortController().signal,
    });

    expect(result.text).toBe("olá");
    expect(result.model).toBe("gpt-4o-mini");
    expect(result.usage.inputTokens).toBe(10);
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    expect(call).toBeDefined();
    const url = String(call?.[0]);
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("gpt-4o-mini");
    expect(JSON.stringify(init)).not.toContain("sk-live");
  });

  it("generateStructured pede JSON e faz parse do content", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            model: "gpt-4o-mini",
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          { status: 200 },
        ),
    );
    const provider = new OpenAIProvider({
      apiKey: "sk-test",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const result = await provider.generateStructured({
      feature: "document_classification",
      model: "gpt-4o-mini",
      system: "sys",
      input: "in",
      schemaName: "Doc",
      signal: new AbortController().signal,
    });
    expect(result.data).toEqual({ ok: true });
    const first = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
    const init = (first?.[1] ?? {}) as RequestInit;
    const body = JSON.parse(String(init.body)) as {
      response_format: { type: string };
    };
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("healthCheck sem rede quando OPENAI_HEALTHCHECK não é 1", async () => {
    const fetchMock = vi.fn();
    const provider = new OpenAIProvider({
      apiKey: "sk-test",
      healthCheckNetwork: false,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const health = await provider.healthCheck();
    expect(health.status).toBe("ok");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("createAiGatewayFromEnv não registra openai sem FEATURE_AI=1", () => {
    const gateway = createAiGatewayFromEnv({
      FEATURE_AI: "0",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
    });
    expect(gateway.describe().status).toBe("not_configured");
  });

  it("createAiGatewayFromEnv registra openai com FEATURE_AI=1 e chave", () => {
    const gateway = createAiGatewayFromEnv({
      FEATURE_AI: "1",
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test",
      OPENAI_DEFAULT_MODEL: "gpt-4o-mini",
    });
    expect(gateway.describe()).toMatchObject({
      status: "configured",
      provider: "openai",
    });
  });

  it("createAiGatewayFromEnv com openai sem chave permanece not_configured", () => {
    const gateway = createAiGatewayFromEnv({
      FEATURE_AI: "1",
      AI_PROVIDER: "openai",
    });
    expect(gateway.describe().status).toBe("not_configured");
  });
});
