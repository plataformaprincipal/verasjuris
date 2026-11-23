/**
 * Captura de comunicações do DJEN por monitor de OAB.
 *
 * Usado pela API (captura sob demanda) e pelo worker (rotina diária). Não exige
 * sessão: grava apenas comunicações e o estado do monitor. Prazos e tarefas só
 * nascem na triagem, feita por uma pessoa com permissão.
 */
import type { DjenProvider, DjenCommunication } from "@verasjuris/ai";
import {
  courtCommunicationMonitors,
  courtCommunications,
  judicialProcesses,
  notifications,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import { civilDate, djenTermDates } from "@verasjuris/notifications";
import { and, eq, inArray } from "drizzle-orm";
import { classifyCommunication } from "./classify.js";

export const COURT_COMMUNICATIONS_CAPTURE_JOB = "COURT_COMMUNICATIONS_CAPTURE" as const;

/** Janela máxima por execução, para caber no tempo da função. */
export const MAX_WINDOW_DAYS = 30;
/** Primeira execução de um monitor olha esta quantidade de dias para trás. */
export const FIRST_RUN_LOOKBACK_DAYS = 7;

export type CaptureMonitorRow = typeof courtCommunicationMonitors.$inferSelect;

export type CaptureResult = {
  monitorId: string;
  from: string;
  to: string;
  found: number;
  created: number;
  linked: number;
  status: "ok" | "partial" | "error";
  message: string | null;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayInBrazil(now = new Date()): string {
  return civilDate(now, "America/Sao_Paulo");
}

/** Janela [from, to] da próxima captura do monitor. */
export function captureWindow(
  monitor: Pick<CaptureMonitorRow, "capturedThrough">,
  today: string,
  override?: { from?: string; to?: string },
): { from: string; to: string } {
  const to = override?.to ?? today;
  let from =
    override?.from ??
    (monitor.capturedThrough
      ? addDays(monitor.capturedThrough, 1)
      : addDays(today, -FIRST_RUN_LOOKBACK_DAYS));
  if (from > to) from = to;
  const earliest = addDays(to, -(MAX_WINDOW_DAYS - 1));
  if (from < earliest) from = earliest;
  return { from, to };
}

function toRow(
  organizationId: string,
  monitorId: string,
  item: DjenCommunication,
  processIdByNumber: Map<string, string>,
): typeof courtCommunications.$inferInsert {
  const dates = djenTermDates(item.availableOn);
  const classification = classifyCommunication({
    text: item.text,
    communicationType: item.communicationType,
    documentType: item.documentType,
    tribunal: item.tribunal,
  });
  const judicialProcessId = item.processNumber
    ? (processIdByNumber.get(item.processNumber) ?? null)
    : null;
  return {
    organizationId,
    monitorId,
    provider: "djen",
    externalId: item.externalId,
    externalHash: item.hash,
    tribunal: item.tribunal,
    communicationType: item.communicationType,
    documentType: item.documentType,
    courtBody: item.courtBody,
    className: item.className,
    processNumber: item.processNumber,
    processNumberMasked: item.processNumberMasked,
    medium: item.medium,
    content: item.text || "(comunicação sem texto)",
    link: item.link,
    recipients: item.recipients,
    lawyers: item.lawyers,
    availableOn: item.availableOn,
    publishedOn: dates.publishedOn,
    termStartsOn: dates.termStartsOn,
    status: judicialProcessId ? "linked" : "new",
    category: classification.category,
    suggestedAction: classification.suggestedAction,
    suggestedDays: classification.suggestedDays,
    suggestedRuleType: classification.suggestedDays ? "business_days" : null,
    suggestionBasis: classification.basis,
    judicialProcessId,
  };
}

export async function captureForMonitor(
  db: AppDatabase,
  djen: DjenProvider,
  monitor: CaptureMonitorRow,
  options: { today?: string; from?: string; to?: string; signal?: AbortSignal } = {},
): Promise<CaptureResult> {
  const today = options.today ?? todayInBrazil();
  const window = captureWindow(monitor, today, options);
  const base = { monitorId: monitor.id, from: window.from, to: window.to };

  let items: DjenCommunication[];
  let total: number;
  try {
    const result = await djen.searchByOab({
      oabNumber: monitor.oabNumber,
      oabUf: monitor.oabUf,
      availableFrom: window.from,
      availableTo: window.to,
      signal: options.signal,
    });
    items = result.items;
    total = result.total;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o DJEN.";
    await db
      .update(courtCommunicationMonitors)
      .set({
        lastRunAt: new Date(),
        lastRunStatus: "error",
        lastRunMessage: message,
        lastRunFound: 0,
        lastRunCreated: 0,
        updatedAt: new Date(),
      })
      .where(eq(courtCommunicationMonitors.id, monitor.id));
    return { ...base, found: 0, created: 0, linked: 0, status: "error", message };
  }

  const numbers = [
    ...new Set(items.map((i) => i.processNumber).filter((n): n is string => Boolean(n))),
  ];
  const processIdByNumber = new Map<string, string>();
  if (numbers.length > 0) {
    const rows = await db
      .select({ id: judicialProcesses.id, number: judicialProcesses.cnjNumberNormalized })
      .from(judicialProcesses)
      .where(
        and(
          eq(judicialProcesses.organizationId, monitor.organizationId),
          inArray(judicialProcesses.cnjNumberNormalized, numbers),
        ),
      );
    for (const row of rows) processIdByNumber.set(row.number, row.id);
  }

  let created = 0;
  let linked = 0;
  for (const item of items) {
    const row = toRow(monitor.organizationId, monitor.id, item, processIdByNumber);
    const inserted = await db
      .insert(courtCommunications)
      .values(row)
      .onConflictDoNothing({
        target: [
          courtCommunications.organizationId,
          courtCommunications.provider,
          courtCommunications.externalId,
        ],
      })
      .returning({ id: courtCommunications.id });
    if (inserted.length > 0) {
      created += 1;
      if (row.judicialProcessId) linked += 1;
    }
  }

  const complete = items.length >= total;
  const status: CaptureResult["status"] = complete ? "ok" : "partial";
  const message = complete
    ? null
    : `O DJEN informou ${total} comunicações e ${items.length} foram lidas nesta execução; a próxima rodada continua.`;

  await db
    .update(courtCommunicationMonitors)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastRunMessage: message,
      lastRunFound: items.length,
      lastRunCreated: created,
      // Só avança a janela quando tudo foi lido; senão repete e deduplica.
      capturedThrough: complete ? window.to : monitor.capturedThrough,
      updatedAt: new Date(),
    })
    .where(eq(courtCommunicationMonitors.id, monitor.id));

  if (created > 0 && monitor.membershipId) {
    const member = await db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.id, monitor.membershipId),
    });
    if (member) {
      await db.insert(notifications).values({
        organizationId: monitor.organizationId,
        userId: member.userId,
        type: "court_communication.captured",
        title: created === 1 ? "1 nova intimação" : `${created} novas intimações`,
        message: `Capturadas no DJEN para OAB ${monitor.oabNumber}/${monitor.oabUf}. Revise e valide os prazos sugeridos.`,
        resourceType: "court_communication_monitor",
        resourceId: monitor.id,
      });
    }
  }

  return { ...base, found: items.length, created, linked, status, message };
}

