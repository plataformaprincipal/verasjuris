import {
  createAiGatewayFromEnv,
  NotConfiguredAuctionBidProvider,
  NotConfiguredAuctionProvider,
  NotConfiguredOCRProvider,
  NotConfiguredPublicOpportunityProvider,
} from "@verasjuris/ai";
import { loadDotEnv, parseApiEnv, createLogger, type ApiEnv } from "@verasjuris/config";
import { assertReferenceData, createDatabase } from "@verasjuris/database";
import { createEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, createStorageProvider } from "@verasjuris/storage";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

export type AppFromEnv = {
  app: FastifyInstance;
  env: ApiEnv;
  close: () => Promise<void>;
};

/**
 * Bootstrap compartilhado: monta Fastify + deps a partir do ambiente, sem `listen`.
 * Usado por `main.ts` (Node longo) e `vercel.ts` (serverless).
 *
 * Mantém o mesmo grafo de provedores de `main` em origin/main (sem Asaas/OpenAI/Resend extras).
 */
export async function createAppFromEnv(
  envSource: NodeJS.ProcessEnv = process.env,
): Promise<AppFromEnv> {
  loadDotEnv();
  const env = parseApiEnv(envSource);
  const logger = createLogger("api", env.LOG_LEVEL);

  if (env.NODE_ENV === "production" && env.EMAIL_PROVIDER === "memory") {
    throw new Error(
      "EMAIL_PROVIDER=memory não é permitido em produção. Use not_configured até haver um provedor real.",
    );
  }

  const database = createDatabase(env.DATABASE_URL);
  try {
    await assertReferenceData(database.db);
  } catch (error) {
    await database.close();
    throw error instanceof Error
      ? error
      : new Error("A API não iniciou porque o banco não tem os papéis de referência.");
  }

  const app = await buildApp({
    db: database.db,
    logger,
    webOrigin: env.WEB_ORIGIN,
    isProduction: env.NODE_ENV === "production",
    email: createEmailProvider(env.EMAIL_PROVIDER),
    storage: createStorageProvider(env),
    malwareScanner: createMalwareScanner(env),
    documentMaxUploadBytes: env.DOCUMENT_MAX_UPLOAD_MB * 1024 * 1024,
    // Somente `not_configured` existe em main (ver apiEnvSchema); nenhum provedor real é instanciado.
    aiGateway: createAiGatewayFromEnv({
      FEATURE_AI: envSource.FEATURE_AI,
      AI_PROVIDER: env.AI_PROVIDER,
      AI_DEFAULT_MODEL: env.AI_DEFAULT_MODEL,
      AI_REQUEST_TIMEOUT_MS: env.AI_REQUEST_TIMEOUT_MS,
      AI_MAX_RETRIES: env.AI_MAX_RETRIES,
      AI_MAX_INPUT_TOKENS: env.AI_MAX_INPUT_TOKENS,
    }),
    ocrProvider: new NotConfiguredOCRProvider(),
    publicOpportunityProvider: new NotConfiguredPublicOpportunityProvider(),
    auctionProvider: new NotConfiguredAuctionProvider(),
    auctionBidProvider: new NotConfiguredAuctionBidProvider(),
  });

  return {
    app,
    env,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}
