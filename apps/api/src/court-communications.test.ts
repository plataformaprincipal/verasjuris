import { DatajudProvider, DjenProvider } from "@verasjuris/ai";
import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { captureAllActiveMonitors } from "./modules/court-communications/capture.js";
import { call, registerVerified } from "./test-helpers.js";

/** Processo TJSP válido (mesmo dos testes judiciais). */
const CNJ = "0000001-20.2016.8.26.0100";
const CNJ_DIGITS = "00000012020168260100";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const djenItems = [
  {
    id: 1001,
    data_disponibilizacao: "2026-03-06",
    siglaTribunal: "TJSP",
    tipoComunicacao: "Intimação",
    nomeOrgao: "1ª Vara Cível",
    texto: "<p>Fica a parte autora intimada a apresentar réplica à contestação.</p>",
    numero_processo: CNJ_DIGITS,
    hash: "h1001",
    destinatarioadvogados: [
      { advogado: { nome: "ADV TESTE", numero_oab: "123456", uf_oab: "SP" } },
    ],
  },
  {
    id: 1002,
    data_disponibilizacao: "2026-03-06",
    siglaTribunal: "TJSP",
    tipoComunicacao: "Intimação",
    nomeOrgao: "2ª Vara Cível",
    texto: "Designada audiência de conciliação para o dia 20/04/2026.",
    numero_processo: "99999999920268260100",
  },
];

let djenCalls = 0;
const djen = new DjenProvider({
  minIntervalMs: 0,
  sleep: async () => {},
  fetchImpl: (async () => {
    djenCalls += 1;
    return json({ status: "success", count: djenItems.length, items: djenItems });
  }) as typeof fetch,
});

const datajud = new DatajudProvider({
  apiKey: "chave-de-teste",
  sleep: async () => {},
  fetchImpl: (async () =>
    json({
      hits: {
        hits: [
          {
            _id: `TJSP_G1_${CNJ_DIGITS}`,
            _source: {
              numeroProcesso: CNJ_DIGITS,
              tribunal: "TJSP",
              grau: "G1",
              classe: { codigo: 7, nome: "Procedimento Comum Cível" },
              orgaoJulgador: { codigo: 1, nome: "1ª Vara Cível" },
              movimentos: [
                { codigo: 26, nome: "Distribuição", dataHora: "2016-01-10T09:30:00.000Z" },
                { codigo: 85, nome: "Petição", dataHora: "2026-02-01T10:00:00.000Z" },
              ],
            },
          },
        ],
      },
    })) as typeof fetch,
});

