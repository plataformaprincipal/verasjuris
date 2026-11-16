#!/usr/bin/env node
/**
 * Verifica o artefato serverless CJS após o build.
 * Deve rodar depois de `pnpm --filter @verasjuris/api build` (como no CI).
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifact = path.join(apiRoot, "dist", "vercel.cjs");

function fail(message) {
  console.error(`verify-vercel-cjs: ${message}`);
  process.exit(1);
}

if (!existsSync(artifact)) {
  fail(`artefato ausente: ${artifact} (execute o build da API antes)`);
}

const stats = statSync(artifact);
if (stats.size < 100) {
  fail(`artefato muito pequeno (${stats.size} bytes): ${artifact}`);
}

const source = readFileSync(artifact, "utf8");
if (!/exports\.default\s*=/.test(source) && !/module\.exports/.test(source)) {
  fail("artefato CJS sem exports.default / module.exports");
}

const require = createRequire(import.meta.url);
let mod;
try {
  mod = require(artifact);
} catch (error) {
  fail(`falha ao carregar ${artifact}: ${error instanceof Error ? error.message : String(error)}`);
}

if (typeof mod?.default !== "function") {
  fail("export default do handler não é uma função");
}

if (typeof mod.createVercelHandler !== "function") {
  fail("createVercelHandler não exportado no artefato CJS");
}

console.log(
  JSON.stringify({
    ok: true,
    artifact: path.relative(apiRoot, artifact),
    sizeBytes: stats.size,
    defaultExport: "function",
    createVercelHandler: "function",
  }),
);
