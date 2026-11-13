import { describe, expect, it } from "vitest";
import {
  isCommonPassword,
  isValidCnpj,
  isValidCpf,
  toE164BrMobile,
} from "./br-documents.js";

describe("br-documents", () => {
  it("valida CPF conhecido", () => {
    expect(isValidCpf("390.533.447-05")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("valida CNPJ conhecido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });

  it("normaliza telefone BR para E.164", () => {
    expect(toE164BrMobile("(11) 98888-7777")).toBe("+5511988887777");
    expect(toE164BrMobile("11988887777")).toBe("+5511988887777");
    expect(toE164BrMobile("123")).toBeNull();
  });

  it("detecta senhas comuns", () => {
    expect(isCommonPassword("password1234")).toBe(true);
    expect(isCommonPassword("frase-senha-unica-42")).toBe(false);
  });
});
