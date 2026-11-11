import { Readable } from "node:stream";
import { AppError } from "@verasjuris/types";
import { assertSafeStorageKey } from "./local-private-storage.js";
import type {
  GetObjectResult,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageProvider,
  TemporaryDownloadUrl,
} from "./types.js";

export type SupabaseStorageOptions = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket?: string;
  fetchImpl?: typeof fetch;
};

async function bodyToBuffer(body: Readable | Buffer | Uint8Array): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Object storage privado via Supabase Storage REST (fetch, sem SDK).
 * Assume bucket privado — nunca expõe URL pública permanente.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly status = "configured" as const;
  private readonly baseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupabaseStorageOptions) {
    const url = options.supabaseUrl.trim().replace(/\/$/, "");
    const key = options.serviceRoleKey.trim();
    if (!url || !key) {
      throw new AppError(
        "NOT_CONFIGURED",
        "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para STORAGE_PROVIDER=supabase.",
      );
    }
    this.baseUrl = url;
    this.serviceRoleKey = key;
    this.bucket = (options.bucket?.trim() || "VERASJURIS").replace(/^\/+|\/+$/g, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private objectUrl(key: string): string {
    const safe = assertSafeStorageKey(key);
    return `${this.baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${safe
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceRoleKey}`,
      apikey: this.serviceRoleKey,
      ...extra,
    };
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const buffer = await bodyToBuffer(input.body);
    if (input.contentLength !== undefined && input.contentLength !== buffer.byteLength) {
      throw new AppError("VALIDATION_ERROR", "Tamanho do objeto não corresponde a contentLength.");
    }

    const response = await this.fetchImpl(this.objectUrl(input.key), {
      method: "POST",
      headers: this.authHeaders({
        "Content-Type": input.contentType,
        "x-upsert": "true",
      }),
      body: buffer,
    });

    if (!response.ok) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Falha ao gravar objeto no storage.");
    }

    const etag = response.headers.get("etag") ?? undefined;
    return {
      key: input.key,
      sizeBytes: buffer.byteLength,
      ...(etag ? { etag } : {}),
    };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const response = await this.fetchImpl(this.objectUrl(key), {
      method: "GET",
      headers: this.authHeaders(),
    });
    if (response.status === 404) {
      throw new AppError("NOT_FOUND", "Objeto não encontrado no storage.");
    }
    if (!response.ok || !response.body) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Falha ao ler objeto no storage.");
    }

    const contentType = response.headers.get("content-type") ?? undefined;
    const lengthHeader = response.headers.get("content-length");
    const sizeBytes = lengthHeader ? Number(lengthHeader) : undefined;
    const arrayBuffer = await response.arrayBuffer();
    return {
      stream: Readable.from(Buffer.from(arrayBuffer)),
      ...(contentType ? { contentType } : {}),
      ...(sizeBytes !== undefined && Number.isFinite(sizeBytes) ? { sizeBytes } : {}),
    };
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.headObject(key);
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === "NOT_FOUND") return false;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const safe = assertSafeStorageKey(key);
    const response = await this.fetchImpl(this.objectUrl(safe), {
      method: "DELETE",
      headers: this.authHeaders(),
    });
    if (response.status === 404) return;
    if (!response.ok) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Falha ao remover objeto no storage.");
    }
  }

  async headObject(key: string): Promise<HeadObjectResult> {
    const response = await this.fetchImpl(this.objectUrl(key), {
      method: "HEAD",
      headers: this.authHeaders(),
    });
    if (response.status === 404) {
      throw new AppError("NOT_FOUND", "Objeto não encontrado no storage.");
    }
    if (!response.ok) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Falha ao consultar objeto no storage.");
    }
    const lengthHeader = response.headers.get("content-length");
    const sizeBytes = lengthHeader ? Number(lengthHeader) : 0;
    const contentType = response.headers.get("content-type") ?? undefined;
    return {
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
      ...(contentType ? { contentType } : {}),
    };
  }

  async createTemporaryDownloadUrl(key: string, ttlSeconds: number): Promise<TemporaryDownloadUrl> {
    const safe = assertSafeStorageKey(key);
    const ttl = Math.min(Math.max(Math.trunc(ttlSeconds), 30), 3600);
    const path = `${this.baseUrl}/storage/v1/object/sign/${encodeURIComponent(this.bucket)}/${safe
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    const response = await this.fetchImpl(path, {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: ttl }),
    });

    if (!response.ok) {
      throw new AppError("EXTERNAL_SERVICE_ERROR", "Falha ao criar URL temporária de download.");
    }

    const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
    const signed = payload.signedURL ?? payload.signedUrl;
    if (!signed || typeof signed !== "string") {
      throw new AppError(
        "EXTERNAL_SERVICE_ERROR",
        "Resposta inválida ao criar URL temporária de download.",
      );
    }

    const url = signed.startsWith("http")
      ? signed
      : `${this.baseUrl}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;

    return {
      url,
      expiresAt: new Date(Date.now() + ttl * 1000),
    };
  }
}
