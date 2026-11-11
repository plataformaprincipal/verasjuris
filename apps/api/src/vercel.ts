import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { createAppFromEnv } from "./create-app-from-env.js";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = createAppFromEnv().then(({ app }) => app);
  }
  return appPromise;
}

/**
 * Handler Node.js compatível com Vercel (`@vercel/node`).
 * Lazy-singleton do Fastify; encaminha via `server.emit("request")` após `ready()`.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getApp();
  await app.ready();
  app.server.emit("request", req, res);
}
