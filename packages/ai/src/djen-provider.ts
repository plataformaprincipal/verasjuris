import { AppError } from "@verasjuris/types";

/**
 * DJEN — Diário de Justiça Eletrônico Nacional (CNJ), consulta pública de
 * comunicações processuais em https://comunicaapi.pje.jus.br/api/v1/comunicacao.
 *
 * - Consulta pública, sem chave nem cadastro.
 * - A API recusa IPs fora do Brasil: a função que chama deve rodar em região
 *   brasileira (Vercel gru1).
 * - Rajadas podem receber HTTP 500: chamadas espaçadas e com nova tentativa.
 * - `itensPorPagina` acima de 50 pode voltar `items` vazio: usamos 50.
 *
 * Os nomes de campo da resposta variam entre snake_case e camelCase; o parser
 * aceita os dois e nunca inventa dado ausente.
 */

export const DJEN_PROVIDER_ID = "djen" as const;
export const DJEN_DEFAULT_BASE_URL = "https://comunicaapi.pje.jus.br/api/v1";
export const DJEN_PAGE_SIZE = 50;

export type DjenSearchInput = {
  oabNumber: string;
  oabUf: string;
  /** AAAA-MM-DD, inclusive. */
  availableFrom: string;
  /** AAAA-MM-DD, inclusive. */
  availableTo: string;
  tribunal?: string;
  signal?: AbortSignal;
};

export type DjenRecipient = { name: string; side: string | null };
export type DjenRecipientLawyer = { name: string; oabNumber: string | null; oabUf: string | null };

export type DjenCommunication = {
  externalId: string;
  hash: string | null;
  /** AAAA-MM-DD */
  availableOn: string;
  tribunal: string | null;
  communicationType: string | null;
  documentType: string | null;
  courtBody: string | null;
  className: string | null;
  /** 20 dígitos, sem máscara; null se ausente. */
  processNumber: string | null;
  processNumberMasked: string | null;
  medium: string | null;
  text: string;
  link: string | null;
  recipients: DjenRecipient[];
  lawyers: DjenRecipientLawyer[];
};

export type DjenSearchResult = {
  items: DjenCommunication[];
  total: number;
  pages: number;
};

export type DjenProviderOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Intervalo mínimo entre requisições (ms). Padrão 600. */
  minIntervalMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** Teto de páginas por consulta, para não estourar o tempo da função. */
  maxPages?: number;
  sleep?: (ms: number) => Promise<void>;
};

type Raw = Record<string, unknown>;

function pick(record: Raw, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") return record[key];
  }
  return undefined;
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function normalizeCnjNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 20 ? digits : null;
}

