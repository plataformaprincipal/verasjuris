import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadDotEnv, parseWorkerEnv, createLogger } from "@verasjuris/config";
import { createDatabase } from "@verasjuris/database";
import {
  createJobQueueFromEnv,
  LocalInProcessQueueProvider,
  type JobHandler,
  type JobQueue,
  type JobRecord,
} from "@verasjuris/events";
import type { FastifyInstance } from "fastify";
import { buildWorkerApp, checkDatabase } from "./app.js";
import { captureMonitorById } from "./jobs/court-communications.js";
import { registerWorkerHandlers, type WorkerHandlerRegistry } from "./register-handlers.js";

type WorkerBoot = {
  db: ReturnType<typeof createDatabase>["db"];
  app: FastifyInstance;
  queue: JobQueue;
  handlers: WorkerHandlerRegistry;
};

let bootPromise: Promise<WorkerBoot> | null = null;

function secretsEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function readHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw) as unknown;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(payload);
}

async function getBoot(): Promise<WorkerBoot> {
  if (!bootPromise) {
    bootPromise = (async () => {
      loadDotEnv();
      const env = parseWorkerEnv(process.env);
      const logger = createLogger("worker", env.LOG_LEVEL);
      const database = createDatabase(env.DATABASE_URL);
      const queue = createJobQueueFromEnv(process.env);
      const handlers = registerWorkerHandlers(queue, database.db);
      const app = await buildWorkerApp({
        logger,
        checkDatabase: () => checkDatabase(database.db),
        queue,
      });
      await app.ready();
      return { db: database.db, app, queue, handlers };
    })();
  }
  return bootPromise;
}

async function runRegisteredOnce(
  handlers: WorkerHandlerRegistry,
  type: string,
  payload: unknown,
): Promise<JobRecord> {
  const handler = handlers.get(type);
  if (!handler) {
    throw Object.assign(new Error("JOB_HANDLER_NOT_REGISTERED"), { code: "NOT_FOUND" });
  }
  const now = new Date().toISOString();
  const job: JobRecord = {
    id: `invoke-${Date.now()}`,
    type,
    payload,
    status: "running",
    attempts: 1,
    maxAttempts: 1,
    idempotencyKey: null,
    lastError: null,
    createdAt: now,
    startedAt: now,
    completedAt: null,
  };
  await handler(job);
  return {
    ...job,
    status: "succeeded",
    completedAt: new Date().toISOString(),
  };
}

async function runJob(
  queue: JobQueue,
  handlers: WorkerHandlerRegistry,
  type: string,
  payload: unknown,
): Promise<JobRecord> {
  if (queue instanceof LocalInProcessQueueProvider) {
    const enqueued = await queue.enqueue(type, payload);
    const processed = await queue.processNext();
    return processed ?? enqueued;
  }
  return runRegisteredOnce(handlers, type, payload);
}

