import { AppError } from "@verasjuris/types";
import { XMLParser } from "fast-xml-parser";
import { unzipSync, strFromU8 } from "fflate";

/**
 * INPI — Revista da Propriedade Industrial (RPI), publicação semanal oficial.
 *
 * - Índice: https://revistas.inpi.gov.br/rpi/
 * - Marcas em XML: https://revistas.inpi.gov.br/txt/RM{edição}.zip
 *   (layout: Manual do usuário — layout .xml da RPI Marcas, INPI).
 * - Os atos só produzem efeito a partir da publicação (LPI, art. 226) e os
 *   prazos são contínuos (LPI, art. 221).
 *
 * O arquivo de uma edição tem dezenas de milhares de processos. Para não
 * carregar tudo, recortamos só os <processo> dos números monitorados (ou com o
 * procurador monitorado) e analisamos apenas esses trechos.
 */

export const INPI_PROVIDER_ID = "inpi_rpi" as const;
export const INPI_DEFAULT_BASE_URL = "https://revistas.inpi.gov.br";

export type InpiDispatch = {
  code: string | null;
  name: string;
  complement: string | null;
};

export type InpiTrademarkProcess = {
  processNumber: string;
  filedOn: string | null;
  grantedOn: string | null;
  validUntil: string | null;
  markName: string | null;
  presentation: string | null;
  nature: string | null;
  holders: Array<{ name: string; country: string | null; uf: string | null }>;
  attorney: string | null;
  niceClasses: string[];
  dispatches: InpiDispatch[];
};

export type InpiEdition = {
  edition: number;
  /** AAAA-MM-DD */
  publishedOn: string;
  processes: InpiTrademarkProcess[];
};

export type InpiRpiProviderOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** "17/11/2026" → "2026-11-17" */
export function parseInpiDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function normalizeInpiProcessNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  isArray: (name) =>
    ["despacho", "titular", "classe-nice", "processo", "classe-vienna"].includes(name),
  trimValues: true,
});

type Raw = Record<string, unknown>;

function rec(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function list(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.map(rec);
  return value ? [rec(value)] : [];
}

function txt(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object") return txt((value as Raw)["#text"]);
  const s = String(value).trim();
  return s ? s : null;
}

function findAll(node: unknown, key: string, out: Raw[] = []): Raw[] {
  if (Array.isArray(node)) {
    for (const item of node) findAll(item, key, out);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Raw)) {
      if (k === key) out.push(...list(v));
      else findAll(v, key, out);
    }
  }
  return out;
}

export function parseInpiProcessElement(processo: Raw): InpiTrademarkProcess | null {
  const processNumber = normalizeInpiProcessNumber(String(processo["@numero"] ?? ""));
  if (!processNumber) return null;
  const marca = rec(processo.marca);
  return {
    processNumber,
    filedOn: parseInpiDate(processo["@data-deposito"]),
    grantedOn: parseInpiDate(processo["@data-concessao"]),
    validUntil: parseInpiDate(processo["@data-vigencia"]),
    markName: txt(marca.nome),
    presentation: txt(marca["@apresentacao"]),
    nature: txt(marca["@natureza"]),
    holders: findAll(processo.titulares, "titular").map((t) => ({
      name: txt(t["@nome-razao-social"]) ?? "",
      country: txt(t["@pais"]),
      uf: txt(t["@uf"]),
    })),
    attorney: txt(processo.procurador),
    niceClasses: findAll(processo, "classe-nice")
      .map((c) => txt(c["@codigo"]))
      .filter((c): c is string => Boolean(c)),
    dispatches: findAll(processo.despachos, "despacho").map((d) => ({
      code: txt(d["@codigo"]),
      name: txt(d["@nome"]) ?? "Despacho",
      complement: txt(d["texto-complementar"]),
    })),
  };
}

const REVISTA_RE = /<revista\b[^>]*\bnumero="(\d+)"[^>]*\bdata="([^"]+)"/;

/** Recorta o elemento <processo> que contém a posição indicada. */
function sliceProcessAt(xml: string, index: number): string | null {
  const start = xml.lastIndexOf("<processo ", index);
  if (start < 0) return null;
  const end = xml.indexOf("</processo>", index);
  if (end < 0) return null;
  return xml.slice(start, end + "</processo>".length);
}