export function maskCnjNumber(digits: string): string {
  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

/** Aceita "2026-03-10", "2026-03-10T00:00:00" e "10/03/2026". */
export function parseDjenDate(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/** Remove HTML do texto da comunicação, preservando quebras de parágrafo. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function asArray(value: unknown): Raw[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === "object") as Raw[]) : [];
}

/** Converte um item bruto da API. Retorna null se faltar id ou data. */
export function parseDjenItem(raw: Raw): DjenCommunication | null {
  const externalId = str(pick(raw, "id", "idComunicacao", "comunicacao_id"));
  const availableOn = parseDjenDate(
    pick(raw, "data_disponibilizacao", "dataDisponibilizacao", "datadisponibilizacao"),
  );
  if (!externalId || !availableOn) return null;

  const rawNumber = str(pick(raw, "numero_processo", "numeroProcesso", "numeroprocessocommascara"));
  const processNumber = normalizeCnjNumber(rawNumber);

  const recipients = asArray(pick(raw, "destinatarios", "destinatarios_comunicacao")).map(
    (item) => ({
      name: str(pick(item, "nome")) ?? "",
      side: str(pick(item, "polo")),
    }),
  );

  const lawyers = asArray(pick(raw, "destinatarioadvogados", "destinatarioAdvogados")).map(
    (item) => {
      const advogado = (pick(item, "advogado") as Raw | undefined) ?? item;
      return {
        name: str(pick(advogado, "nome")) ?? "",
        oabNumber: str(pick(advogado, "numero_oab", "numeroOab")),
        oabUf: str(pick(advogado, "uf_oab", "ufOab"))?.toUpperCase() ?? null,
      };
    },
  );

  const textRaw = str(pick(raw, "texto", "conteudo")) ?? "";
  return {
    externalId,
    hash: str(pick(raw, "hash")),
    availableOn,
    tribunal: str(pick(raw, "siglaTribunal", "sigla_tribunal"))?.toUpperCase() ?? null,
    communicationType: str(pick(raw, "tipoComunicacao", "tipo_comunicacao")),
    documentType: str(pick(raw, "tipoDocumento", "tipo_documento")),
    courtBody: str(pick(raw, "nomeOrgao", "nome_orgao")),
    className: str(pick(raw, "nomeClasse", "nome_classe")),
    processNumber,
    processNumberMasked: processNumber ? maskCnjNumber(processNumber) : rawNumber,
    medium: str(pick(raw, "meiocompleto", "meio")),
    text: stripHtml(textRaw),
    link: str(pick(raw, "link")),
    recipients: recipients.filter((r) => r.name),
    lawyers: lawyers.filter((l) => l.name || l.oabNumber),
  };
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export class DjenProvider {
  readonly id = DJEN_PROVIDER_ID;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly maxPages: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private lastRequestAt = 0;

  constructor(options: DjenProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DJEN_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.minIntervalMs = options.minIntervalMs ?? 600;
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxPages = options.maxPages ?? 20;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async throttle(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastRequestAt = Date.now();
  }

  private async getJson(url: string, signal?: AbortSignal): Promise<Raw> {
    let attempt = 0;
    for (;;) {
      await this.throttle();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "VerasJuris/1.0 (+https://www.verasjuris.com)",
          },
          signal: controller.signal,
        });
        if (response.status === 403) {
          throw new AppError(
            "EXTERNAL_SERVICE_ERROR",
            "O DJEN recusou a consulta (HTTP 403). A API só aceita chamadas de IP brasileiro.",
          );
        }
        if (RETRYABLE.has(response.status) && attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(1_000 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          throw new AppError("EXTERNAL_SERVICE_ERROR", `O DJEN respondeu HTTP ${response.status}.`);
        }
        const body = (await response.json()) as unknown;
        if (!body || typeof body !== "object") {
          throw new AppError("EXTERNAL_SERVICE_ERROR", "Resposta do DJEN em formato inesperado.");
        }
        return body as Raw;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (signal?.aborted)
          throw new AppError("EXTERNAL_SERVICE_ERROR", "Consulta ao DJEN cancelada.");
        if (attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(1_000 * 2 ** attempt);
          continue;
        }
        throw new AppError("EXTERNAL_SERVICE_ERROR", "Não foi possível consultar o DJEN agora.");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  /** Busca todas as páginas do intervalo, até `maxPages`. */
  async searchByOab(input: DjenSearchInput): Promise<DjenSearchResult> {
    const oabNumber = input.oabNumber.replace(/\D/g, "");
    const oabUf = input.oabUf.trim().toUpperCase();
    if (!oabNumber || !/^[A-Z]{2}$/.test(oabUf)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Número e UF da OAB são obrigatórios para consultar o DJEN.",
      );
    }
    const items: DjenCommunication[] = [];
    let total = 0;
    let page = 1;
    for (; page <= this.maxPages; page += 1) {
      const params = new URLSearchParams({
        numeroOab: oabNumber,
        ufOab: oabUf,
        dataDisponibilizacaoInicio: input.availableFrom,
        dataDisponibilizacaoFim: input.availableTo,
        pagina: String(page),
        itensPorPagina: String(DJEN_PAGE_SIZE),
      });
      if (input.tribunal) params.set("siglaTribunal", input.tribunal.toUpperCase());
      const body = await this.getJson(`${this.baseUrl}/comunicacao?${params}`, input.signal);
      total = Number(pick(body, "count", "total")) || 0;
      const rawItems = asArray(pick(body, "items", "content", "comunicacoes"));
      for (const raw of rawItems) {
        const parsed = parseDjenItem(raw);
        if (parsed) items.push(parsed);
      }
      if (rawItems.length < DJEN_PAGE_SIZE || items.length >= total) break;
    }
    return { items, total, pages: Math.min(page, this.maxPages) };
  }

  /** URL pública da certidão de publicação, quando houver hash. */
  certificateUrl(hash: string): string {
    return `${this.baseUrl}/comunicacao/${encodeURIComponent(hash)}/certidao`;
  }
}
