#!/usr/bin/env node
/**
 * Aplica as migrations do banco durante o build de produção da API na Vercel.
 *
 * Por quê: o código da API não pode ir para produção à frente do banco. Sem este
 * passo, uma migration esquecida derruba rotas com erro 500 (coluna ou tabela
 * inexistente). Se a migration falhar, o build falha e a versão anterior continua no ar.
 *
 * - Só roda quando VERCEL_ENV=production (previews nunca tocam o banco de produção).
 * - Fora da Vercel, não faz nada; use `pnpm db:migrate` localmente.
 * - MIGRATE_ON_DEPLOY=0 desliga o passo em uma emergência.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (process.env.MIGRATE_ON_DEPLOY === "0") {
  console.info("[migrate-on-deploy] desligado por MIGRATE_ON_DEPLOY=0.");
  process.exit(0);
}

if (env !== "production") {
  console.info(`[migrate-on-deploy] ambiente "${env ?? "local"}": migrations não aplicadas.`);
  process.exit(0);
}

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error("[migrate-on-deploy] DIRECT_URL/DATABASE_URL ausentes em produção.");
  process.exit(1);
}

console.info("[migrate-on-deploy] aplicando migrations de produção…");
const result = spawnSync("pnpm", ["--filter", "@verasjuris/database", "db:migrate"], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error("[migrate-on-deploy] falha ao aplicar migrations; build interrompido.");
  process.exit(result.status ?? 1);
}

console.info("[migrate-on-deploy] banco atualizado.");