/** Rotina do worker: todos os monitores ativos, um por vez. */
export async function captureAllActiveMonitors(
  db: AppDatabase,
  djen: DjenProvider,
  options: { today?: string; deadlineAt?: number } = {},
): Promise<{ results: CaptureResult[]; skipped: number }> {
  const monitors = await db.query.courtCommunicationMonitors.findMany({
    where: eq(courtCommunicationMonitors.active, true),
    orderBy: (m, { asc }) => [asc(m.lastRunAt)],
  });
  const results: CaptureResult[] = [];
  let skipped = 0;
  for (const monitor of monitors) {
    if (options.deadlineAt && Date.now() > options.deadlineAt) {
      skipped += 1;
      continue;
    }
    results.push(await captureForMonitor(db, djen, monitor, { today: options.today }));
  }
  return { results, skipped };
}

/** Captura delegada ao worker (região gru1), que tem IP brasileiro. */
export function createRemoteCapture(options: {
  workerUrl: string;
  secret: string;
  fetchImpl?: typeof fetch;
}): (monitorId: string, window: { from?: string; to?: string }) => Promise<CaptureResult> {
  const url = `${options.workerUrl.replace(/\/+$/, "")}/internal/court-communications/capture`;
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (monitorId, window) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-worker-invoke-secret": options.secret },
      body: JSON.stringify({ monitorId, ...window }),
      signal: AbortSignal.timeout(55_000),
    });
    const body = (await response.json().catch(() => ({}))) as {
      result?: CaptureResult;
      error?: { message?: string };
    };
    if (!response.ok || !body.result) {
      throw new Error(body.error?.message ?? `Worker respondeu HTTP ${response.status}.`);
    }
    return body.result;
  };
}
