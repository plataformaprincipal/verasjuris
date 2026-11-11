import { createLogger, loadDotEnv, parseWorkerEnv } from "@verasjuris/config";
import { createDatabase } from "@verasjuris/database";
import { createJobQueueFromEnv, LocalInProcessQueueProvider } from "@verasjuris/events";
import { buildWorkerApp, checkDatabase } from "./app.js";
import { registerWorkerHandlers } from "./register-handlers.js";

async function main(): Promise<void> {
  loadDotEnv();
  const env = parseWorkerEnv(process.env);
  const logger = createLogger("worker", env.LOG_LEVEL);
  const database = createDatabase(env.DATABASE_URL);
  // Produção: not_configured. Local: FEATURE_LOCAL_QUEUE=true|1 ou LOCAL_QUEUE=enabled.
  const queue = createJobQueueFromEnv(process.env);
  registerWorkerHandlers(queue, database.db);
  const app = await buildWorkerApp({
    logger,
    checkDatabase: () => checkDatabase(database.db),
    queue,
  });
  const shutdown = async () => {
    await app.close();
    await database.close();
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });
  await app.listen({ host: env.WORKER_HOST, port: env.WORKER_PORT });
  if (queue instanceof LocalInProcessQueueProvider) {
    logger.info(
      "Worker com LocalInProcessQueueProvider (FEATURE_LOCAL_QUEUE/LOCAL_QUEUE). Não é fila distribuída.",
    );
  } else {
    logger.info(
      "Worker em execução. A fila permanece não configurada; nenhum trabalho será agendado.",
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  console.error(`O worker não iniciou. ${message}`);
  process.exitCode = 1;
});
