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
  calls: string[] = [];
  async generateText(request: { input?: string; instructions?: string }) {
    this.calls.push(String(request.instructions ?? "") + String(request.input ?? ""));
    if (String(request.instructions ?? "").includes("Planeje etapas")) {
      return {
        text: JSON.stringify({
          steps: [
            {
              toolName: "identify_missing_documents",
              title: "Identificar lacunas",
              requiresApproval: false,
            },
            {
              toolName: "generate_report",
              title: "Relatório interno",
              requiresApproval: false,
            },
          ],
        }),
        model: "gpt-4o-mini",
        usage: { inputTokens: 20, outputTokens: 40 },
      };
    }
    return {
      text: "Relatório assistivo de teste Work — revisão humana obrigatória.",
      model: "gpt-4o-mini",
      usage: { inputTokens: 30, outputTokens: 50 },
    };
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

describe("Juris One Work agent", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  const provider = new FakeOpenAI();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;
  let orgId: string;
  let otherCookie: string;
  let otherOrgId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    const gateway = new AIGateway(
      { ai: true },
      {
        providerId: "openai",
        providers: { openai: provider },
        defaultModel: "gpt-4o-mini",
      },
    );
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      aiGateway: gateway,
    });
    cookie = await registerVerified(app, email, {
      displayName: "Work Agent",
      email: "work.agent@exemplo.com",
    });
    orgId = (
      await call(app, "POST", "/v1/organizations", { name: "Org Work Agent" }, cookie)
    ).json<{ organization: { id: string } }>().organization.id;

    otherCookie = await registerVerified(app, email, {
      displayName: "Work Other",
      email: "work.other@exemplo.com",
    });
    otherOrgId = (
      await call(app, "POST", "/v1/organizations", { name: "Org Work Other" }, otherCookie)
    ).json<{ organization: { id: string } }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("planeja, exige aprovação, executa passo interno com IA e bloqueia ação externa", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work`,
      {
        title: "Dossiê com minuta",
        objective:
          "Organizar dossiê, gerar relatório e preparar minuta. Não protocolar nem enviar e-mail.",
      },
      cookie,
    );
    expect(created.statusCode).toBe(201);
    const body = created.json<{
      task: { id: string; status: string };
      credits: { balance: number };
    }>();
    expect(body.task.status).toBe("awaiting_approval");
    expect(body.credits.balance).toBeLessThanOrEqual(5);

    const detail = await call(
      app,
      "GET",
      `/v1/organizations/${orgId}/juris-work/${body.task.id}`,
      undefined,
      cookie,
    );
    expect(detail.statusCode).toBe(200);
    const steps = detail.json<{
      steps: Array<{ id: string; toolName: string; status: string; requiresApproval: boolean }>;
    }>().steps;
    expect(steps.length).toBeGreaterThan(0);

    const premature = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work/${body.task.id}/run-next`,
      {},
      cookie,
    );
    expect(premature.statusCode).toBe(409);

    const approved = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work/${body.task.id}/approve`,
      {},
      cookie,
    );
    expect(approved.statusCode).toBe(200);

    const ran = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work/${body.task.id}/run-next`,
      {},
      cookie,
    );
    expect(ran.statusCode).toBe(200);
    const ranBody = ran.json<{
      step: {
        status: string;
        output: { status: string; content: string; humanReviewRequired: boolean };
      };
      done: boolean;
    }>();
    expect(ranBody.step.status).toBe("completed");
    expect(ranBody.step.output.status).toBe("ai_assisted_internal");
    expect(ranBody.step.output.content).toMatch(/revisão humana/i);
    expect(ranBody.step.output.humanReviewRequired).toBe(true);

    const externalStep = steps.find((step) =>
      ["send_external_message", "protocol_petition", "execute_payment"].includes(step.toolName),
    );
    if (externalStep) {
      const approveExternal = await call(
        app,
        "POST",
        `/v1/organizations/${orgId}/juris-work/${body.task.id}/steps/${externalStep.id}/approve`,
        {},
        cookie,
      );
      expect(approveExternal.statusCode).toBe(503);
      expect(approveExternal.json<{ error: { code: string } }>().error.code).toBe("NOT_CONFIGURED");
    }
  });

  it("isola organizações (404 para tarefa alheia)", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work`,
      {
        title: "Tarefa isolada",
        objective: "Gerar checklist interno para revisão humana da equipe.",
      },
      cookie,
    );
    const taskId = created.json<{ task: { id: string } }>().task.id;

    const cross = await call(
      app,
      "GET",
      `/v1/organizations/${otherOrgId}/juris-work/${taskId}`,
      undefined,
      otherCookie,
    );
    expect(cross.statusCode).toBe(404);

    const foreign = await call(
      app,
      "GET",
      `/v1/organizations/${orgId}/juris-work/${taskId}`,
      undefined,
      otherCookie,
    );
    expect([403, 404]).toContain(foreign.statusCode);
  });
});