/**
 * Extrai da edição só os processos de interesse: pelos números (9 dígitos) e,
 * opcionalmente, pelo nome do procurador (comparação sem acento e caixa).
 */
export function extractTrademarkProcesses(
  xml: string,
  filter: { processNumbers?: Iterable<string>; attorneyNames?: Iterable<string> },
): { edition: number; publishedOn: string; processes: InpiTrademarkProcess[] } {
  const header = REVISTA_RE.exec(xml.slice(0, 2_000));
  if (!header) throw new AppError("EXTERNAL_SERVICE_ERROR", "RPI em formato inesperado.");
  const edition = Number(header[1]);
  const publishedOn = parseInpiDate(header[2]);
  if (!publishedOn) throw new AppError("EXTERNAL_SERVICE_ERROR", "Data da RPI inválida.");

  const chunks = new Map<string, string>();
  for (const raw of filter.processNumbers ?? []) {
    const number = normalizeInpiProcessNumber(raw);
    if (!number) continue;
    let from = 0;
    for (;;) {
      const at = xml.indexOf(`<processo numero="${number}"`, from);
      if (at < 0) break;
      const chunk = sliceProcessAt(xml, at + 1);
      if (chunk) chunks.set(`${number}:${at}`, chunk);
      from = at + 1;
    }
  }

  const fold = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  const attorneys = [...(filter.attorneyNames ?? [])].map(fold).filter((n) => n.length >= 5);
  if (attorneys.length > 0) {
    const re = /<procurador>([^<]+)<\/procurador>/g;
    for (let m = re.exec(xml); m; m = re.exec(xml)) {
      const name = fold(m[1] ?? "");
      if (attorneys.some((a) => name.includes(a))) {
        const chunk = sliceProcessAt(xml, m.index);
        if (chunk) chunks.set(`attorney:${m.index}`, chunk);
      }
    }
  }

  const processes: InpiTrademarkProcess[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks.values()) {
    const parsed = parser.parse(chunk) as Raw;
    for (const processo of list(parsed.processo)) {
      const p = parseInpiProcessElement(processo);
      if (!p) continue;
      const key = `${p.processNumber}:${p.dispatches.map((d) => d.code ?? d.name).join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      processes.push(p);
    }
  }
  return { edition, publishedOn, processes };
}

export class InpiRpiProvider {
  readonly id = INPI_PROVIDER_ID;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: InpiRpiProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? INPI_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 40_000;
  }

  private async get(url: string): Promise<Response> {
    const response = await this.fetchImpl(url, {
      headers: { "User-Agent": "VerasJuris/1.0 (+https://www.verasjuris.com)" },
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch(() => {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Não foi possível acessar a RPI do INPI agora.");
    });
    if (response.status === 404) {
      throw new AppError("NOT_FOUND", "Edição da RPI ainda não publicada.");
    }
    if (!response.ok) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", `A RPI respondeu HTTP ${response.status}.`);
    }
    return response;
  }

  /** Número da edição mais recente listada no índice oficial. */
  async latestEdition(): Promise<number> {
    const html = await (await this.get(`${this.baseUrl}/rpi/`)).text();
    const numbers = [...html.matchAll(/RM(\d{4,5})\.zip/g)].map((m) => Number(m[1]));
    if (numbers.length === 0) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Índice da RPI sem edições de Marcas.");
    }
    return Math.max(...numbers);
  }

  /** Baixa e descompacta o XML de Marcas de uma edição. */
  async downloadTrademarkXml(edition: number): Promise<string> {
    const response = await this.get(`${this.baseUrl}/txt/RM${edition}.zip`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes, { filter: (file) => file.name.toLowerCase().endsWith(".xml") });
    } catch {
      throw new AppError("EXTERNAL_SERVICE_ERROR", `Arquivo RM${edition}.zip corrompido.`);
    }
    const first = Object.values(files)[0];
    if (!first) throw new AppError("EXTERNAL_SERVICE_ERROR", `RM${edition}.zip sem XML.`);
    return strFromU8(first);
  }

  async trademarkEdition(
    edition: number,
    filter: { processNumbers?: Iterable<string>; attorneyNames?: Iterable<string> },
  ): Promise<InpiEdition> {
    const xml = await this.downloadTrademarkXml(edition);
    return extractTrademarkProcesses(xml, filter);
  }
}
