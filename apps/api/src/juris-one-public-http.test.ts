import { AICapability, AIGateway, type AIProvider } from "@verasjuris/ai";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { CSRF_HEADER } from "@verasjuris/security";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

class FakeOpenAI implements AIProvider {
  readonly id = "openai";
  readonly capabilities = [AICapability.TEXT] as const;
  async generateText() {
    return { text: "Resposta HTTP real.", model: "gpt-4o-mini", usage: {} };
  }
  async generateStructured() {
    return { data: {}, model: "gpt-4o-mini", usage: {}, finishReason: "stop" as const };
  }
  async healthCheck() {
    return {
      status: "ok" as const,
      detail: "fake",
      checkedAt: new Date().toISOString(),
    };
  }
}

describe("Juris One public chat HTTP + CSRF", () => {
  const started = createTestDatabase();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email: new MemoryEmailProvider(),
      aiGateway: new AIGateway(
        { ai: true },
        {
          providerId: "openai",
          providers: { openai: new FakeOpenAI() },
          defaultModel: "gpt-4o-mini",
        },
      ),
    });
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("rejeita POST público sem x-verasjuris-request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/juris-one/public/chat",
      headers: { "content-type": "application/json" },
      payload: {
        message: "Olá",
        locale: "pt-BR",
        visitorId: "visitor_csrf_fail_01",
        history: [],
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json<{ error: { code: string } }>().error.code).toBe("AUTHORIZATION_ERROR");
  });

  it("aceita POST público com x-verasjuris-request: 1", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/juris-one/public/chat",
      headers: {
        "content-type": "application/json",
        [CSRF_HEADER]: "1",
      },
      payload: {
        message: "Como criar conta?",
        locale: "pt-BR",
        visitorId: "visitor_csrf_ok_01",
        history: [],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<{ reply: string; provider: string }>().reply).toContain("Resposta HTTP");
    expect(res.json<{ provider: string }>().provider).toBe("openai");
  });
});
