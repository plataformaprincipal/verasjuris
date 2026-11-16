/** Utilitários puros das demonstrações locais. */

/**
 * Data de referência fixa das demonstrações. Evita `Date.now()` na renderização
 * (sem divergência de hidratação) e deixa claro que não há calendário oficial.
 */
export const DEMO_REFERENCE_DATE = "2026-12-01";

export function nextId(prefix: string, existing: readonly { id: string }[]): string {
  let max = 0;
  for (const item of existing) {
    const match = /(\d+)$/.exec(item.id);
    if (match?.[1]) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function formatDateBr(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Diferença em dias corridos (b − a). Não é contagem processual. */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  if ([ya, ma, da, yb, mb, db].some((n) => n === undefined || Number.isNaN(n))) return 0;
  const ta = Date.UTC(ya as number, (ma as number) - 1, da as number);
  const tb = Date.UTC(yb as number, (mb as number) - 1, db as number);
  return Math.round((tb - ta) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return iso;
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Aceita "1234,56", "1.234,56" ou "1234.56"; devolve `null` se inválido. */
export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function includesText(haystack: string, needle: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  return norm(haystack).includes(norm(needle.trim()));
}

/** Gera um arquivo de texto localmente (Blob) e dispara o download. Nada é enviado. */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function moveInList<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return [...items];
  const copy = [...items];
  const [moved] = copy.splice(index, 1);
  if (moved !== undefined) copy.splice(target, 0, moved);
  return copy;
}
