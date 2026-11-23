/**
 * Processamento semanal da RPI de Marcas para todas as organizações.
 * Baixa a edição uma vez, recorta só os processos monitorados e grava os
 * despachos por organização, com deduplicação.
 */
import type { InpiRpiProvider, InpiTrademarkProcess } from "@verasjuris/ai";
import {
  inpiAttorneyMonitors,
  inpiDispatches,
  inpiMonitoredProcesses,
  inpiRpiRuns,
  notifications,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import { and, eq } from "drizzle-orm";
import { classifyInpiDispatch, inpiDueDate } from "./classify.js";

export const INPI_RPI_JOB = "INPI_RPI_PROCESS" as const;

export type InpiRunResult = {
  edition: number;
  publishedOn: string | null;
  status: "ok" | "skipped" | "error";
  matchedProcesses: number;
  createdDispatches: number;
  discoveredProcesses: number;
  message: string | null;
};

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

export async function processRpiEdition(
  db: AppDatabase,
  provider: InpiRpiProvider,
  options: { edition?: number; force?: boolean; organizationId?: string } = {},
): Promise<InpiRunResult> {
  let edition: number;
  try {
    edition = options.edition ?? (await provider.latestEdition());
  } catch (error) {
    return {
      edition: options.edition ?? 0,
      publishedOn: null,
      status: "error",
      matchedProcesses: 0,
      createdDispatches: 0,
      discoveredProcesses: 0,
      message: error instanceof Error ? error.message : "Falha ao consultar o índice da RPI.",
    };
  }

  if (!options.force) {
    const done = await db.query.inpiRpiRuns.findFirst({ where: eq(inpiRpiRuns.edition, edition) });
    if (done?.status === "ok") {
      return {
        edition,
        publishedOn: done.publishedOn,
        status: "skipped",
        matchedProcesses: 0,
        createdDispatches: 0,
        discoveredProcesses: 0,
        message: "Edição já processada.",
      };
    }
  }

  const orgFilter = options.organizationId
    ? [eq(inpiMonitoredProcesses.organizationId, options.organizationId)]
    : [];
  const monitored = await db.query.inpiMonitoredProcesses.findMany({
    where: and(eq(inpiMonitoredProcesses.active, true), ...orgFilter),
  });
  const attorneyFilter = options.organizationId
    ? [eq(inpiAttorneyMonitors.organizationId, options.organizationId)]
    : [];
  const attorneys = await db.query.inpiAttorneyMonitors.findMany({
    where: and(eq(inpiAttorneyMonitors.active, true), ...attorneyFilter),
  });

  if (monitored.length === 0 && attorneys.length === 0) {
    return {
      edition,
      publishedOn: null,
      status: "skipped",
      matchedProcesses: 0,
      createdDispatches: 0,
      discoveredProcesses: 0,
      message: "Nenhum processo ou procurador monitorado.",
    };
  }

  let data: Awaited<ReturnType<InpiRpiProvider["trademarkEdition"]>>;
  try {
    data = await provider.trademarkEdition(edition, {
      processNumbers: monitored.map((m) => m.processNumber),
      attorneyNames: attorneys.map((a) => a.attorneyName),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao baixar a RPI.";
    if (!options.organizationId) {
      await db
        .insert(inpiRpiRuns)
        .values({ edition, status: "error", message })
        .onConflictDoUpdate({
          target: inpiRpiRuns.edition,
          set: { status: "error", message, processedAt: new Date() },
        });
    }
    return {
      edition,
      publishedOn: null,
      status: "error",
      matchedProcesses: 0,
      createdDispatches: 0,
      discoveredProcesses: 0,
      message,
    };
  }

  const byNumber = new Map<string, typeof monitored>();
  for (const m of monitored) {
    byNumber.set(m.processNumber, [...(byNumber.get(m.processNumber) ?? []), m]);
  }
  const foldedAttorneys = attorneys.map((a) => ({ ...a, folded: fold(a.attorneyName) }));

  let created = 0;
  let discovered = 0;
  const touchedOrgs = new Map<string, { count: number; membershipId: string | null }>();

  for (const process of data.processes) {
    // Organizações interessadas: pelo número e pelo procurador.
    const targets = new Map<string, (typeof monitored)[number] | null>();
    for (const m of byNumber.get(process.processNumber) ?? []) targets.set(m.organizationId, m);
    const attorney = process.attorney ? fold(process.attorney) : "";
    for (const a of foldedAttorneys) {
      if (attorney && attorney.includes(a.folded) && !targets.has(a.organizationId)) {
        targets.set(a.organizationId, null);
      }
    }

    for (const [organizationId, existing] of targets) {
      let monitor = existing;
      if (!monitor) {
        const [inserted] = await db
          .insert(inpiMonitoredProcesses)
          .values({
            organizationId,
            processNumber: process.processNumber,
            label: process.markName,
            holderName: process.holders[0]?.name ?? null,
            createdByMembershipId: null,
          })
          .onConflictDoNothing()
          .returning();
        if (inserted) discovered += 1;
        monitor =
          inserted ??
          (await db.query.inpiMonitoredProcesses.findFirst({
            where: and(
              eq(inpiMonitoredProcesses.organizationId, organizationId),
              eq(inpiMonitoredProcesses.processNumber, process.processNumber),
            ),
          })) ??
          null;
      }
      created += await insertDispatches(db, organizationId, monitor, data, process);
      const touched = touchedOrgs.get(organizationId) ?? {
        count: 0,
        membershipId: monitor?.createdByMembershipId ?? null,
      };
      touched.count += process.dispatches.length;
      touchedOrgs.set(organizationId, touched);
    }
  }

  // Notifica quem cadastrou o monitoramento em cada organização.
  for (const [organizationId, info] of touchedOrgs) {
    if (!info.membershipId) continue;
    const member = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.id, info.membershipId),
    });
    if (!member) continue;
    await db.insert(notifications).values({
      organizationId,
      userId: member.userId,
      type: "inpi_dispatch.captured",
      title: `RPI ${data.edition}: ${info.count} despacho(s)`,
      message: "Novos despachos do INPI nos processos monitorados. Revise e valide os prazos.",
      resourceType: "inpi_rpi",
      resourceId: null,
    });
  }

  if (!options.organizationId) {
    await db
      .insert(inpiRpiRuns)
      .values({
        edition: data.edition,
        publishedOn: data.publishedOn,
        status: "ok",
        matched: data.processes.length,
      })
      .onConflictDoUpdate({
        target: inpiRpiRuns.edition,
        set: {
          publishedOn: data.publishedOn,
          status: "ok",
          message: null,
          matched: data.processes.length,
          processedAt: new Date(),
        },
      });
  }

  return {
    edition: data.edition,
    publishedOn: data.publishedOn,
    status: "ok",
    matchedProcesses: data.processes.length,
    createdDispatches: created,
    discoveredProcesses: discovered,
    message: null,
  };
}

