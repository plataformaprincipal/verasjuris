import { describe, expect, it } from "vitest";
import {
  classifyPassword,
  isPasswordAcceptable,
  passwordPolicyError,
  passwordStrength,
} from "./password-policy.js";

describe("password-policy", () => {
  it("rejeita senha com 7 caracteres mesmo com composição", () => {
    expect(isPasswordAcceptable("Veras@1")).toBe(false);
    expect(passwordPolicyError("Veras@1")).toContain("8 caracteres");
    expect(classifyPassword("Veras@1")).toBe("nao_atende");
  });

  it("aceita senha com 8 caracteres e todos os requisitos (BOA)", () => {
    expect(isPasswordAcceptable("Veras@12")).toBe(true);
    expect(classifyPassword("Veras@12")).toBe("boa");
    expect(passwordStrength("Veras@12").label).toBe("Boa");
  });

  it("classifica senha com 11 caracteres como BOA", () => {
    expect(classifyPassword("Veras@12345")).toBe("boa");
    expect(isPasswordAcceptable("Veras@12345")).toBe(true);
  });

  it("classifica senha com 12+ caracteres como EXCELENTE", () => {
    expect(classifyPassword("VerasJuris@2026")).toBe("excelente");
    expect(passwordStrength("VerasJuris@2026").label).toBe("Excelente");
    expect(isPasswordAcceptable("VerasJuris@2026")).toBe(true);
  });

  it("rejeita senha sem caractere especial", () => {
    expect(isPasswordAcceptable("VerasJuris1")).toBe(false);
    expect(passwordPolicyError("VerasJuris1")).toMatch(/caractere especial/i);
  });

  it("rejeita senha sem maiúscula, minúscula ou número", () => {
    expect(isPasswordAcceptable("veras@123")).toBe(false);
    expect(isPasswordAcceptable("VERAS@123")).toBe(false);
    expect(isPasswordAcceptable("Veras@abc")).toBe(false);
  });

  it("rejeita senhas comuns mesmo longas", () => {
    expect(isPasswordAcceptable("password1234")).toBe(false);
    expect(passwordStrength("password1234").label).toBe("Senha muito comum");
  });
});
