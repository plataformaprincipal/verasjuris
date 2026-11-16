import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate, formatNumber } from "./format";

describe("i18n format", () => {
  it("formata data e número por locale sem alterar o valor", () => {
    const date = new Date("2026-11-16T12:00:00.000Z");
    expect(formatDate(date, "pt-BR")).toMatch(/16/);
    expect(formatNumber(1234.5, "pt-BR")).toContain("1");
    expect(formatNumber(1234.5, "en-US")).toContain("1");
  });

  it("formata moeda a partir de centavos sem mutar o inteiro", () => {
    const cents = 1990;
    expect(formatCurrency(cents, "pt-BR")).toMatch(/19/);
    expect(formatCurrency(cents, "en-US", "BRL")).toMatch(/19/);
    expect(cents).toBe(1990);
  });
});
