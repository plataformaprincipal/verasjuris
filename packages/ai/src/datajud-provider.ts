import { AppError } from "@verasjuris/types";
import type {
  CourtDecisionRecord,
  CourtDocumentRecord,
  CourtHearingRecord,
  CourtIntegrationCapability,
  CourtIntegrationHealth,
  CourtIntegrationProvider,
  CourtMovementRecord,
  CourtProcessRecord,
  CourtProcessSearchInput,
} from "./court-integration-provider.js";

/**
 * Datajud — API Pública do CNJ (https://api-publica.datajud.cnj.jus.br).
 *
 * - Autenticação por chave pública publicada pelo CNJ
 *   (https://datajud-wiki.cnj.jus.br/api-publica/acesso/), enviada como
 *   `Authorization: APIKey <chave>`. A chave pode mudar: fica em DATAJUD_API_KEY.
 * - Retorna metadados do processo (classe, assuntos, órgão julgador, grau) e
 *   movimentações. Não retorna partes nem advogados, nem documentos.
 * - Uso sujeito ao termo de uso da API pública do CNJ.
 */

export const DATAJUD_PROVIDER_ID = "datajud" as const;
export const DATAJUD_DEFAULT_BASE_URL = "https://api-publica.datajud.cnj.jus.br";

const STATE_CODE_TO_UF: Record<string, string> = {
  "01": "AC",
  "02": "AL",
  "03": "AP",
  "04": "AM",
  "05": "BA",
  "06": "CE",
  "07": "DFT",
  "08": "ES",
  "09": "GO",
  "10": "MA",
  "11": "MT",
  "12": "MS",
  "13": "MG",
  "14": "PA",
  "15": "PB",
  "16": "PR",
  "17": "PE",
  "18": "PI",
  "19": "RJ",
  "20": "RN",
  "21": "RS",
  "22": "RO",
  "23": "RR",
  "24": "SC",
  "25": "SE",
  "26": "SP",
  "27": "TO",
};