describe("Captura processual — DJEN e Datajud", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let outsider: string;
  let org: string;
  let otherOrg: string;
  let processId: string;
  let monitorId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      djenProvider: djen,
      datajudProvider: datajud,
    });
    owner = await registerVerified(app, email, {
      displayName: "Dona Captura",
      email: "dona.captura@exemplo.com",
    });
    outsider = await registerVerified(app, email, {
      displayName: "Outra Org",
      email: "outra.captura@exemplo.com",
    });
    org = (
      await call(app, "POST", "/v1/organizations", { name: "Escritório Captura" }, owner)
    ).json<{
      organization: { id: string };
    }>().organization.id;
    otherOrg = (
      await call(app, "POST", "/v1/organizations", { name: "Outro Escritório" }, outsider)
    ).json<{ organization: { id: string } }>().organization.id;

    const client = await call(
      app,
      "POST",
      `/v1/organizations/${org}/crm/clients`,
      { personType: "person", fullName: "Cliente Captura" },
      owner,
    );
    const clientId = client.json<{ client: { id: string } }>().client.id;
    const matter = await call(
      app,
      "POST",
      `/v1/organizations/${org}/matters`,
      { title: "Caso Captura", clientId },
      owner,
    );
    const matterId = matter.json<{ matter: { id: string } }>().matter.id;
    const courts = await call(app, "GET", `/v1/organizations/${org}/courts`, undefined, owner);
    const tribunalId = courts
      .json<{ courts: Array<{ id: string; acronym: string }> }>()
      .courts.find((c) => c.acronym === "TJSP")!.id;
    const process = await call(
      app,
      "POST",
      `/v1/organizations/${org}/matters/${matterId}/judicial-processes`,
      { cnjNumber: CNJ, tribunalId },
      owner,
    );
    expect(process.statusCode).toBe(201);
    processId = process.json<{ process: { id: string } }>().process.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  const base = () => `/v1/organizations/${org}/court-communications`;

  it("cria monitor de OAB e recusa duplicidade e dados inválidos", async () => {
    const created = await call(
      app,
      "POST",
      `${base()}/monitors`,
      { lawyerName: "Adv Teste", oabNumber: "123.456", oabUf: "sp" },
      owner,
    );
    expect(created.statusCode).toBe(201);
    const monitor = created.json<{ monitor: { id: string; oabNumber: string; oabUf: string } }>()
      .monitor;
    expect(monitor).toMatchObject({ oabNumber: "123456", oabUf: "SP" });
    monitorId = monitor.id;

    const duplicate = await call(
      app,
      "POST",
      `${base()}/monitors`,
      { lawyerName: "Adv Teste", oabNumber: "123456", oabUf: "SP" },
      owner,
    );
    expect(duplicate.statusCode).toBe(409);

    const invalid = await call(
      app,
      "POST",
      `${base()}/monitors`,
      { lawyerName: "Adv", oabNumber: "1", oabUf: "XX" },
      owner,
    );
    expect(invalid.statusCode).toBe(400);
  });

  it("captura, deduplica, vincula ao processo e sugere a providência", async () => {
    const run = await call(
      app,
      "POST",
      `${base()}/monitors/${monitorId}/run`,
      { from: "2026-03-01", to: "2026-03-06" },
      owner,
    );
    expect(run.statusCode).toBe(200);
    expect(
      run.json<{ result: { created: number; linked: number; status: string } }>().result,
    ).toMatchObject({
      created: 2,
      linked: 1,
      status: "ok",
    });

    // Segunda execução: nada novo.
    const again = await call(
      app,
      "POST",
      `${base()}/monitors/${monitorId}/run`,
      { from: "2026-03-01", to: "2026-03-06" },
      owner,
    );
    expect(again.json<{ result: { created: number } }>().result.created).toBe(0);

    const list = await call(app, "GET", base(), undefined, owner);
    expect(list.statusCode).toBe(200);
    const body = list.json<{
      items: Array<{
        externalId: string;
        status: string;
        category: string;
        publishedOn: string;
        termStartsOn: string;
        suggestedDays: number | null;
        suggestedDueOn: string | null;
        judicialProcessId: string | null;
        certificateUrl: string | null;
      }>;
      total: number;
      counts: Record<string, number>;
    }>();
    expect(body.total).toBe(2);
    expect(body.counts).toMatchObject({ new: 1, linked: 1 });
    const replica = body.items.find((i) => i.externalId === "1001")!;
    expect(replica).toMatchObject({
      status: "linked",
      category: "replica",
      judicialProcessId: processId,
      publishedOn: "2026-03-09",
      termStartsOn: "2026-03-10",
      suggestedDays: 15,
      suggestedDueOn: "2026-03-30",
    });
    expect(replica.certificateUrl).toContain("/comunicacao/h1001/certidao");
    const hearing = body.items.find((i) => i.externalId === "1002")!;
    expect(hearing).toMatchObject({ status: "new", category: "audiencia", suggestedDays: null });
  });

  it("isola organizações", async () => {
    // Não membro recebe 404 (anti-enumeração, padrão da plataforma).
    const res = await call(app, "GET", base(), undefined, outsider);
    expect(res.statusCode).toBe(404);
    const other = await call(
      app,
      "GET",
      `/v1/organizations/${otherOrg}/court-communications`,
      undefined,
      outsider,
    );
    expect(other.json<{ total: number }>().total).toBe(0);
  });

  it("triagem cria prazo provisório, tarefa e movimentação; não repete", async () => {
    const list = await call(app, "GET", `${base()}?status=linked`, undefined, owner);
    const id = list.json<{ items: Array<{ id: string }> }>().items[0]!.id;
    const triage = await call(
      app,
      "POST",
      `${base()}/${id}/triage`,
      { createDeadline: true, createTask: true },
      owner,
    );
    expect(triage.statusCode).toBe(200);
    const result = triage.json<{
      communication: { status: string };
      deadlineId: string;
      taskId: string;
    }>();
    expect(result.communication.status).toBe("triaged");

    const deadline = await call(
      app,
      "GET",
      `/v1/organizations/${org}/deadlines/${result.deadlineId}`,
      undefined,
      owner,
    );
    expect(deadline.statusCode).toBe(200);
    const d = deadline.json<{
      deadline: {
        status: string;
        calculatedDueAt: string;
        judicialProcessId: string;
        ruleDays: number;
      };
    }>().deadline;
    expect(d.status).toBe("suggested");
    expect(d.ruleDays).toBe(15);
    expect(d.judicialProcessId).toBe(processId);
    expect(d.calculatedDueAt.slice(0, 10)).toBe("2026-03-30");

    const task = await call(
      app,
      "GET",
      `/v1/organizations/${org}/tasks/${result.taskId}`,
      undefined,
      owner,
    );
    expect(task.statusCode).toBe(200);

    const repeat = await call(
      app,
      "POST",
      `${base()}/${id}/triage`,
      { createDeadline: true, createTask: false },
      owner,
    );
    expect(repeat.statusCode).toBe(409);
  });

  it("descarte exige motivo e vínculo manual aceita só processos da organização", async () => {
    const list = await call(app, "GET", `${base()}?status=new`, undefined, owner);
    const id = list.json<{ items: Array<{ id: string }> }>().items[0]!.id;
    const noReason = await call(app, "POST", `${base()}/${id}/dismiss`, { reason: "" }, owner);
    expect(noReason.statusCode).toBe(400);
    const badLink = await call(
      app,
      "POST",
      `${base()}/${id}/link`,
      { judicialProcessId: "00000000-0000-4000-8000-000000000000" },
      owner,
    );
    expect(badLink.statusCode).toBe(404);
    const dismissed = await call(
      app,
      "POST",
      `${base()}/${id}/dismiss`,
      { reason: "Processo de outro escritório." },
      owner,
    );
    expect(dismissed.json<{ communication: { status: string } }>().communication.status).toBe(
      "dismissed",
    );
  });

  it("sincroniza movimentações pelo Datajud sem duplicar", async () => {
    const url = `/v1/organizations/${org}/judicial-processes/${processId}/datajud-sync`;
    const first = await call(app, "POST", url, {}, owner);
    expect(first.statusCode).toBe(200);
    expect(first.json<{ found: boolean; created: number }>()).toMatchObject({
      found: true,
      created: 2,
    });
    const second = await call(app, "POST", url, {}, owner);
    expect(second.json<{ created: number }>().created).toBe(0);
  });

  it("rotina do worker percorre monitores ativos e respeita monitor pausado", async () => {
    const before = djenCalls;
    const all = await captureAllActiveMonitors(database.db, djen, { today: "2026-03-06" });
    expect(all.results).toHaveLength(1);
    expect(djenCalls).toBe(before + 1);

    const paused = await call(
      app,
      "PATCH",
      `${base()}/monitors/${monitorId}`,
      { active: false },
      owner,
    );
    expect(paused.json<{ monitor: { active: boolean } }>().monitor.active).toBe(false);
    const none = await captureAllActiveMonitors(database.db, djen, { today: "2026-03-07" });
    expect(none.results).toHaveLength(0);
  });
});
