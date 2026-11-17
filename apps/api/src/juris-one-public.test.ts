import { describe, expect, it, beforeEach } from "vitest";
import { AIGateway, NotConfiguredAIProvider, type AIProvider } from "@verasjuris/ai";
import { AICapability } from "@verasjuris/ai";
import { MemoryRateLimiter } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import {
  __resetPublicJurisOneCountersForTests,
  publicJurisOneChat,
} from "./modules/juris-one-public/service.js";

class FakeOpenAI implements AIProvider {
  readonly id = "openai";
  readonly capabilities = [AICapability.TEXT] as const;
  async generateText() {
    return { text: "Resposta real do modelo.", model: "gpt-4o-mini", usage: {} };
  }
  async healthCheck() {
    return {
      status: "ok" as const,
      detail: "fake",
      checkedAt: new Date().toISOString(),
    };
  }
}

describe("juris-one public chat", () => {
  beforeEach(() => {
    __resetPublicJurisOneCountersForTests();
  });

  it("recusa quando o provedor não está configurado (sem FAQ como IA)", async () => {
    const gateway = new AIGateway(
      { ai: true },
      {
        providerId: "not_configured",
        providers: { not_configured: new NotConfiguredAIProvider() },
      },
    );
    await expect(
      publicJurisOneChat(
        { gateway, rateLimiter: new MemoryRateLimiter() },
        { message: "Olá", ip: "127.0.0.1", visitorId: "visitor_test_01" },
      ),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_NOT_CONFIGURED" });
  });

  it("gera resposta real quando o provedor está configurado", async () => {
    const gateway = new AIGateway(
      { ai: true },
      {
        providerId: "openai",
        providers: {
          not_configured: new NotConfiguredAIProvider(),
          openai: new FakeOpenAI(),
        },
        defaultModel: "gpt-4o-mini",
      },
    );
    // Registrar feature via gateway features padrão (juris_one.public_chat já no DEFAULT)
    const result = await publicJurisOneChat(
      { gateway, rateLimiter: new MemoryRateLimiter() },
      { message: "Como criar conta?", ip: "10.0.0.1", visitorId: "visitor_ok_01" },
    );
    expect(result.reply).toContain("Resposta real");
    expect(result.provider).toBe("openai");
    expect(result.remainingToday).toBe(4);
  });

  it("aplica limite diário no servidor", async () => {
    const gateway = new AIGateway(
      { ai: true },
      {
        providerId: "openai",
        providers: {
          not_configured: new NotConfiguredAIProvider(),
          openai: new FakeOpenAI(),
        },
        defaultModel: "gpt-4o-mini",
      },
    );
    const deps = { gateway, rateLimiter: new MemoryRateLimiter() };
    const visitorId = "visitor_limit_01";
    for (let i = 0; i < 5; i += 1) {
      await publicJurisOneChat(deps, { message: `msg ${i}`, ip: "10.0.0.2", visitorId });
    }
    await expect(
      publicJurisOneChat(deps, { message: "extra", ip: "10.0.0.2", visitorId }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
