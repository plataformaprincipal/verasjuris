/**
 * Testes pós-build do artefato serverless CJS.
 *
 * Exige `apps/api/dist/vercel.cjs` gerado por `pnpm --filter @verasjuris/api build`.
 * Não faz parte de `pnpm test` (unitário); rode via `pnpm test:artifacts` após o build.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifact = path.join(apiRoot, "dist", "vercel.cjs");

describe("vercel compiled artifact", () => {
  it("dist/vercel.cjs existe, é CJS e exporta o handler Fastify", () => {
    expect(
      existsSync(artifact),
      `artefato ausente: ${artifact} — execute o build da API antes`,
    ).toBe(true);

    const stats = statSync(artifact);
    expect(stats.size).toBeGreaterThan(100);

    const source = readFileSync(artifact, "utf8");
    expect(source).toMatch(/exports\.default\s*=|module\.exports/);

    const require = createRequire(import.meta.url);
    const mod = require(artifact) as {
      default?: unknown;
      createVercelHandler?: unknown;
    };

    expect(typeof mod.default).toBe("function");
    expect(typeof mod.createVercelHandler).toBe("function");
  });
});
