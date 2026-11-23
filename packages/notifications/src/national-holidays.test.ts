import { describe, expect, it } from "vitest";
import { calculateDeadlineDueAt } from "./deadline-calculator.js";
import {
  addForensicBusinessDays,
  djenTermDates,
  easterSunday,
  NationalForensicHolidayCalendar,
  nationalForensicHolidays,
  nonBusinessReason,
} from "./national-holidays.js";

describe("calendário forense nacional", () => {
  it("calcula a Páscoa e as datas móveis", () => {
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
    const h2026 = nationalForensicHolidays(2026);
    expect(h2026.get("2026-02-16")).toContain("Carnaval");
    expect(h2026.get("2026-02-17")).toContain("Carnaval");
    expect(h2026.get("2026-04-03")).toBe("Sexta-feira Santa");
    expect(h2026.get("2026-06-04")).toBe("Corpus Christi");
    expect(h2026.get("2026-11-20")).toContain("Consciência Negra");
    expect(h2026.get("2026-12-08")).toBe("Dia da Justiça");
  });

  it("distingue expediente (até 6/1) de suspensão de prazos (até 20/1)", () => {
    expect(nonBusinessReason("2027-01-12", "expedient")).toBeNull();
    expect(nonBusinessReason("2027-01-12", "counting")).toContain("CPC, art. 220");
    expect(nonBusinessReason("2027-01-05", "expedient")).toContain("recesso");
    expect(nonBusinessReason("2027-01-21", "counting")).toBeNull();
  });

  it("DJEN: publicação no dia útil seguinte e início no próximo", () => {
    // Sexta → publicação na segunda → início na terça.
    expect(djenTermDates("2026-03-06")).toMatchObject({
      publishedOn: "2026-03-09",
      termStartsOn: "2026-03-10",
    });
    // Quinta antes da Sexta-feira Santa → publicação na segunda.
    expect(djenTermDates("2026-04-02")).toMatchObject({
      publishedOn: "2026-04-06",
      termStartsOn: "2026-04-07",
    });
    // Disponibilizada em 12/1: publicada em 13/1, prazo só começa em 21/1.
    expect(djenTermDates("2027-01-12")).toMatchObject({
      publishedOn: "2027-01-13",
      termStartsOn: "2027-01-21",
    });
  });

  it("conta dias úteis com o termo inicial como 1º dia", () => {
    // 15 dias úteis a partir de 10/3/2026 (sem feriados no intervalo).
    expect(addForensicBusinessDays("2026-03-10", 15)).toBe("2026-03-30");
    // Passa pela Sexta-feira Santa (3/4/2026).
    expect(addForensicBusinessDays("2026-03-30", 5)).toBe("2026-04-06");
  });

  it("o calculador de prazos com o calendário nacional bate com a contagem direta", async () => {
    const calc = await calculateDeadlineDueAt(
      {
        baseDate: new Date("2026-03-09T12:00:00.000Z"),
        ruleType: "business_days",
        ruleDays: 15,
        timezone: "America/Sao_Paulo",
      },
      new NationalForensicHolidayCalendar(),
    );
    expect(calc.calculatedDueAt?.toISOString().slice(0, 10)).toBe("2026-03-30");
    expect(calc.status).toBe("suggested");
  });
});
