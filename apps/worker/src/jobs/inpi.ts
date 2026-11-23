import { InpiRpiProvider } from "@verasjuris/ai";
import { INPI_RPI_JOB, processRpiEdition } from "@verasjuris/api/inpi/capture";
import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";

export { INPI_RPI_JOB };

/** Processa a edição mais recente da RPI de Marcas para todas as organizações. */
export function createInpiRpiHandler(deps: {
  db: AppDatabase;
  provider?: InpiRpiProvider;
}): JobHandler {
  const provider = deps.provider ?? new InpiRpiProvider();
  return async (job: JobRecord) => {
    const payload = (job.payload ?? {}) as { edition?: number; force?: boolean };
    const result = await processRpiEdition(deps.db, provider, {
      edition: typeof payload.edition === "number" ? payload.edition : undefined,
      force: payload.force === true,
    });
    console.info(JSON.stringify({ job: INPI_RPI_JOB, ...result }));
    if (result.status === "error") {
      throw Object.assign(new Error(result.message ?? "Falha ao processar a RPI."), {
        code: "EXTERNAL_SERVICE_ERROR",
      });
    }
  };
}
