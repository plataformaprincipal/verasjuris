import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { createAppFromEnv } from "./create-app-from-env.js";

export type CreateAppFn = () => Promise<{ app: FastifyInstance }>;

type InjectHttpMethod = "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT" | "OPTIONS";

const INJECT_METHODS = new Set<string>([
  "DELETE",
  "GET",
  "HEAD",
  "PATCH",
  "POST",
  "PUT",
  "OPTIONS",
]);

function injectMethod(raw: string | undefined): InjectHttpMethod {
  const method = (raw ?? "GET").toUpperCase();
  return (INJECT_METHODS.has(method) ? method : "GET") as InjectHttpMethod;
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return undefined;
  return Buffer.concat(chunks);
}

function headerMap(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
}

/** Remove credenciais/URLs sensíveis de detalhes de erro públicos. */
export function publicBootDetail(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'\\]+/gi, "[redacted-db-url]")
    .replace(/(password|passwd|pwd|secret|token|api[_-]?key)=[^\s&"']+/gi, "$1=[redacted]")
    .replace(/\$aact_[a-z0-9_]+/gi, "[redacted-asaas-key]")
    .slice(0, 200);
}

export type VercelHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/**
 * Factory do handler `@vercel/node`.
 * - Singleton lazy da app Fastify (sem `listen`).
 * - Reutiliza a mesma Promise entre cold starts / concorrência.
 * - Em falha de boot, descarta a Promise para permitir retry na próxima invocação.
 * - Encaminha via `inject` (padrão estável serverless; não depende de server HTTP persistente).
 */
export function createVercelHandler(options?: {
  createApp?: CreateAppFn;
}): VercelHandler {
  const createApp = options?.createApp ?? createAppFromEnv;
  let appPromise: Promise<FastifyInstance> | null = null;

  async function getApp(): Promise<FastifyInstance> {
    if (!appPromise) {
      appPromise = createApp()
        .then(({ app }) => app)
        .catch((error: unknown) => {
          appPromise = null;
          throw error;
        });
    }
    return appPromise;
  }

  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const app = await getApp();
      await app.ready();
      const rawBody = await readBody(req);
      const headers = headerMap(req);
      const contentType = headers["content-type"] ?? "";
      // Fastify inject parseia JSON/texto de forma mais previsível com string.
      const payload =
        rawBody === undefined
          ? undefined
          : /json|text|xml|urlencoded/i.test(contentType)
            ? rawBody.toString("utf8")
            : rawBody;
      // `req.url` no Node/Vercel já inclui path + query string.
      const response = await app.inject({
        method: injectMethod(req.method),
        url: req.url && req.url.length > 0 ? req.url : "/",
        headers,
        payload,
        remoteAddress: req.socket?.remoteAddress,
      });

      res.statusCode = response.statusCode;
      for (const [key, value] of Object.entries(response.headers)) {
        if (value === undefined) continue;
        if (key.toLowerCase() === "transfer-encoding") continue;
        res.setHeader(key, value as string | number | string[]);
      }
      res.end(response.body);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "API_BOOT_FAILED";
      if (!res.headersSent) {
        res.statusCode = 503;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "API indisponível no momento.",
              detail: publicBootDetail(raw),
            },
          }),
        );
      }
    }
  };
}

/**
 * Handler Node.js compatível com Vercel (`@vercel/node`).
 * Default export exigido pelo runtime.
 */
const handler = createVercelHandler();
export default handler;
