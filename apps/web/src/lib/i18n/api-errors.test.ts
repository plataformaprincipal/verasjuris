import { describe, expect, it } from "vitest";
import {
  PASSWORD_COMMON_MESSAGE,
  PASSWORD_MIN_LENGTH_MESSAGE,
  PASSWORD_REQUIREMENT_MESSAGE,
  BIRTH_DATE_UNDERAGE_MESSAGE,
} from "@verasjuris/validation";
import { mapErrorCode, translateApiFailure, translateFieldError } from "./api-errors";
import { MESSAGE_CATALOGS } from "./catalogs";

const t = (key: string, fallback?: string) =>
  MESSAGE_CATALOGS["en-US"][key as keyof (typeof MESSAGE_CATALOGS)["en-US"]] ??
  fallback ??
  key;

describe("mapErrorCode", () => {
  it("maps stable API codes without relying on message text", () => {
    expect(mapErrorCode("VALIDATION_ERROR", t)).toBe(MESSAGE_CATALOGS["en-US"]["errors.validation"]);
    expect(mapErrorCode("CONFLICT", t)).toBe(MESSAGE_CATALOGS["en-US"]["errors.conflict"]);
    expect(mapErrorCode("RATE_LIMIT", t)).toBe(MESSAGE_CATALOGS["en-US"]["errors.rateLimited"]);
    expect(mapErrorCode("RATE_LIMITED", t)).toBe(MESSAGE_CATALOGS["en-US"]["errors.rateLimited"]);
    expect(mapErrorCode("UNAUTHORIZED", t)).toBe(MESSAGE_CATALOGS["en-US"]["errors.unauthorized"]);
    expect(mapErrorCode("AUTHENTICATION_ERROR", t)).toBe(
      MESSAGE_CATALOGS["en-US"]["errors.unauthorized"],
    );
    expect(mapErrorCode("NETWORK", t)).toBe(MESSAGE_CATALOGS["en-US"]["errors.network"]);
  });
});

describe("translateFieldError", () => {
  it("maps password/birthDate by path and exact source message tokens", () => {
    expect(translateFieldError("password", PASSWORD_MIN_LENGTH_MESSAGE, t)).toBe(
      MESSAGE_CATALOGS["en-US"]["register.validation.password.minLength"],
    );
    expect(translateFieldError("password", PASSWORD_REQUIREMENT_MESSAGE, t)).toBe(
      MESSAGE_CATALOGS["en-US"]["register.validation.password.requirements"],
    );
    expect(translateFieldError("password", PASSWORD_COMMON_MESSAGE, t)).toBe(
      MESSAGE_CATALOGS["en-US"]["register.validation.password.common"],
    );
    expect(translateFieldError("birthDate", BIRTH_DATE_UNDERAGE_MESSAGE, t)).toBe(
      MESSAGE_CATALOGS["en-US"]["register.validation.birthDate.underage"],
    );
    expect(translateFieldError("email", "whatever", t)).toBe(
      MESSAGE_CATALOGS["en-US"]["register.validation.email"],
    );
  });
});

describe("translateApiFailure", () => {
  it("prefers error.code over Portuguese message text", () => {
    expect(
      translateApiFailure(
        { error: { code: "VALIDATION_ERROR", message: "Alguns campos precisam de correção." } },
        t,
      ),
    ).toBe(MESSAGE_CATALOGS["en-US"]["errors.validation"]);
    expect(
      translateApiFailure(
        { error: { code: "CONFLICT", message: "Este e-mail já está cadastrado." } },
        t,
      ),
    ).toBe(MESSAGE_CATALOGS["en-US"]["register.errors.conflict"]);
  });
});
