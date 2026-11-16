import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import {
  ensureInitialWorkCredits,
  getWorkCreditBalance,
  releaseReservedCredit,
  reserveWorkCreditIdempotencyKey,
} from "./modules/juris-work/credits.js";
import { call, registerVerified } from "./test-helpers.js";

describe("JurisOne Work credit ledger", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let cookie: string;
  let orgId: string;
  let userId: string;

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
    cookie = await registerVerified(app, email, {
      displayName: "Work Credits",
      email: "work.credits@exemplo.com",
    });
    const me = await call(app, "GET", "/v1/auth/session", undefined, cookie);
    userId = me.json<{ account: { user: { id: string } } }>().account.user.id;
    orgId = (
      await call(app, "POST", "/v1/organizations", { name: "Org Work Credits" }, cookie)
    ).json<{ organization: { id: string } }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("ensure initial grants 5 once only", async () => {
    const first = await ensureInitialWorkCredits(database.db, {
      organizationId: orgId,
      userId,
    });
    expect(first.granted).toBe(true);
    expect(first.credits.balance).toBe(5);
    expect(first.credits.lifetimeGranted).toBe(5);

    const second = await ensureInitialWorkCredits(database.db, {
      organizationId: orgId,
      userId,
    });
    expect(second.granted).toBe(false);
    expect(second.credits.balance).toBe(5);
    expect(second.credits.lifetimeGranted).toBe(5);

    const viaApi = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work/credits/ensure-initial`,
      {},
      cookie,
    );
    expect(viaApi.statusCode).toBe(200);
    expect(viaApi.json<{ credits: { balance: number } }>().credits.balance).toBe(5);
  });

  it("reserve then insufficient second reserve", async () => {
    // Drain to 1 by creating 4 reserved-style debits after initial 5.
    // Use synthetic task ids (no FK required for ledger when taskId null — but reserve needs taskId uuid).
    // Create real tasks via API until balance is 1, then try one more reserve via service.
    const balanceBefore = await getWorkCreditBalance(database.db, orgId, userId);
    // Reset path: if previous test left 5, reserve until 1 left using temporary ledger via create tasks.
    let remaining = balanceBefore.balance;
    const createdTaskIds: string[] = [];
    while (remaining > 1) {
      const created = await call(
        app,
        "POST",
        `/v1/organizations/${orgId}/juris-work`,
        {
          title: `Tarefa drain ${remaining}`,
          objective: "Organizar dossiê interno para análise documental completa.",
        },
        cookie,
      );
      expect(created.statusCode).toBe(201);
      const body = created.json<{
        task: { id: string };
        credits: { balance: number };
      }>();
      createdTaskIds.push(body.task.id);
      remaining = body.credits.balance;
    }
    expect(remaining).toBe(1);

    const lastOk = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work`,
      {
        title: "Último crédito",
        objective: "Extrair dados estruturados do dossiê para revisão humana.",
      },
      cookie,
    );
    expect(lastOk.statusCode).toBe(201);
    expect(lastOk.json<{ credits: { balance: number } }>().credits.balance).toBe(0);

    const insufficient = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work`,
      {
        title: "Sem crédito",
        objective: "Gerar relatório interno quando não houver saldo disponível.",
      },
      cookie,
    );
    expect(insufficient.statusCode).toBeGreaterThanOrEqual(400);
    const bal = await getWorkCreditBalance(database.db, orgId, userId);
    expect(bal.balance).toBe(0);
    expect(createdTaskIds.length).toBeGreaterThan(0);
  });

  it("create work task reserves credit; cancel before run releases", async () => {
    // Top-up via ensure won't grant again — adjust by releasing prior reserved tasks.
    // Cancel all awaiting_approval tasks from previous test to recover credits.
    const list = await call(app, "GET", `/v1/organizations/${orgId}/juris-work`, undefined, cookie);
    const items = list.json<{ items: Array<{ id: string; status: string }> }>().items;
    for (const item of items) {
      if (item.status === "awaiting_approval") {
        await call(
          app,
          "POST",
          `/v1/organizations/${orgId}/juris-work/${item.id}/cancel`,
          {},
          cookie,
        );
      }
    }

    const afterRelease = await getWorkCreditBalance(database.db, orgId, userId);
    expect(afterRelease.balance).toBeGreaterThanOrEqual(1);

    const created = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work`,
      {
        title: "Reserva e cancelamento",
        objective: "Identificar documentos ausentes e organizar o dossiê interno.",
      },
      cookie,
    );
    expect(created.statusCode).toBe(201);
    const createdBody = created.json<{
      task: { id: string };
      credits: { balance: number; lifetimeGranted: number };
    }>();
    const balanceAfterCreate = createdBody.credits.balance;

    const cancelled = await call(
      app,
      "POST",
      `/v1/organizations/${orgId}/juris-work/${createdBody.task.id}/cancel`,
      {},
      cookie,
    );
    expect(cancelled.statusCode).toBe(200);
    const cancelledBody = cancelled.json<{
      task: { status: string };
      credits: { balance: number };
    }>();
    expect(cancelledBody.task.status).toBe("cancelled");
    expect(cancelledBody.credits.balance).toBe(balanceAfterCreate + 1);

    // Idempotent release
    await releaseReservedCredit(database.db, {
      organizationId: orgId,
      userId,
      taskId: createdBody.task.id,
    });
    const finalBal = await getWorkCreditBalance(database.db, orgId, userId);
    expect(finalBal.balance).toBe(cancelledBody.credits.balance);

    const creditsView = await call(
      app,
      "GET",
      `/v1/organizations/${orgId}/juris-work/credits`,
      undefined,
      cookie,
    );
    expect(creditsView.statusCode).toBe(200);
    const view = creditsView.json<{
      credits: { balance: number; lifetimeGranted: number };
      ledger: unknown[];
    }>();
    expect(view.credits.lifetimeGranted).toBe(5);
    expect(view.ledger.length).toBeGreaterThan(0);
    expect(reserveWorkCreditIdempotencyKey(createdBody.task.id)).toContain(createdBody.task.id);
  });
});
