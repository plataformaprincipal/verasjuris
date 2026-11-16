import { describe, expect, it } from "vitest";
import {
  BIRTH_DATE_FUTURE_MESSAGE,
  BIRTH_DATE_INVALID_MESSAGE,
  BIRTH_DATE_UNDERAGE_MESSAGE,
  ageInFullYears,
  parseCalendarDate,
  validateBirthDateValue,
} from "./birth-date.js";

const NOW = new Date("2026-11-16T15:00:00.000Z");

describe("birth-date", () => {
  it("rejeita data inexistente com mensagem específica", () => {
    expect(parseCalendarDate("2024-02-31")).toBeNull();
    expect(validateBirthDateValue("2024-02-31", NOW)).toBe(BIRTH_DATE_INVALID_MESSAGE);
    expect(validateBirthDateValue("1990-13-01", NOW)).toBe(BIRTH_DATE_INVALID_MESSAGE);
    expect(validateBirthDateValue("10/05/1990", NOW)).toBe(BIRTH_DATE_INVALID_MESSAGE);
  });

  it("rejeita data futura com mensagem específica", () => {
    expect(validateBirthDateValue("2027-01-01", NOW)).toBe(BIRTH_DATE_FUTURE_MESSAGE);
  });

  it("rejeita usuário abaixo da idade mínima com mensagem específica", () => {
    expect(validateBirthDateValue("2010-11-16", NOW)).toBe(BIRTH_DATE_UNDERAGE_MESSAGE);
    // Ainda não completou 18 anos (aniversário amanhã)
    expect(validateBirthDateValue("2008-11-17", NOW)).toBe(BIRTH_DATE_UNDERAGE_MESSAGE);
  });

  it("aceita usuário exatamente na idade mínima", () => {
    expect(validateBirthDateValue("2008-11-16", NOW)).toBeUndefined();
    expect(ageInFullYears({ year: 2008, month: 11, day: 16 }, NOW)).toBe(18);
  });

  it("respeita ano bissexto no cálculo de idade", () => {
    const leapBirth = parseCalendarDate("2008-02-29");
    expect(leapBirth).not.toBeNull();
    // Em 2026-02-28 ainda não completou aniversário
    expect(ageInFullYears(leapBirth!, new Date("2026-02-28T12:00:00.000Z"))).toBe(17);
    expect(ageInFullYears(leapBirth!, new Date("2026-03-01T12:00:00.000Z"))).toBe(18);
  });

  it("não confunde data inválida com idade insuficiente", () => {
    expect(validateBirthDateValue("2015-01-01", NOW)).toBe(BIRTH_DATE_UNDERAGE_MESSAGE);
    expect(validateBirthDateValue("abc", NOW)).toBe(BIRTH_DATE_INVALID_MESSAGE);
  });
});
