import { DjenProvider } from "@verasjuris/ai";
import {
  captureAllActiveMonitors,
  captureForMonitor,
  COURT_COMMUNICATIONS_CAPTURE_JOB,
  type CaptureResult,
} from "@verasjuris/api/court-communications/capture";
import { courtCommunicationMonitors, type AppDatabase } from "@verasjuris/database";
import { eq } from "drizzle-orm";
import type { JobHandler, JobRecord } from "@verasjuris/events";

export { COURT_COMMUNICATIONS_CAPTURE_JOB };

/** Margem para a função não estourar o tempo máximo da Vercel. */
const BUDGET_MS = 45_000;

/**
 * Rotina de captura do DJEN para todos os monitores ativos.
 * Monitores que não couberem no tempo ficam para a próxima execução
 * (a fila é ordenada pela última execução).
 */
export function createCourtCommunicationsCaptureHandler(deps: {
  db: AppDatabase;
  djen?: DjenProvider;
}): JobHandler {
  const djen = deps.djen ?? new DjenProvider({ baseUrl: process.env.DJEN_BASE_URL || undefined });
  return async (_job: JobRecord) => {
    const { results, skipped } = await captureAllActiveMonitors(deps.db, djen, {
      deadlineAt: Date.now() + BUDGET_MS,
    });
    const errors = results.filter((r) => r.status === "error");
    console.info(
      JSON.stringify({
        job: COURT_COMMUNICATIONS_CAPTURE_JOB,
        monitors: results.length,
        skipped,
        created: results.reduce((sum, r) => sum + r.created, 0),
        errors: errors.map((e) => ({ monitorId: e.monitorId, message: e.message })),
      }),
    );
    if (results.length > 0 && errors.length === results.length) {
      throw Object.assign(new Error(errors[0]?.message ?? "Falha na captura do DJEN."), {
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  };
}

/** Captura de um único monitor (sob demanda). */
export async function captureMonitorById(
  db: AppDatabase,
  monitorId: string,
  window: { from?: string; to?: string },
  djen: DjenProvider = new DjenProvider({ baseUrl: process.env.DJEN_BASE_URL || undefined }),
): Promise<CaptureResult | null> {
  const monitor = await db.query.courtCommunicationMonitors.findFirst({
    where: eq(courtCommunicationMonitors.id, monitorId),
  });
  if (!monitor) return null;
  return captureForMonitor(db, djen, monitor, window);
}
