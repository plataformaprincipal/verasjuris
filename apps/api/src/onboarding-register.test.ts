import { profiles, seedReferenceData, users } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, sessionFrom, testPassword as password } from "./test-helpers.js";

describe("onboarding register multi-persona", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;

  beforeAll(async () => {
    const database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
  });

  afterAll(async () => {
    await app.close();
    const database = await started;
    await database.close();
  });

  it("cadastra cliente PF com sessão e sem envio de e-mail", async () => {
    const response = await call(app, "POST", "/v1/auth/register", {
      persona: "client_pf",
      fullName: "Ana Souza Silva",
      cpf: "390.533.447-05",
      birthDate: "1990-05-10",
      email: "ana.cliente@exemplo.com",
      phone: "11988887777",
      address: {
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1000",
        district: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        country: "Brasil",
      },
      password,
      passwordConfirm: password,
      acceptTerms: true,
      acceptPrivacy: true,
      acceptMarketing: false,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<{
      status: string;
      redirectTo: string;
      emailVerified: boolean;
      account: { user: { email: string } };
    }>();
    expect(body.status).toBe("created");
    expect(body.redirectTo).toBe("/portal");
    expect(body.emailVerified).toBe(false);
    expect(body.account.user.email).toBe("ana.cliente@exemplo.com");
    expect(sessionFrom(response.headers)).toBeTruthy();
    expect(email.latest("email_verification", "ana.cliente@exemplo.com")).toBeUndefined();

    const database = await started;
    const user = await database.db.query.users.findFirst({
      where: eq(users.email, "ana.cliente@exemplo.com"),
    });
    expect(user?.status).toBe("active");
    expect(user?.emailVerifiedAt).toBeNull();
    const profile = await database.db.query.profiles.findFirst({
      where: eq(profiles.userId, user?.id ?? ""),
    });
    expect(profile?.onboardingPersona).toBe("client_pf");
    expect(profile?.cpfNormalized).toBe("39053344705");
    expect(profile?.phoneE164).toBe("+5511988887777");
  });

  it("cadastra advogado com OAB pendente de verificação", async () => {
    const response = await call(app, "POST", "/v1/auth/register", {
      persona: "lawyer",
      fullName: "Bruno Lima Rocha",
      cpf: "529.982.247-25",
      birthDate: "1985-01-20",
      email: "bruno.adv@exemplo.com",
      phone: "21977776666",
      address: {
        postalCode: "20040-020",
        street: "Rua da Assembleia",
        number: "10",
        district: "Centro",
        city: "Rio de Janeiro",
        state: "RJ",
        country: "Brasil",
      },
      oabNumber: "123456",
      oabUf: "RJ",
      practiceAreas: "Cível, Previdenciário",
      password,
      passwordConfirm: password,
      acceptTerms: true,
      acceptPrivacy: true,
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<{ redirectTo: string; account: { professionalVerificationStatus: string } }>();
    expect(body.redirectTo).toBe("/app");
    expect(body.account.professionalVerificationStatus).toBe("pending");
  });

  it("rejeita senha comum e CPF inválido", async () => {
    const weak = await call(app, "POST", "/v1/auth/register", {
      persona: "client_pf",
      fullName: "Carla Mendes Dias",
      cpf: "390.533.447-05",
      birthDate: "1992-03-03",
      email: "carla@exemplo.com",
      phone: "11988887777",
      address: {
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1",
        district: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        country: "Brasil",
      },
      password: "password1234",
      passwordConfirm: "password1234",
      acceptTerms: true,
      acceptPrivacy: true,
    });
    expect(weak.statusCode).toBe(400);

    const badCpf = await call(app, "POST", "/v1/auth/register", {
      persona: "client_pf",
      fullName: "Carla Mendes Dias",
      cpf: "111.111.111-11",
      birthDate: "1992-03-03",
      email: "carla2@exemplo.com",
      phone: "11988887777",
      address: {
        postalCode: "01310-100",
        street: "Avenida Paulista",
        number: "1",
        district: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        country: "Brasil",
      },
      password,
      passwordConfirm: password,
      acceptTerms: true,
      acceptPrivacy: true,
    });
    expect(badCpf.statusCode).toBe(400);
  });
});