/**
 * Handler HTTP para Vercel Cron / invocação pontual.
 *
 * Consumidores contínuos de fila NÃO são suportados no Vercel.
 * Use cron/HTTP com WORKER_INVOKE_SECRET para disparar jobs específicos.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = (req.method ?? "GET").toUpperCase();

  if (method === "GET" && (url.pathname === "/health" || url.pathname === "/")) {
    const { app } = await getBoot();
    const response = await app.inject({ method: "GET", url: "/health" });
    res.statusCode = response.statusCode;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(response.body);
    return;
  }

  // Vercel Cron: GET com Authorization: Bearer <CRON_SECRET>.
  const cronJobs: Record<string, string> = {
    "/cron/court-communications": "COURT_COMMUNICATIONS_CAPTURE",
  };
  const cronJob = cronJobs[url.pathname];
  if (method === "GET" && cronJob) {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected) {
      sendJson(res, 503, {
        error: { code: "NOT_CONFIGURED", message: "CRON_SECRET não configurado." },
      });
      return;
    }
    const provided = readHeader(req, "authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!secretsEqual(provided, expected)) {
      sendJson(res, 401, {
        error: { code: "AUTHENTICATION_ERROR", message: "Invocação não autorizada." },
      });
      return;
    }
    try {
      const { queue, handlers } = await getBoot();
      const result = await runJob(queue, handlers, cronJob, {});
      sendJson(res, 200, { job: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "JOB_FAILED";
      sendJson(res, 500, { error: { code: "JOB_FAILED", message: message.slice(0, 500) } });
    }
    return;
  }

  // Captura sob demanda de um monitor (chamada pela API; roda aqui por causa do IP brasileiro).
  if (method === "POST" && url.pathname === "/internal/court-communications/capture") {
    const expected = process.env.WORKER_INVOKE_SECRET?.trim();
    if (!expected) {
      sendJson(res, 503, {
        error: { code: "NOT_CONFIGURED", message: "WORKER_INVOKE_SECRET não configurado." },
      });
      return;
    }
    const provided = readHeader(req, "x-worker-invoke-secret") ?? "";
    if (!secretsEqual(provided, expected)) {
      sendJson(res, 401, {
        error: { code: "AUTHENTICATION_ERROR", message: "Invocação não autorizada." },
      });
      return;
    }
    try {
      const body = (await readJsonBody(req)) as {
        monitorId?: unknown;
        from?: unknown;
        to?: unknown;
      };
      const monitorId = typeof body?.monitorId === "string" ? body.monitorId : "";
      if (!/^[0-9a-f-]{36}$/i.test(monitorId)) {
        sendJson(res, 400, { error: { code: "VALIDATION_ERROR", message: "monitorId inválido." } });
        return;
      }
      const iso = (v: unknown) =>
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
      const { db } = await getBoot();
      const result = await captureMonitorById(db, monitorId, {
        from: iso(body.from),
        to: iso(body.to),
      });
      if (!result) {
        sendJson(res, 404, { error: { code: "NOT_FOUND", message: "Monitor não encontrado." } });
        return;
      }
      sendJson(res, 200, { result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "CAPTURE_FAILED";
      sendJson(res, 500, { error: { code: "INTERNAL_ERROR", message: message.slice(0, 500) } });
    }
    return;
  }

  if (method === "POST" && url.pathname === "/internal/jobs/run") {
    const expected = process.env.WORKER_INVOKE_SECRET?.trim();
    if (!expected) {
      sendJson(res, 503, {
        error: {
          code: "NOT_CONFIGURED",
          message: "WORKER_INVOKE_SECRET não configurado.",
        },
      });
      return;
    }
    const provided =
      readHeader(req, "x-worker-invoke-secret") ??
      readHeader(req, "authorization")?.replace(/^Bearer\s+/i, "") ??
      "";
    if (!secretsEqual(provided, expected)) {
      sendJson(res, 401, {
        error: { code: "AUTHENTICATION_ERROR", message: "Invocação não autorizada." },
      });
      return;
    }

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, {
        error: { code: "VALIDATION_ERROR", message: "JSON inválido." },
      });
      return;
    }

    const type =
      body && typeof body === "object" && "type" in body
        ? String((body as { type: unknown }).type ?? "").trim()
        : "";
    const payload =
      body && typeof body === "object" && "payload" in body
        ? (body as { payload: unknown }).payload
        : {};

    if (!type) {
      sendJson(res, 400, {
        error: { code: "VALIDATION_ERROR", message: "Campo type é obrigatório." },
      });
      return;
    }

    try {
      const { queue, handlers } = await getBoot();
      if (!handlers.has(type) && !(queue instanceof LocalInProcessQueueProvider)) {
        sendJson(res, 404, {
          error: { code: "NOT_FOUND", message: "Handler de job não registrado." },
        });
        return;
      }
      const result = await runJob(queue, handlers, type, payload ?? {});
      sendJson(res, 200, { job: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "JOB_FAILED";
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code: unknown }).code)
          : "INTERNAL_ERROR";
      sendJson(res, code === "NOT_FOUND" ? 404 : 500, {
        error: { code, message: message.slice(0, 500) },
      });
    }
    return;
  }

  sendJson(res, 404, {
    error: { code: "NOT_FOUND", message: "Rota não encontrada." },
  });
}

// Mantém referência tipada usada pelos testes/docs.
export type { JobHandler };
