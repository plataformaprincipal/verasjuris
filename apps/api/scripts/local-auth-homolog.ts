/**
 * Servidor local de homologação de autenticação (PGlite in-memory).
 *
 * Não usa Postgres de produção. Não envia e-mail real (MemoryEmailProvider).
 * Tokens de reset/verificação são gravados em arquivo local para o teste no browser.
 *
 * Uso:
 *   pnpm --filter @verasjuris/api exec tsx scripts/local-auth-homolog.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider, type OutboundEmail } from "@verasjuris/email";
import { buildApp } from "../src/app.js";

const HOST = process.env.API_HOST ?? "127.0.0.1";
const PORT = Number(process.env.API_PORT ?? "4000");
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000";
const outboxPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../.data/auth-homolog-outbox.json",
);

class FileBackedMemoryEmail extends MemoryEmailProvider {
  override async send(message: OutboundEmail) {
    const result = await super.send(message);
    mkdirSync(path.dirname(outboxPath), { recursive: true });
    writeFileSync(outboxPath, JSON.stringify(this.outbox, null, 2));
    console.log(
      JSON.stringify({
        homologEmail: true,
        kind: message.kind,
        to: message.to,
        hasToken: Boolean(message.token),
        outboxPath,
      }),
    );
    return result;
  }
}

async function main() {
  const database = await createTestDatabase();
  await seedReferenceData(database.db);
  const email = new FileBackedMemoryEmail();
  const app = await buildApp({
    db: database.db,
    logger: true,
    webOrigin: WEB_ORIGIN,
    isProduction: false,
    email,
  });

  await app.listen({ host: HOST, port: PORT });
  console.log(
    JSON.stringify({
      ok: true,
      mode: "auth-homolog-pglite",
      listen: `http://${HOST}:${PORT}`,
      webOrigin: WEB_ORIGIN,
      outboxPath,
      note: "Ambiente efêmero. Não é produção.",
    }),
  );

  const shutdown = async () => {
    await app.close();
    await database.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
