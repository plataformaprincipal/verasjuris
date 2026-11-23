import { describe, expect, it } from "vitest";
import {
  DatajudProvider,
  datajudAliasFromCnj,
  isValidCnjNumber,
  parseDatajudHit,
} from "./datajud-provider.js";
import { DjenProvider, parseDjenItem, stripHtml } from "./djen-provider.js";

const noSleep = async () => {};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const DJEN_ITEM = {
  id: 987654321,
  data_disponibilizacao: "2026-03-06",
  siglaTribunal: "TJPB",
  tipoComunicacao: "Intimação",
  nomeOrgao: "1ª Vara Cível de João Pessoa",
  texto:
    "<p>Fica a parte autora intimada para, no prazo de 15 (quinze) dias, apresentar réplica.</p>",
  numero_processo: "08012345620268150001",
  link: "https://pje.tjpb.jus.br/x",
  tipoDocumento: "Despacho",
  nomeClasse: "PROCEDIMENTO COMUM CÍVEL",
  hash: "abc123",
  meiocompleto: "Diário de Justiça Eletrônico Nacional",
  destinatarios: [{ nome: "FULANO DE TAL", polo: "A" }],
  destinatarioadvogados: [
    { advogado: { nome: "ADVOGADA EXEMPLO", numero_oab: "12345", uf_oab: "pb" } },
  ],
};

describe("DJEN", () => {
  it("converte o item da API, aceitando snake_case e camelCase", () => {
    const parsed = parseDjenItem(DJEN_ITEM);
    expect(parsed).toMatchObject({
      externalId: "987654321",
      availableOn: "2026-03-06",
      tribunal: "TJPB",
      processNumber: "08012345620268150001",
      processNumberMasked: "0801234-56.2026.8.15.0001",
      hash: "abc123",
    });
    expect(parsed?.text).toContain("apresentar réplica");
    expect(parsed?.text).not.toContain("<p>");
    expect(parsed?.lawyers[0]).toEqual({
      name: "ADVOGADA EXEMPLO",
      oabNumber: "12345",
      oabUf: "PB",
    });
    const camel = parseDjenItem({ id: "1", dataDisponibilizacao: "06/03/2026", texto: "x" });
    expect(camel?.availableOn).toBe("2026-03-06");
    expect(parseDjenItem({ texto: "sem id" })).toBeNull();
  });

  it("remove HTML preservando parágrafos", () => {
    expect(stripHtml("<p>Um&nbsp;texto</p><p>Dois &amp; três</p>")).toBe("Um texto\nDois & três");
  });

  it("pagina, envia os parâmetros por OAB e repete em HTTP 500", async () => {
    const urls: string[] = [];
    let calls = 0;
    const fetchImpl = (async (input: string | URL | Request) => {
      urls.push(String(input));
      calls += 1;
      if (calls === 1) return jsonResponse({ message: "erro" }, 500);
      const page = Number(new URL(String(input)).searchParams.get("pagina"));
      const items =
        page === 1
          ? Array.from({ length: 50 }, (_, i) => ({ ...DJEN_ITEM, id: i + 1 }))
          : [{ ...DJEN_ITEM, id: 51 }];
      return jsonResponse({ status: "success", count: 51, items });
    }) as typeof fetch;
    const djen = new DjenProvider({ fetchImpl, sleep: noSleep, minIntervalMs: 0 });
    const result = await djen.searchByOab({
      oabNumber: "12.345",
      oabUf: "pb",
      availableFrom: "2026-03-01",
      availableTo: "2026-03-06",
    });
    expect(result.items).toHaveLength(51);
    expect(result.total).toBe(51);
    const first = new URL(urls[1]!);
    expect(first.pathname).toBe("/api/v1/comunicacao");
    expect(first.searchParams.get("numeroOab")).toBe("12345");
    expect(first.searchParams.get("ufOab")).toBe("PB");
    expect(first.searchParams.get("itensPorPagina")).toBe("50");
    expect(first.searchParams.get("dataDisponibilizacaoInicio")).toBe("2026-03-01");
  });

  it("explica o bloqueio por IP estrangeiro (HTTP 403)", async () => {
    const djen = new DjenProvider({
      fetchImpl: (async () => jsonResponse({}, 403)) as typeof fetch,
      sleep: noSleep,
      minIntervalMs: 0,
    });
    await expect(
      djen.searchByOab({
        oabNumber: "1",
        oabUf: "PB",
        availableFrom: "2026-03-01",
        availableTo: "2026-03-01",
      }),
    ).rejects.toThrow(/IP brasileiro/);
  });
});