async function insertDispatches(
  db: AppDatabase,
  organizationId: string,
  monitor: typeof inpiMonitoredProcesses.$inferSelect | null,
  data: { edition: number; publishedOn: string },
  process: InpiTrademarkProcess,
): Promise<number> {
  let created = 0;
  for (const [index, dispatch] of process.dispatches.entries()) {
    const suggestion = classifyInpiDispatch(dispatch.name, dispatch.complement);
    const dueOn =
      suggestion.procedureKey === "inpi.prorrogacao" && process.validUntil
        ? process.validUntil
        : suggestion.suggestedDays
          ? inpiDueDate(data.publishedOn, suggestion.suggestedDays)
          : null;
    const rows = await db
      .insert(inpiDispatches)
      .values({
        organizationId,
        monitoredProcessId: monitor?.id ?? null,
        edition: data.edition,
        publishedOn: data.publishedOn,
        processNumber: process.processNumber,
        markName: process.markName,
        holders: process.holders,
        attorney: process.attorney,
        niceClasses: process.niceClasses,
        code: dispatch.code,
        name: dispatch.name,
        complement: dispatch.complement,
        dedupeKey: `${data.edition}:${process.processNumber}:${dispatch.code ?? dispatch.name}:${index}`,
        procedureKey: suggestion.procedureKey,
        suggestedDays: suggestion.suggestedDays,
        suggestedDueOn: dueOn,
        suggestionBasis: suggestion.basis,
        status: suggestion.informative ? "triaged" : "new",
      })
      .onConflictDoNothing()
      .returning({ id: inpiDispatches.id });
    created += rows.length;
  }
  if (monitor && process.dispatches.length > 0) {
    const last = process.dispatches[process.dispatches.length - 1]!;
    await db
      .update(inpiMonitoredProcesses)
      .set({
        lastEdition: data.edition,
        lastDispatchName: last.name,
        lastDispatchOn: data.publishedOn,
        label: monitor.label ?? process.markName,
        holderName: monitor.holderName ?? process.holders[0]?.name ?? null,
        updatedAt: new Date(),
      })
      .where(eq(inpiMonitoredProcesses.id, monitor.id));
  }
  return created;
}

/** Delegação ao worker (download pesado e IP brasileiro). */
export function createRemoteRpiRun(options: {
  workerUrl: string;
  secret: string;
  fetchImpl?: typeof fetch;
}): (input: { organizationId: string; edition?: number }) => Promise<InpiRunResult> {
  const url = `${options.workerUrl.replace(/\/+$/, "")}/internal/inpi/process`;
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (input) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-invoke-secret": options.secret },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(120_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      result?: InpiRunResult;
      error?: { message?: string };
    };
    if (!response.ok || !body.result) {
      throw new Error(body.error?.message ?? `Worker respondeu HTTP ${response.status}.`);
    }
    return body.result;
  };
}
