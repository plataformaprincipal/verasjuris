/**
 * Leitura somente — lista migrations aplicadas vs journal local.
 * NÃO aplica DDL. Uso:
 *   DATABASE_URL='…' pnpm --filter @verasjuris/database exec tsx src/migration-status.ts
 * Preferir DIRECT_URL quando disponível (sem pooler).
 */
import { loadDotEnv, parseApiEnv } from "@verasjuris/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { migrationsFolder } from "./migrate.js";

type Journal = {
  entries: Array<{ idx: number; tag: string }>;
};

function loadJournal(): Journal {
  const journalPath = path.join(migrationsFolder(), "meta", "_journal.json");
  return JSON.parse(readFileSync(journalPath, "utf8")) as Journal;
}

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port || "5432"}${u.pathname} (user=${u.username ? "set" : "none"})`;
  } catch {
    return "(url inválida)";
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const env = parseApiEnv(process.env);
  const connectionString = env.DIRECT_URL ?? env.DATABASE_URL;
  const source = env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL";
  console.info(`Conexão (redacted): ${redactUrl(connectionString)} via ${source}`);

  const journal = loadJournal();
  const expected = journal.entries.map((e) => e.tag);
  console.info(`Journal local: ${expected.length} migrations (última: ${expected.at(-1)})`);

  const sql = postgres(connectionString, { max: 1, connect_timeout: 15 });
  try {
    await sql`select 1 as ok`;
    console.info("Conectividade: OK (SELECT 1)");

    const schemas = await sql<{ schema_name: string }[]>`
      select schema_name from information_schema.schemata
      where schema_name in ('public', 'drizzle')
      order by schema_name
    `;
    console.info(`Schemas: ${schemas.map((s) => s.schema_name).join(", ") || "(nenhum)"}`);

    const table = await sql<{ exists: boolean }[]>`
      select exists(
        select 1 from information_schema.tables
        where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
      ) as exists
    `;
    if (!table[0]?.exists) {
      console.info("Tabela drizzle.__drizzle_migrations: AUSENTE");
      console.info(`PENDENTES: todas (${expected.length})`);
      for (const tag of expected) console.info(`  - ${tag}`);
      process.exitCode = 2;
      return;
    }

    const applied = await sql<{ id: number; hash: string; created_at: string | number }[]>`
      select id, hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at asc, id asc
    `;
    console.info(`Aplicadas: ${applied.length}`);
    for (const row of applied) {
      console.info(
        `  - id=${row.id} hash=${String(row.hash).slice(0, 16)}… at=${String(row.created_at)}`,
      );
    }

    // Contagem: Drizzle armazena hash, não o tag — operador compara com journal.
    if (applied.length < expected.length) {
      const pending = expected.slice(applied.length);
      console.info(`PENDENTES (por índice/contagem): ${pending.length}`);
      for (const tag of pending) console.info(`  - ${tag}`);
      process.exitCode = 2;
    } else if (applied.length === expected.length) {
      console.info("STATUS: contagem aplicada == journal local.");
    } else {
      console.info("AVISO: mais aplicadas que o journal local (possível drift).");
      process.exitCode = 3;
    }

    const owner = await sql<{ exists: boolean }[]>`
      select exists(select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'roles') as exists
    `;
    if (owner[0]?.exists) {
      const roles = await sql<{ key: string }[]>`select key from roles where key = 'owner' limit 1`;
      console.info(
        `Seed referência (role owner): ${roles.length ? "presente" : "AUSENTE — precisa db:seed"}`,
      );
    } else {
      console.info(
        "Tabela public.roles: AUSENTE — migrations iniciais pendentes / seed impossível ainda.",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    console.error(`Falha somente-leitura. ${message}`);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    console.error(message);
    process.exitCode = 1;
  });
}
