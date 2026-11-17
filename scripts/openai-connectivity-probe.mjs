#!/usr/bin/env node
/**
 * Probe controlado de conectividade OpenAI.
 * Nunca imprime a chave. Não habilita FEATURE_AI.
 *
 * Uso: node scripts/openai-connectivity-probe.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = { ...loadEnv(resolve(process.cwd(), ".env")), ...process.env };
const featureAi = env.FEATURE_AI === "1" || env.FEATURE_AI === "true";
const provider = (env.AI_PROVIDER || "not_configured").toLowerCase();
const keyPresent = Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0);
const keyLooksPlaceholder = /your[_-]?key|changeme|xxx|placeholder|sk-proj-xxx/i.test(
  env.OPENAI_API_KEY || "",
);

const report = {
  featureAiEnabled: featureAi,
  aiProviderSetting: provider,
  openaiKeyPresent: keyPresent,
  openaiKeyLooksPlaceholder: keyLooksPlaceholder,
  openaiHealthcheckNetwork: env.OPENAI_HEALTHCHECK === "1",
  defaultModelConfigured: env.OPENAI_DEFAULT_MODEL || null,
  connectivity: "skipped",
  modelsListed: null,
  modelsSample: null,
  detail: "",
};

if (!featureAi || provider !== "openai" || !keyPresent || keyLooksPlaceholder) {
  report.connectivity = "not_configured";
  report.detail =
    "OpenAI não homologável neste ambiente: FEATURE_AI desligado e/ou AI_PROVIDER≠openai e/ou chave ausente/placeholder. Nenhum request externo foi feito.";
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 5000);
try {
  const res = await fetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    signal: controller.signal,
  });
  if (!res.ok) {
    report.connectivity = "degraded";
    report.detail = `HTTP ${res.status} ao listar modelos (sem corpo/segredo).`;
  } else {
    const body = await res.json();
    const ids = Array.isArray(body.data) ? body.data.map((m) => m.id).filter(Boolean) : [];
    report.connectivity = "ok";
    report.modelsListed = ids.length;
    report.modelsSample = ids.filter((id) => /gpt|o1|o3|o4/i.test(id)).slice(0, 12);
    report.detail = "Listagem /v1/models bem-sucedida; amostra sem preços.";
  }
} catch (e) {
  report.connectivity = "unavailable";
  report.detail =
    e?.name === "AbortError" ? "Timeout no health check." : "Falha de rede no health check.";
} finally {
  clearTimeout(timer);
}

console.log(JSON.stringify(report, null, 2));