/** Dígito verificador módulo 97 (Resolução CNJ 65/2008). */
export function isValidCnjNumber(value: string): boolean {
  const n = value.replace(/\D/g, "");
  if (!/^\d{20}$/.test(n)) return false;
  const base = `${n.slice(0, 7)}${n.slice(9)}${n.slice(7, 9)}`;
  let remainder = 0;
  for (const digit of base) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/** Alias do tribunal no Datajud a partir do segmento J e do código TR do número CNJ. */
export function datajudAliasFromCnj(value: string): string | null {
  const n = value.replace(/\D/g, "");
  if (!/^\d{20}$/.test(n)) return null;
  const segment = Number(n.slice(13, 14));
  const code = n.slice(14, 16);
  const num = Number(code);
  switch (segment) {
    case 3:
      return code === "00" ? "STJ" : null;
    case 4:
      return num >= 1 && num <= 6 ? `TRF${num}` : null;
    case 5:
      if (code === "00") return "TST";
      return num >= 1 && num <= 24 ? `TRT${num}` : null;
    case 6: {
      if (code === "00") return "TSE";
      const uf = STATE_CODE_TO_UF[code];
      return uf ? `TRE-${uf}` : null;
    }
    case 7:
      return code === "00" ? "STM" : null;
    case 8: {
      const uf = STATE_CODE_TO_UF[code];
      return uf ? `TJ${uf}` : null;
    }
    case 9:
      return code === "13" ? "TJMMG" : code === "21" ? "TJMRS" : code === "26" ? "TJMSP" : null;
    default:
      return null;
  }
}

export type DatajudMovement = {
  code: number | null;
  name: string;
  occurredAt: string | null;
  complements: string[];
  courtBody: string | null;
};

export type DatajudProcess = {
  id: string;
  tribunal: string;
  processNumber: string;
  degree: string | null;
  className: string | null;
  classCode: number | null;
  subjects: Array<{ code: number | null; name: string }>;
  courtBody: string | null;
  courtBodyCode: number | null;
  filedAt: string | null;
  confidentialityLevel: number | null;
  system: string | null;
  format: string | null;
  lastUpdatedAt: string | null;
  movements: DatajudMovement[];
};

type Raw = Record<string, unknown>;

function rec(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function arr(value: unknown): Raw[] {
  return Array.isArray(value) ? value.map(rec) : [];
}

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

function int(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Datajud usa "2023-05-10T14:22:31.000Z" ou "20230510142231". */
export function parseDatajudTimestamp(value: unknown): string | null {
  const s = text(value);
  if (!s) return null;
  if (/^\d{14}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}.000Z`;
  }
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00.000Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseDatajudHit(hit: Raw): DatajudProcess | null {
  const source = rec(hit._source);
  const processNumber = text(source.numeroProcesso)?.replace(/\D/g, "") ?? null;
  const tribunal = text(source.tribunal);
  if (!processNumber || !tribunal) return null;
  const classe = rec(source.classe);
  const orgao = rec(source.orgaoJulgador);
  const movements = arr(source.movimentos)
    .map((m) => ({
      code: int(m.codigo),
      name: text(m.nome) ?? "Movimentação",
      occurredAt: parseDatajudTimestamp(m.dataHora),
      complements: arr(m.complementosTabelados)
        .map((c) => [text(c.nome), text(c.descricao)].filter(Boolean).join(": "))
        .filter((c): c is string => Boolean(c)),
      courtBody: text(rec(m.orgaoJulgador).nomeOrgao),
    }))
    .sort((a, b) => (a.occurredAt ?? "").localeCompare(b.occurredAt ?? ""));
  return {
    id: text(hit._id) ?? `${tribunal}_${processNumber}`,
    tribunal: tribunal.toUpperCase(),
    processNumber,
    degree: text(source.grau),
    className: text(classe.nome),
    classCode: int(classe.codigo),
    subjects: arr(source.assuntos).map((a) => ({ code: int(a.codigo), name: text(a.nome) ?? "" })),
    courtBody: text(orgao.nome),
    courtBodyCode: int(orgao.codigo),
    filedAt: parseDatajudTimestamp(source.dataAjuizamento),
    confidentialityLevel: int(source.nivelSigilo),
    system: text(rec(source.sistema).nome),
    format: text(rec(source.formato).nome),
    lastUpdatedAt: parseDatajudTimestamp(source.dataHoraUltimaAtualizacao),
    movements,
  };
}

export type DatajudProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
};

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class DatajudProvider implements CourtIntegrationProvider {
  readonly id = DATAJUD_PROVIDER_ID;
  readonly capabilities: readonly CourtIntegrationCapability[] = [
    "searchProcess",
    "getProcess",
    "getMovements",
  ];
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: DatajudProviderOptions) {
    const key = options.apiKey.replace(/^APIKey\s+/i, "").trim();
    if (!key) throw new AppError("NOT_CONFIGURED", "DATAJUD_API_KEY não configurada.");
    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? DATAJUD_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxRetries = options.maxRetries ?? 2;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private async search(alias: string, body: unknown, signal?: AbortSignal): Promise<Raw[]> {
    const url = `${this.baseUrl}/api_publica_${alias.toLowerCase()}/_search`;
    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const response = await this.fetchImpl(url, {
          method: "POST",
          headers: { Authorization: `APIKey ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            "EXTERNAL_SERVICE_ERROR",
            "O Datajud recusou a chave pública. Confira DATAJUD_API_KEY na página oficial do CNJ.",
          );
        }
        if (response.status === 404) return [];
        if (RETRYABLE.has(response.status) && attempt < this.maxRetries) {
          attempt += 1;
          await this.sleep(800 * 2 ** attempt);
          continue;
        }
        if (!response.ok) {
          throw new AppError(
            "EXTERNAL_SERVICE_ERROR",
            `O Datajud respondeu HTTP ${response.status}.`,
          );
        }
        const json = rec(await response.json());
        return arr(rec(json.hits).hits);
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (attempt < this.maxRetries && !signal?.aborted) {
          attempt += 1;
          await this.sleep(800 * 2 ** attempt);
          continue;
        }
        throw new AppError("EXTERNAL_SERVICE_ERROR", "Não foi possível consultar o Datajud agora.");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
  }

  /** Todos os registros (um por grau) do processo no tribunal derivado do número. */
  async fetchByNumber(cnjNumber: string, signal?: AbortSignal): Promise<DatajudProcess[]> {
    const number = cnjNumber.replace(/\D/g, "");
    const alias = datajudAliasFromCnj(number);
    if (!alias) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Não foi possível identificar o tribunal pelo número CNJ para consultar o Datajud.",
      );
    }
    const hits = await this.search(
      alias,
      { query: { match: { numeroProcesso: number } }, size: 10 },
      signal,
    );
    return hits.map(parseDatajudHit).filter((p): p is DatajudProcess => p !== null);
  }

  async searchProcess(input: CourtProcessSearchInput): Promise<readonly CourtProcessRecord[]> {
    const processes = await this.fetchByNumber(input.query, input.signal);
    return processes.map((p) => ({
      externalId: `${p.tribunal}:${p.processNumber}`,
      caseNumber: p.processNumber,
      tribunal: p.tribunal,
      status: p.degree,
      providerKey: this.id,
    }));
  }

  async getProcess(externalId: string, signal?: AbortSignal): Promise<CourtProcessRecord | null> {
    const number = externalId.split(":").pop() ?? externalId;
    const [first] = await this.fetchByNumber(number, signal);
    return first
      ? {
          externalId: `${first.tribunal}:${first.processNumber}`,
          caseNumber: first.processNumber,
          tribunal: first.tribunal,
          status: first.degree,
          providerKey: this.id,
        }
      : null;
  }

  async getMovements(
    processExternalId: string,
    signal?: AbortSignal,
  ): Promise<readonly CourtMovementRecord[]> {
    const number = processExternalId.split(":").pop() ?? processExternalId;
    const processes = await this.fetchByNumber(number, signal);
    return processes.flatMap((p) =>
      p.movements.map((m, index) => ({
        externalId: `${p.id}:${m.code ?? "x"}:${m.occurredAt ?? index}`,
        occurredAt: m.occurredAt,
        summary: [m.name, ...m.complements].join(" — "),
      })),
    );
  }

  async getHearings(): Promise<readonly CourtHearingRecord[]> {
    return [];
  }

  async getDecisions(): Promise<readonly CourtDecisionRecord[]> {
    return [];
  }

  async getDocuments(): Promise<readonly CourtDocumentRecord[]> {
    return [];
  }

  async healthCheck(): Promise<CourtIntegrationHealth> {
    return {
      status: "ok",
      detail: "Datajud configurado (chave pública do CNJ). Sem partes, advogados ou documentos.",
      checkedAt: new Date().toISOString(),
    };
  }
}
