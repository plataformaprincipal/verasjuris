import { describe, expect, it } from "vitest";
import { classifyCommunication, extractExplicitDays } from "./classify.js";

describe("classificação de comunicações", () => {
  it("lê prazo explícito no texto", () => {
    expect(extractExplicitDays("no prazo de 10 (dez) dias, manifeste-se")).toBe(10);
    expect(extractExplicitDays("no prazo de cinco dias")).toBe(5);
    expect(extractExplicitDays("Intimem-se.")).toBeNull();
  });

  it("aplica regras do CPC na Justiça comum", () => {
    expect(classifyCommunication({ text: "Cite-se o réu.", tribunal: "TJPB" })).toMatchObject({
      category: "citacao",
      suggestedDays: 15,
    });
    expect(
      classifyCommunication({
        text: "Ante o exposto, JULGO PROCEDENTE o pedido.",
        tribunal: "TJSP",
      }),
    ).toMatchObject({ category: "sentenca", suggestedDays: 15 });
    expect(
      classifyCommunication({
        text: "Opostos embargos de declaração, intime-se a parte contrária.",
      }),
    ).toMatchObject({ category: "embargos_declaracao", suggestedDays: 5 });
    expect(classifyCommunication({ text: "Cumpra-se." })).toMatchObject({
      category: "despacho",
      suggestedDays: 5,
    });
  });

  it("aplica regras da CLT na Justiça do Trabalho", () => {
    expect(
      classifyCommunication({ text: "JULGO PROCEDENTES EM PARTE os pedidos.", tribunal: "TRT13" }),
    ).toMatchObject({ category: "sentenca", suggestedDays: 8 });
    expect(
      classifyCommunication({ text: "Notifique-se. Citação da reclamada.", tribunal: "TRT13" }),
    ).toMatchObject({
      category: "citacao",
      suggestedDays: null,
    });
  });

  it("prazo citado no texto prevalece sobre a regra geral e fica registrado", () => {
    const c = classifyCommunication({
      text: "Intime-se a parte autora para, no prazo de 10 (dez) dias, apresentar réplica.",
    });
    expect(c.category).toBe("replica");
    expect(c.suggestedDays).toBe(10);
    expect(c.basis).toContain("citado no texto");
  });

  it("audiência não gera contagem de prazo", () => {
    expect(
      classifyCommunication({
        text: "Fica designada audiência de instrução para o dia 10/05/2026.",
      }),
    ).toMatchObject({ category: "audiencia", suggestedDays: null });
  });
});