describe("Datajud", () => {
  it("valida o número CNJ e deriva o alias do tribunal", () => {
    expect(isValidCnjNumber("0000001-20.2016.8.26.0100")).toBe(true);
    expect(isValidCnjNumber("0000001-21.2016.8.26.0100")).toBe(false);
    expect(datajudAliasFromCnj("08012345620268150001")).toBe("TJPB");
    expect(datajudAliasFromCnj("00012345620264050000")).toBe("TRF5");
    expect(datajudAliasFromCnj("00012345620265130000")).toBe("TRT13");
    expect(datajudAliasFromCnj("00012345620265000000")).toBe("TST");
    expect(datajudAliasFromCnj("00012345620266150000")).toBe("TRE-PB");
    expect(datajudAliasFromCnj("00012345620268070000")).toBe("TJDFT");
    expect(datajudAliasFromCnj("123")).toBeNull();
  });

  const HIT = {
    _id: "TJPB_G1_08012345620268150001",
    _source: {
      numeroProcesso: "08012345620268150001",
      tribunal: "TJPB",
      grau: "G1",
      classe: { codigo: 7, nome: "Procedimento Comum Cível" },
      assuntos: [{ codigo: 7780, nome: "Indenização por Dano Moral" }],
      orgaoJulgador: { codigo: 1, nome: "1ª Vara Cível" },
      dataAjuizamento: "20260110093000",
      sistema: { nome: "PJe" },
      movimentos: [
        { codigo: 26, nome: "Distribuição", dataHora: "2026-01-10T09:30:00.000Z" },
        {
          codigo: 11010,
          nome: "Mero expediente",
          dataHora: "2026-02-01T10:00:00.000Z",
          complementosTabelados: [{ nome: "tipo", descricao: "despacho" }],
        },
      ],
      dataHoraUltimaAtualizacao: "2026-02-01T11:00:00.000Z",
    },
  };

  it("converte o processo e as movimentações", () => {
    const p = parseDatajudHit(HIT);
    expect(p).toMatchObject({
      tribunal: "TJPB",
      degree: "G1",
      className: "Procedimento Comum Cível",
      filedAt: "2026-01-10T09:30:00.000Z",
    });
    expect(p?.movements.map((m) => m.name)).toEqual(["Distribuição", "Mero expediente"]);
    expect(p?.movements[1]?.complements).toEqual(["tipo: despacho"]);
  });

  it("consulta o índice do tribunal com a chave pública no cabeçalho", async () => {
    let seen: { url: string; auth: string | null; body: string } | null = null;
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      seen = {
        url: String(input),
        auth: new Headers(init?.headers).get("authorization"),
        body: String(init?.body),
      };
      return jsonResponse({ hits: { hits: [HIT] } });
    }) as typeof fetch;
    const datajud = new DatajudProvider({
      apiKey: "APIKey chave-publica",
      fetchImpl,
      sleep: noSleep,
    });
    const movements = await datajud.getMovements("0801234-56.2026.8.15.0001");
    expect(movements).toHaveLength(2);
    expect(seen!.url).toBe("https://api-publica.datajud.cnj.jus.br/api_publica_tjpb/_search");
    expect(seen!.auth).toBe("APIKey chave-publica");
    expect(JSON.parse(seen!.body)).toMatchObject({
      query: { match: { numeroProcesso: "08012345620268150001" } },
    });
  });
});
