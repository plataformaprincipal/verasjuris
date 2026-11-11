import type { AppDatabase } from "@verasjuris/database";
import { LocalInProcessQueueProvider, type JobHandler, type JobQueue } from "@verasjuris/events";
import { createStorageProvider } from "@verasjuris/storage";
import { registerLocalAlertHandlers } from "./jobs/alert-handlers.js";
import { registerLocalTaxContractHandlers } from "./jobs/tax-contract-handlers.js";
import { registerLocalCommunicationHandlers } from "./jobs/communication-handlers.js";
import { registerLocalOnlineLawyerHandlers } from "./jobs/online-lawyer-handlers.js";
import { registerLocalMarketplaceHandlers } from "./jobs/marketplace-handlers.js";
import { registerLocalEducationFinanceHandlers } from "./jobs/education-finance-handlers.js";
import { registerLocalMonetizationTreasuryHandlers } from "./jobs/monetization-treasury-handlers.js";
import { registerLocalControlAnalyticsWorkflowHandlers } from "./jobs/control-analytics-workflow-handlers.js";
import { registerLocalPlatformHardeningHandlers } from "./jobs/platform-hardening-handlers.js";
import {
  createStorageReconciliationHandler,
  STORAGE_RECONCILIATION_JOB,
} from "./jobs/storage-reconciliation.js";

export type WorkerHandlerRegistry = Map<string, JobHandler>;

/**
 * Registra todos os handlers locais.
 * Sempre popula o mapa retornado (para invocação HTTP/cron no Vercel).
 * Se a fila for `LocalInProcessQueueProvider`, também registra nela.
 */
export function registerWorkerHandlers(queue: JobQueue, db: AppDatabase): WorkerHandlerRegistry {
  const handlers: WorkerHandlerRegistry = new Map();

  const collect = {
    status: "local_in_process" as const,
    registerHandler(type: string, handler: JobHandler) {
      handlers.set(type, handler);
      if (queue instanceof LocalInProcessQueueProvider) {
        queue.registerHandler(type, handler);
      }
    },
  };

  registerLocalAlertHandlers(collect, db);
  registerLocalTaxContractHandlers(collect, db);
  registerLocalCommunicationHandlers(collect, db);
  registerLocalOnlineLawyerHandlers(collect, db);
  registerLocalMarketplaceHandlers(collect, db);
  registerLocalEducationFinanceHandlers(collect, db);
  registerLocalMonetizationTreasuryHandlers(collect, db);
  // Tipados como LocalInProcessQueueProvider — shim estrutural compatível.
  registerLocalControlAnalyticsWorkflowHandlers(
    collect as unknown as LocalInProcessQueueProvider,
    db,
  );
  registerLocalPlatformHardeningHandlers(collect as unknown as LocalInProcessQueueProvider, db);

  const storageHandler = createStorageReconciliationHandler({
    db,
    storage: createStorageProvider(process.env),
  });
  handlers.set(STORAGE_RECONCILIATION_JOB, storageHandler);
  if (queue instanceof LocalInProcessQueueProvider) {
    queue.registerHandler(STORAGE_RECONCILIATION_JOB, storageHandler);
  }

  return handlers;
}
