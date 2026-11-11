import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createVercelHandler, publicBootDetail } from "./vercel.js";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function withHandler(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: string | Buffer;
  },
): Promise<{ statusCode: number; headers: Record<string, string>; body: string }> {
  const server = createServer((req, res) => {
    void handler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("server address unavailable");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${request.path}`, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return {
      statusCode: response.status,
      headers,
      body: await response.text(),
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function buildMockApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.get("/health", async () => ({ status: "ok", source: "fastify" }));
  app.get("/v1/health", async () => ({ status: "ok", route: "v1" }));
  const echo = async (request: {
    method: string;
    query: unknown;
    headers: Record<string, unknown>;
    body: unknown;
  }) => ({
    method: request.method,
    query: request.query,
    headers: {
      "x-test": request.headers["x-test"] ?? null,
      "content-type": request.headers["content-type"] ?? null,
    },
    body: request.body ?? null,
  });
  app.post("/v1/echo", echo);
  app.put("/v1/echo", echo);
  app.patch("/v1/echo", echo);
  app.delete("/v1/echo", echo);
  await app.ready();
  return app;
}

describe("vercel serverless bootstrap", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("source usa inject e não server.emit", () => {
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "vercel.ts");
    const source = readFileSync(file, "utf8");
    expect(source).toContain("app.inject");
    expect(source).toContain("createVercelHandler");
    expect(source.includes("server.emit")).toBe(false);
  });

  it("vercel.json aponta para artefato CJS e build monorepo", () => {
    const file = path.join(apiRoot, "vercel.json");
    const json = JSON.parse(readFileSync(file, "utf8")) as {
      installCommand: string;
      buildCommand: string;
      builds: Array<{ src: string; use: string }>;
      routes: Array<{ src: string; dest: string }>;
    };
    expect(json.installCommand).toContain("pnpm install");
    expect(json.buildCommand).toContain("@verasjuris/api");
    expect(json.builds[0]?.src).toBe("dist/vercel.cjs");
    expect(json.builds[0]?.use).toBe("@vercel/node");
    expect(json.routes[0]?.src).toBe("/(.*)");
    expect(json.routes[0]?.dest).toBe("dist/vercel.cjs");
  });

  it("publicBootDetail redige URLs e segredos", () => {
    const detail = publicBootDetail(
      "fail postgres://user:secret@db.example:5432/app password=abc $aact_prod_xxx",
    );
    expect(detail).not.toContain("secret");
    expect(detail).not.toContain("password=abc");
    expect(detail).not.toContain("$aact_prod");
    expect(detail).toContain("[redacted");
  });

  it("GET /health e /v1/health respondem via Fastify", async () => {
    const app = await buildMockApp();
    const handler = createVercelHandler({
      createApp: async () => ({ app }),
    });

    const health = await withHandler(handler, { method: "GET", path: "/health" });
    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body)).toEqual({ status: "ok", source: "fastify" });

    const v1 = await withHandler(handler, { method: "GET", path: "/v1/health" });
    expect(v1.statusCode).toBe(200);
    expect(JSON.parse(v1.body)).toEqual({ status: "ok", route: "v1" });

    await app.close();
  });

  it("preserva método, query, headers e JSON body", async () => {
    const app = await buildMockApp();
    const handler = createVercelHandler({
      createApp: async () => ({ app }),
    });

    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const withBody = method !== "DELETE";
      const result = await withHandler(handler, {
        method,
        path: "/v1/echo?ref=42&x=1",
        headers: {
          ...(withBody ? { "content-type": "application/json" } : {}),
          "x-test": `hdr-${method}`,
        },
        ...(withBody ? { body: JSON.stringify({ hello: method }) } : {}),
      });
      if (result.statusCode !== 200) {
        throw new Error(`${method} failed: ${result.statusCode} ${result.body}`);
      }
      const payload = JSON.parse(result.body) as {
        method: string;
        query: Record<string, string>;
        headers: Record<string, string | null>;
        body: unknown;
      };
      expect(payload.method).toBe(method);
      expect(payload.query).toEqual({ ref: "42", x: "1" });
      expect(payload.headers["x-test"]).toBe(`hdr-${method}`);
      if (method === "DELETE") {
        expect(payload.body === null || payload.body === undefined || payload.body === "").toBe(
          true,
        );
      } else {
        expect(payload.body).toEqual({ hello: method });
      }
    }

    await app.close();
  });

  it("requisições concorrentes compartilham uma única inicialização", async () => {
    let boots = 0;
    const app = await buildMockApp();
    const handler = createVercelHandler({
      createApp: async () => {
        boots += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { app };
      },
    });

    const results = await Promise.all([
      withHandler(handler, { method: "GET", path: "/health" }),
      withHandler(handler, { method: "GET", path: "/v1/health" }),
      withHandler(handler, { method: "GET", path: "/health" }),
    ]);

    expect(boots).toBe(1);
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    await app.close();
  });

  it("falha de bootstrap devolve 503 controlado e permite retry", async () => {
    let attempt = 0;
    const app = await buildMockApp();
    const handler = createVercelHandler({
      createApp: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error("postgres://u:p@host/db boom");
        }
        return { app };
      },
    });

    const first = await withHandler(handler, { method: "GET", path: "/health" });
    expect(first.statusCode).toBe(503);
    const err = JSON.parse(first.body) as { error: { code: string; detail: string } };
    expect(err.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(err.error.detail).not.toContain("postgres://");
    expect(err.error.detail).toContain("[redacted-db-url]");

    const second = await withHandler(handler, { method: "GET", path: "/health" });
    expect(second.statusCode).toBe(200);
    expect(attempt).toBe(2);
    await app.close();
  });
});
