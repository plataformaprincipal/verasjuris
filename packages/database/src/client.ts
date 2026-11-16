import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema/index.js";

export type AppDatabase = PostgresJsDatabase<typeof schema>;

export function createDatabase(
  connectionString: string,
  max = 10,
): {
  db: AppDatabase;
  close: () => Promise<void>;
} {
  const client = postgres(connectionString, { max, connect_timeout: 10 });
  const db = drizzle(client, { schema });
  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}

function walkErrorChain(error: unknown, visit: (current: Record<string, unknown>) => boolean): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (visit(current as Record<string, unknown>)) return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export function isUniqueViolation(error: unknown): boolean {
  return walkErrorChain(error, (current) => current.code === "23505");
}

/** Nome da constraint ou detalhe da violação de unicidade, quando disponível. */
export function uniqueViolationInfo(error: unknown): { constraint?: string; detail?: string } | null {
  if (!isUniqueViolation(error)) return null;

  let constraint: string | undefined;
  let detail: string | undefined;
  const messages: string[] = [];

  walkErrorChain(error, (current) => {
    if (typeof current.message === "string") messages.push(current.message);
    if (typeof current.detail === "string") messages.push(current.detail);
    if (!constraint) {
      if (typeof current.constraint_name === "string") constraint = current.constraint_name;
      else if (typeof current.constraint === "string") constraint = current.constraint;
    }
    if (!detail && typeof current.detail === "string") detail = current.detail;
    return false; // percorre toda a cadeia
  });

  const haystack = [constraint, detail, ...messages]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n")
    .toLowerCase();

  // PGlite/Drizzle às vezes omitem constraint_name; inferir pelo texto do erro.
  if (!constraint) {
    if (haystack.includes("users_email_unique") || /\(email\)/.test(haystack)) {
      constraint = "users_email_unique";
    } else if (
      haystack.includes("profiles_cpf_normalized_unique") ||
      haystack.includes("cpf_normalized")
    ) {
      constraint = "profiles_cpf_normalized_unique";
    }
  }

  return { constraint, detail: detail ?? messages[0] };
}
