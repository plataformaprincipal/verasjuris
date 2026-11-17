import { describe, expect, it } from "vitest";
import {
  JURIS_ONE_GUEST_LIMIT,
  JURIS_WORK_STATUS,
  jurisOneReply,
  redirectsForObjective,
} from "./juris-one";

describe("juris one public stage", () => {
  it("routes public Work to authenticated app with login redirect", () => {
    expect(JURIS_WORK_STATUS.available).toBe(false);
    expect(JURIS_WORK_STATUS.authenticatedAvailable).toBe(true);
    expect(JURIS_WORK_STATUS.authenticatedScaffold).toBe(false);
    expect(JURIS_WORK_STATUS.hrefAuthenticated).toBe("/app/juris-one/work");
    expect(JURIS_WORK_STATUS.hrefLogin).toContain("/entrar");
    expect(JURIS_WORK_STATUS.hrefLogin).toContain("juris-one%2Fwork");
  });

  it("limits guest stage and answers via FAQ honesty", () => {
    expect(JURIS_ONE_GUEST_LIMIT).toBeGreaterThan(0);
    const { reply, matchedFaq } = jurisOneReply("pt-BR", "support", "Como entrar na conta?", 2);
    expect(matchedFaq).toBe(true);
    expect(reply).toMatch(/não sou advogado|não substitui advogado/i);
    expect(reply).toMatch(/FAQ|orientação/i);
  });

  it("routes marketplace objective to real public paths", () => {
    const links = redirectsForObjective("servico").map((item) => item.href);
    expect(links).toContain("/marketplace-juridico");
    expect(links).toContain("/cadastro");
  });
});
