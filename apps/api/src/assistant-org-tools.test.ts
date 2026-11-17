import { AICapability, AIGateway, type AIProvider } from "@verasjuris/ai";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

class FakeOpenAI implements AIProvider {
  readonly id = "openai";
  readonly capabilities = [AICapability.TEXT] as const;
  async generateText() {
    return {
      text: "Resposta assistente com dados verificados quando disponíveis.",
      model: "gpt-4o-mini",
      usage: {},
    };
  }
  async generateStructured() {
    return { data: {}, model: "gpt-4o-mini", usage: {}, finishReason: "stop" as const };
  }
  async healthCheck() {
    return { status: "ok" as const, detail: "fake", checkedAt: new Date().toISOString() };
  }
}

describe("Assistente — tools org + Work compartilhado", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;
  let orgId: string;
  let conversationId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      aiGateway: new AIGateway(
        { ai: true },
        {
          providerId: "openai",
          providers: { openai: new FakeOpenAI() },
          defaultModel: "gpt-4o-mini",
        },
      ),
    });
    cookie = await registerVerified(app, email, {
      displayName: "Assist Tools",
      email: "assist.tools@exemplo.com",
    });
    orgId = (
      await call(app, "POST", "/v1/organizations", { name: "Org Assist Tools" }, cookie)
    ).json<{ organization: { id: string } }>().organization.id;
    conversationId = (
      await call(
        app,
        "POST",
        `/v1/organizations/${orgId}/assistant/conversations`,
        { title: "Tools", locale: "pt-BR" },
        cookie,
      )
    ).json<{ conversation: { id: string } }>().conversation.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("lista tools com dados reais (vazios) e cria Work compartilhado", async () => {
    const matters = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/assistant/tools/listMatters`,
      { conversationId, params: {} },
      cookie,
    );
    expect(matters.statusCode).toBe(200);
    expect(matters.json<{ result: { allowed: boolean; items: unknown[] } }>().result.allowed).toBe(
      true,
    );
    expect(matters.json<{ result: { items: unknown[] } }>().result.items).toEqual([]);

    const msg = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/assistant/messages`,
      { sessionId: conversationId, content: "Quais são meus casos e prazos?" },
      cookie,
    );
    expect(msg.statusCode).toBe(201);
    expect(msg.json<{ message: { content: string }; providerKey: string }>().providerKey).toBe(
      "openai",
    );

    const work = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/assistant/tools/createWorkTask`,
      {
        conversationId,
        params: {
          title: "Work via Assistente",
          objective: "Organizar dossiê e gerar relatório interno para revisão humana.",
        },
      },
      cookie,
    );
    expect(work.statusCode).toBe(200);
    expect(work.json<{ result: { task: { status: string } } }>().result.task.status).toBe(
      "awaiting_approval",
    );

    const draft = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/assistant/tools/prepareCommunicationDraft`,
      {
        conversationId,
        params: { subject: "Aviso", body: "Texto rascunho" },
      },
      cookie,
    );
    expect(draft.statusCode).toBe(200);
    expect(draft.json<{ result: { sendStatus: string } }>().result.sendStatus).toBe(
      "NOT_CONFIGURED",
    );
  });
});
