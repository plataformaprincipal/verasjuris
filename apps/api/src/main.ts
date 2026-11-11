import { createAppFromEnv } from "./create-app-from-env.js";

async function main(): Promise<void> {
  const { app, env, close } = await createAppFromEnv();
  process.on("SIGTERM", () => {
    void close();
  });
  process.on("SIGINT", () => {
    void close();
  });
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  console.error(`A API não iniciou. ${message}`);
  process.exitCode = 1;
});
