#!/usr/bin/env node
/**
 * Empacota dist/vercel.cjs no Build Output API v3 da Vercel.
 * Root Directory: apps/api → apps/api/.vercel/output.
 *
 * - Handler CJS como index.cjs (package.json da API é "type": "module").
 * - ajv/ajv-formats são copiados para node_modules do .func porque o Ajv
 *   gera `require("ajv/dist/runtime/...")` em runtime (não embutível estaticamente).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(apiRoot, "..", "..");
const artifact = path.join(apiRoot, "dist", "vercel.cjs");
const outputRoot = path.join(apiRoot, ".vercel", "output");
const funcDir = path.join(outputRoot, "functions", "index.func");
const handlerFile = path.join(funcDir, "index.cjs");

function fail(message) {
  console.error(`prepare-vercel-output: ${message}`);
  process.exit(1);
}

function resolvePnpmPackage(packageName) {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) fail(`pnpm store ausente: ${pnpmDir}`);
  const matches = readdirSync(pnpmDir)
    .filter((entry) => entry.startsWith(`${packageName}@`))
    .sort();
  if (matches.length === 0) fail(`pacote ${packageName} não encontrado em ${pnpmDir}`);
  const candidate = path.join(pnpmDir, matches[matches.length - 1], "node_modules", packageName);
  if (!existsSync(path.join(candidate, "package.json"))) {
    fail(`estrutura pnpm inválida para ${packageName}: ${candidate}`);
  }
  return candidate;
}

function copyPackage(packageName) {
  const sourceDir = resolvePnpmPackage(packageName);
  const targetDir = path.join(funcDir, "node_modules", packageName);
  mkdirSync(path.dirname(targetDir), { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
}

if (!existsSync(artifact)) {
  fail(`artefato ausente: ${artifact}`);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });
mkdirSync(path.join(outputRoot, "static"), { recursive: true });

cpSync(artifact, handlerFile);
writeFileSync(
  path.join(funcDir, "package.json"),
  `${JSON.stringify({ type: "commonjs", private: true }, null, 2)}\n`,
);

for (const name of ["ajv", "ajv-formats"]) {
  copyPackage(name);
}

const requireFromFunc = createRequire(handlerFile);
let mod;
try {
  mod = requireFromFunc(handlerFile);
} catch (error) {
  fail(
    `handler não carrega dentro de index.func: ${error instanceof Error ? error.message : String(error)}`,
  );
}
if (typeof mod?.default !== "function") {
  fail("index.cjs da função não exporta default function");
}

writeFileSync(
  path.join(funcDir, ".vc-config.json"),
  `${JSON.stringify(
    {
      runtime: "nodejs24.x",
      handler: "index.cjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      shouldAddSourcemapSupport: false,
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  path.join(outputRoot, "config.json"),
  `${JSON.stringify(
    {
      version: 3,
      routes: [{ src: "/(.*)", dest: "/" }],
    },
    null,
    2,
  )}\n`,
);

const required = [
  path.join(outputRoot, "config.json"),
  path.join(funcDir, ".vc-config.json"),
  handlerFile,
  path.join(funcDir, "package.json"),
  path.join(funcDir, "node_modules", "ajv", "package.json"),
  path.join(funcDir, "node_modules", "ajv-formats", "package.json"),
];
for (const file of required) {
  if (!existsSync(file)) fail(`saída incompleta: ${file}`);
}

const config = JSON.parse(readFileSync(path.join(outputRoot, "config.json"), "utf8"));
if (config.version !== 3) fail("config.json version != 3");

const vc = JSON.parse(readFileSync(path.join(funcDir, ".vc-config.json"), "utf8"));
if (vc.runtime !== "nodejs24.x" || vc.handler !== "index.cjs" || vc.launcherType !== "Nodejs") {
  fail("vc-config inválido");
}

console.log(
  JSON.stringify({
    ok: true,
    output: path.relative(apiRoot, outputRoot),
    function: "functions/index.func",
    handler: "index.cjs",
    runtime: vc.runtime,
    bundledExtras: ["ajv", "ajv-formats"],
    routes: config.routes,
  }),
);
