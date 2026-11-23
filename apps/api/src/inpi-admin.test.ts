import { InpiRpiProvider } from "@verasjuris/ai";
import { documents, documentVersions, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { strToU8, zipSync } from "fflate";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { classifyInpiDispatch, inpiDueDate } from "./modules/inpi/classify.js";
import { processRpiEdition } from "./modules/inpi/capture.js";
import { call, registerVerified } from "./test-helpers.js";

const RPI = `<?xml version="1.0" encoding="UTF-8"?>
<revista numero="2915" data="17/11/2026">
  <processo numero="912345678" data-deposito="10/01/2026">
    <despachos><despacho codigo="IPAS423" nome="Notificação de oposição"/></despachos>
    <titulares><titular nome-razao-social="CAFÉ PLATINE LTDA" pais="BR" uf="PB"/></titulares>
    <marca apresentacao="Mista" natureza="De Serviço"><nome>VERASJURIS</nome></marca>
    <procurador>Fulana de Tal Advocacia</procurador>
  </processo>
  <processo numero="933333333" data-deposito="05/03/2026">
    <despachos><despacho codigo="IPAS158" nome="Deferimento do pedido"/></despachos>
    <titulares><titular nome-razao-social="CLIENTE NOVO SA" pais="BR" uf="PB"/></titulares>
    <marca apresentacao="Nominativa" natureza="De Produto"><nome>NOVA MARCA</nome></marca>
    <procurador>FULANA DE TAL ADVOCACIA</procurador>
  </processo>
</revista>`;

const zip = zipSync({ "RM2915.xml": strToU8(RPI) });
const inpi = new InpiRpiProvider({
  fetchImpl: (async (input: string | URL | Request) =>
    String(input).endsWith("/rpi/")
      ? new Response('<a href="/txt/RM2915.zip">2915</a>')
      : new Response(zip)) as typeof fetch,
});

describe("classificação de despachos do INPI", () => {
  it("sugere procedimento e prazo pela LPI", () => {
    expect(classifyInpiDispatch("Notificação de oposição")).toMatchObject({
      procedureKey: "inpi.manifestacao_oposicao",
      suggestedDays: 60,
    });
    expect(classifyInpiDispatch("Indeferimento do pedido")).toMatchObject({
      procedureKey: "inpi.recurso",
      suggestedDays: 60,
    });
    expect(classifyInpiDispatch("Deferimento do pedido")).toMatchObject({
      procedureKey: "inpi.pagamento_concessao",
    });
    expect(classifyInpiDispatch("Exigência de mérito")).toMatchObject({ suggestedDays: 60 });
    expect(classifyInpiDispatch("Publicação de pedido de registro para oposição").informative).toBe(
      true,
    );
  });

  it("vencimento em dias corridos, levado ao dia útil se cair em fim de semana", () => {
    // 17/11/2026 + 60 = 16/01/2027 (sábado) → 18/01/2027 (segunda).
    expect(inpiDueDate("2026-11-17", 60)).toBe("2027-01-18");
  });
});

describe("INPI, protocolo orientado e checklists — API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let org: string;
  let matterId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      inpiProvider: inpi,
    });
    owner = await registerVerified(app, email, {
      displayName: "Dona INPI",
      email: "dona.inpi@exemplo.com",
    });
    org = (await call(app, "POST", "/v1/organizations", { name: "Escritório INPI" }, owner)).json<{
      organization: { id: string };
    }>().organization.id;
    const client = await call(
      app,
      "POST",
      `/v1/organizations/${org}/crm/clients`,
      { personType: "person", fullName: "Cliente Adm" },
      owner,
    );
    const clientId = client.json<{ client: { id: string } }>().client.id;
    matterId = (
      await call(
        app,
        "POST",
        `/v1/organizations/${org}/matters`,
        { title: "Caso Adm", clientId },
        owner,
      )
    ).json<{ matter: { id: string } }>().matter.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("monitora processo e procurador; RPI gera despachos e descobre processo novo", async () => {
    const add = await call(
      app,
      "POST",
      `/v1/organizations/${org}/inpi/processes`,
      { processNumber: "912.345.678", label: "VerasJuris" },
      owner,
    );
    expect(add.statusCode).toBe(201);
    const attorney = await call(
      app,
      "POST",
      `/v1/organizations/${org}/inpi/attorneys`,
      { attorneyName: "Fulana de Tal" },
      owner,
    );
    expect(attorney.statusCode).toBe(201);

    const run = await call(app, "POST", `/v1/organizations/${org}/inpi/run`, {}, owner);
    expect(run.statusCode).toBe(200);
    expect(
      run.json<{
        result: { status: string; createdDispatches: number; discoveredProcesses: number };
      }>().result,
    ).toMatchObject({
      status: "ok",
      createdDispatches: 2,
      discoveredProcesses: 1,
    });

    // Rotina global: mesma edição não duplica.
    const global = await processRpiEdition(database.db, inpi, { force: true });
    expect(global.createdDispatches).toBe(0);
    const again = await processRpiEdition(database.db, inpi);
    expect(again.status).toBe("skipped");

    const monitors = await call(
      app,
      "GET",
      `/v1/organizations/${org}/inpi/monitors`,
      undefined,
      owner,
    );
    const processes = monitors.json<{
      processes: Array<{
        processNumber: string;
        discovered: boolean;
        lastDispatchName: string | null;
      }>;
    }>().processes;
    expect(processes.find((p) => p.processNumber === "933333333")?.discovered).toBe(true);
    expect(processes.find((p) => p.processNumber === "912345678")?.lastDispatchName).toBe(
      "Notificação de oposição",
    );
  });

  it("triagem do despacho cria prazo em dias corridos e tarefa", async () => {
    const list = await call(
      app,
      "GET",
      `/v1/organizations/${org}/inpi/dispatches?status=new`,
      undefined,
      owner,
    );
    const items = list.json<{
      items: Array<{
        id: string;
        processNumber: string;
        suggestedDays: number;
        suggestedDueOn: string;
      }>;
    }>().items;
    const opposition = items.find((i) => i.processNumber === "912345678")!;
    expect(opposition).toMatchObject({ suggestedDays: 60, suggestedDueOn: "2027-01-18" });
    const triage = await call(
      app,
      "POST",
      `/v1/organizations/${org}/inpi/dispatches/${opposition.id}/triage`,
      { createDeadline: true, createTask: true },
      owner,
    );
    expect(triage.statusCode).toBe(200);
    const { deadlineId } = triage.json<{ deadlineId: string }>();
    const deadline = await call(
      app,
      "GET",
      `/v1/organizations/${org}/deadlines/${deadlineId}`,
      undefined,
      owner,
    );
    const d = deadline.json<{
      deadline: { status: string; calculatedDueAt: string; ruleType: string };
    }>().deadline;
    expect(d.status).toBe("suggested");
    expect(d.ruleType).toBe("calendar_days");
    expect(d.calculatedDueAt.slice(0, 10)).toBe("2027-01-16");
  });

  it("protocolo orientado exige comprovante com arquivo e procedimento do órgão certo", async () => {
    const bodies = await call(
      app,
      "GET",
      `/v1/organizations/${org}/administrative-bodies`,
      undefined,
      owner,
    );
    const bodyList = bodies.json<{
      items?: Array<{ id: string; code: string | null }>;
      bodies?: Array<{ id: string; code: string | null }>;
    }>();
    const inss = (bodyList.items ?? bodyList.bodies ?? []).find((b) => b.code === "INSS")!;
    expect(inss).toBeTruthy();
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${org}/matters/${matterId}/administrative-processes`,
      { administrativeBodyId: inss.id, subject: "BPC idoso" },
      owner,
    );
    expect(created.statusCode).toBe(201);
    const processId = created.json<{ process: { id: string } }>().process.id;
    const base = `/v1/organizations/${org}/administrative-processes/${processId}/guided-protocols`;

    const catalog = await call(
      app,
      "GET",
      `/v1/organizations/${org}/administrative-procedures/catalog`,
      undefined,
      owner,
    );
    expect(
      catalog
        .json<{ procedures: Array<{ key: string }> }>()
        .procedures.some((p) => p.key === "inss.recurso_ordinario"),
    ).toBe(true);

    const plan = await call(
      app,
      "POST",
      `${base}/plan`,
      { procedureKey: "inss.cumprimento_exigencia", startDate: "2026-11-23" },
      owner,
    );
    expect(plan.statusCode).toBe(201);
    expect(plan.json<{ deadlineIds: string[]; taskId: string }>().deadlineIds).toHaveLength(1);

    const wrongAgency = await call(
      app,
      "POST",
      `${base}/plan`,
      { procedureKey: "rfb.impugnacao", startDate: "2026-11-23" },
      owner,
    );
    expect(wrongAgency.statusCode).toBe(400);

    // Comprovante sem arquivo disponível é recusado.
    const [doc] = await database.db
      .insert(documents)
      .values({
        organizationId: org,
        ownerType: "administrative_process",
        ownerId: processId,
        title: "Comprovante Meu INSS",
      })
      .returning();
    const noFile = await call(
      app,
      "POST",
      base,
      {
        procedureKey: "inss.requerimento_beneficio",
        protocolNumber: "123456789",
        protocolDate: "2026-11-23",
        receiptDocumentId: doc!.id,
      },
      owner,
    );
    expect(noFile.statusCode).toBe(400);

    await database.db.insert(documentVersions).values({
      organizationId: org,
      documentId: doc!.id,
      versionNumber: 1,
      storageProvider: "memory",
      storageKey: "test/comprovante.pdf",
      originalFilename: "comprovante.pdf",
      safeFilename: "comprovante.pdf",
      mimeTypeDeclared: "application/pdf",
      mimeTypeDetected: "application/pdf",
      sizeBytes: 1024,
      sha256: "a".repeat(64),
      status: "available",
    } as typeof documentVersions.$inferInsert);

    const ok = await call(
      app,
      "POST",
      base,
      {
        procedureKey: "inss.requerimento_beneficio",
        protocolNumber: "123456789",
        protocolDate: "2026-11-23",
        receiptDocumentId: doc!.id,
      },
      owner,
    );
    expect(ok.statusCode).toBe(201);
    expect(
      ok.json<{
        request: { status: string; receiptDocumentId: string };
        followUpTaskIds: string[];
      }>(),
    ).toMatchObject({
      request: { status: "confirmed", receiptDocumentId: doc!.id },
    });
    const listed = await call(app, "GET", base, undefined, owner);
    expect(
      listed.json<{ items: Array<{ protocolNumber: string }> }>().items[0]?.protocolNumber,
    ).toBe("123456789");
  });

  it("checklist de benefício usa estados verificáveis e exige prova para 'comprovado'", async () => {
    const created = await call(
      app,
      "POST",
      `/v1/organizations/${org}/benefit-checklists`,
      { benefitKey: "bpc_idoso", legalMatterId: matterId, clientLabel: "Dona Maria" },
      owner,
    );
    expect(created.statusCode).toBe(201);
    const checklist = created.json<{
      checklist: { id: string; summary: { total: number; open: string[] } };
    }>().checklist;
    expect(checklist.summary.total).toBe(4);
    expect(checklist.summary.open).toHaveLength(4);
    const url = `/v1/organizations/${org}/benefit-checklists/${checklist.id}/items/idade`;
    const withoutProof = await call(app, "PATCH", url, { status: "comprovado" }, owner);
    expect(withoutProof.statusCode).toBe(400);
    const withNote = await call(
      app,
      "PATCH",
      url,
      { status: "comprovado", note: "RG: 70 anos" },
      owner,
    );
    expect(withNote.statusCode).toBe(200);
    expect(
      withNote.json<{ checklist: { summary: { open: string[] } } }>().checklist.summary.open,
    ).toHaveLength(3);
    const badReq = await call(
      app,
      "PATCH",
      `/v1/organizations/${org}/benefit-checklists/${checklist.id}/items/inexistente`,
      { status: "pendente" },
      owner,
    );
    expect(badReq.statusCode).toBe(400);
  });
});
