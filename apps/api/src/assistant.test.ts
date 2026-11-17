import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 32/33 — assistant", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookieA: string;
  let cookieB: string;
  let orgA: string;
  let orgB: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    cookieA = await registerVerified(app, email, {
      displayName: "Assist A",
      email: "assist.a@exemplo.com",
    });
    cookieB = await registerVerified(app, email, {
      displayName: "Assist B",
      email: "assist.b@exemplo.com",
    });
    orgA = (await call(app, "POST", "/v1/organizations", { name: "Org Assist A" }, cookieA)).json<{
      organization: { id: string };
    }>().organization.id;
    orgB = (await call(app, "POST", "/v1/organizations", { name: "Org Assist B" }, cookieB)).json<{
      organization: { id: string };
    }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("permission, cross-tenant, no critical action, AI not silently FAQ", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/assistant/conversations`,
      { title: "Ajuda", locale: "pt-BR" },
      cookieA,
    );
    expect(created.statusCode).toBe(201);
    const conversationId = created.json<{ conversation: { id: string } }>().conversation.id;

    const cross = await call(
      app,
      "POST",
      `/v1/organizations/${orgB}/assistant/messages`,
      { sessionId: conversationId, content: "Olá" },
      cookieB,
    );
    expect(cross.statusCode).toBeGreaterThanOrEqual(400);

    const critical = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/assistant/messages`,
      { sessionId: conversationId, content: "Por favor aprovar o pagamento agora" },
      cookieA,
    );
    expect(critical.statusCode).toBeGreaterThanOrEqual(400);

    const msg = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/assistant/messages`,
      { sessionId: conversationId, content: "Como resetar minha senha?" },
      cookieA,
    );
    // Sem provedor configurado no teste: erro honesto — nunca FAQ fingindo ser IA.
    expect(msg.statusCode).toBeGreaterThanOrEqual(400);
    const err = msg.json<{ error?: { code?: string }; code?: string; message?: string }>();
    const code = err.error?.code ?? err.code ?? "";
    expect(["AI_PROVIDER_NOT_CONFIGURED", "NOT_CONFIGURED", "UNAVAILABLE"]).toContain(code);

    const tool = await call(
      app,
      "POST",
      `/v1/organizations/${orgA}/assistant/tools/createSupportRequest`,
      { conversationId, params: { subject: "Preciso de ajuda" } },
      cookieA,
    );
    expect(tool.statusCode).toBe(200);
  });
});
