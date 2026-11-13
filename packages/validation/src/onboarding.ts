import { z } from "zod";
import {
  digitsOnly,
  isCommonPassword,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  toE164BrMobile,
} from "./br-documents.js";

const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe o e-mail.")
  .max(320, "O e-mail é longo demais.")
  .email("Informe um e-mail válido.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(12, "A senha precisa ter pelo menos 12 caracteres.")
  .max(128, "A senha é longa demais.");

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome com pelo menos 2 caracteres.")
  .max(80, "O nome pode ter no máximo 80 caracteres.");

const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome da organização com pelo menos 2 caracteres.")
  .max(120, "O nome da organização pode ter no máximo 120 caracteres.");

export const onboardingPersonaSchema = z.enum([
  "client_pf",
  "client_pj",
  "lawyer",
  "law_firm",
  "corporate_legal",
  "partner_legal",
  "partner_service",
]);

export type OnboardingPersona = z.infer<typeof onboardingPersonaSchema>;

export const ONBOARDING_PERSONA_META: Record<
  OnboardingPersona,
  { label: string; description: string; redirectTo: "/portal" | "/app"; needsOrg: boolean }
> = {
  client_pf: {
    label: "Cliente — pessoa física",
    description: "Busco serviços jurídicos e quero acompanhar minhas demandas.",
    redirectTo: "/portal",
    needsOrg: true,
  },
  client_pj: {
    label: "Cliente — pessoa jurídica",
    description: "Represento uma empresa que precisa de serviços jurídicos.",
    redirectTo: "/app",
    needsOrg: true,
  },
  lawyer: {
    label: "Advogado autônomo",
    description: "Atuo como advogado e quero organizar minha prática profissional.",
    redirectTo: "/app",
    needsOrg: true,
  },
  law_firm: {
    label: "Sociedade / escritório",
    description: "Represento um escritório ou sociedade de advogados.",
    redirectTo: "/app",
    needsOrg: true,
  },
  corporate_legal: {
    label: "Departamento jurídico",
    description: "Represento o departamento jurídico de uma empresa.",
    redirectTo: "/app",
    needsOrg: true,
  },
  partner_legal: {
    label: "Parceiro jurídico",
    description: "Presto serviços jurídicos como correspondente ou especialista.",
    redirectTo: "/app",
    needsOrg: true,
  },
  partner_service: {
    label: "Prestador de serviços",
    description: "Ofereço serviços de apoio não advocatícios à operação jurídica.",
    redirectTo: "/app",
    needsOrg: true,
  },
};

const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Informe o nome completo.")
  .max(120, "O nome é longo demais.")
  .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, {
    message: "Informe nome e sobrenome.",
  });

const cpfSchema = z
  .string()
  .trim()
  .min(1, "Informe o CPF.")
  .refine((value) => isValidCpf(value), { message: "Informe um CPF válido." })
  .transform((value) => digitsOnly(value));

const cnpjSchema = z
  .string()
  .trim()
  .min(1, "Informe o CNPJ.")
  .refine((value) => isValidCnpj(value), { message: "Informe um CNPJ válido." })
  .transform((value) => digitsOnly(value));

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Informe o telefone.")
  .transform((value, ctx) => {
    const e164 = toE164BrMobile(value);
    if (!e164) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um telefone celular válido." });
      return z.NEVER;
    }
    return e164;
  });

const birthDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    if (date > now) return false;
    const ageMs = now.getTime() - date.getTime();
    const years = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    return years >= 16 && years <= 120;
  }, "Informe uma data de nascimento válida.");

const cepSchema = z
  .string()
  .trim()
  .refine((value) => isValidCep(value), { message: "Informe um CEP válido." })
  .transform((value) => digitsOnly(value));

const addressSchema = z.object({
  postalCode: cepSchema,
  street: z.string().trim().min(2, "Informe o logradouro.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(80).optional().or(z.literal("")),
  district: z.string().trim().min(2, "Informe o bairro.").max(80),
  city: z.string().trim().min(2, "Informe a cidade.").max(80),
  state: z
    .string()
    .trim()
    .length(2, "Informe a UF com 2 letras.")
    .transform((value) => value.toUpperCase()),
  country: z.string().trim().min(2).max(56).default("Brasil"),
});

const passwordPairSchema = z
  .object({
    password: passwordSchema.refine((value) => !isCommonPassword(value), {
      message: "Escolha uma senha menos comum.",
    }),
    passwordConfirm: z.string().min(1, "Confirme a senha."),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirm"],
        message: "As senhas não coincidem.",
      });
    }
  });

const termsSchema = z.object({
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Aceite os Termos de Uso para continuar." }),
  }),
  acceptPrivacy: z.literal(true, {
    errorMap: () => ({ message: "Aceite a Política de Privacidade para continuar." }),
  }),
  acceptMarketing: z.boolean().optional().default(false),
  representationDeclaration: z.boolean().optional(),
  termsVersion: z.string().trim().min(1).max(32).default("2026-11"),
  privacyVersion: z.string().trim().min(1).max(32).default("2026-11"),
});

const basePerson = z.object({
  fullName: fullNameSchema,
  socialName: z.string().trim().max(120).optional().or(z.literal("")),
  cpf: cpfSchema,
  birthDate: birthDateSchema,
  email: emailSchema,
  phone: phoneSchema,
  address: addressSchema,
});

export const onboardingRegisterSchema = z
  .object({
    persona: onboardingPersonaSchema,
    displayName: displayNameSchema.optional(),
    fullName: fullNameSchema,
    socialName: z.string().trim().max(120).optional().or(z.literal("")),
    cpf: cpfSchema.optional(),
    birthDate: birthDateSchema.optional(),
    email: emailSchema,
    phone: phoneSchema,
    address: addressSchema,
    organizationName: organizationNameSchema.optional(),
    tradeName: z.string().trim().max(120).optional().or(z.literal("")),
    cnpj: cnpjSchema.optional(),
    jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
    oabNumber: z.string().trim().max(20).optional().or(z.literal("")),
    oabUf: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .optional()
      .or(z.literal("")),
    practiceAreas: z.string().trim().max(400).optional().or(z.literal("")),
    partnerCategory: z
      .enum([
        "correspondent",
        "accountant",
        "expert",
        "translator",
        "dispatcher",
        "teacher",
        "specialist",
        "supplier",
        "other",
      ])
      .optional(),
    partnerDescription: z.string().trim().max(600).optional().or(z.literal("")),
    password: passwordSchema.refine((value) => !isCommonPassword(value), {
      message: "Escolha uma senha menos comum.",
    }),
    passwordConfirm: z.string().min(1, "Confirme a senha."),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "Aceite os Termos de Uso para continuar." }),
    }),
    acceptPrivacy: z.literal(true, {
      errorMap: () => ({ message: "Aceite a Política de Privacidade para continuar." }),
    }),
    acceptMarketing: z.boolean().optional().default(false),
    representationDeclaration: z.boolean().optional(),
    termsVersion: z.string().trim().min(1).max(32).default("2026-11"),
    privacyVersion: z.string().trim().min(1).max(32).default("2026-11"),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordConfirm"],
        message: "As senhas não coincidem.",
      });
    }

    const needsCpf = [
      "client_pf",
      "lawyer",
      "partner_legal",
      "partner_service",
      "client_pj",
      "law_firm",
      "corporate_legal",
    ].includes(value.persona);
    if (needsCpf && !value.cpf) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cpf"], message: "Informe o CPF." });
    }

    if (value.persona === "client_pf" || value.persona === "lawyer") {
      if (!value.birthDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["birthDate"],
          message: "Informe a data de nascimento.",
        });
      }
    }

    if (
      value.persona === "client_pj" ||
      value.persona === "law_firm" ||
      value.persona === "corporate_legal"
    ) {
      if (!value.organizationName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organizationName"],
          message: "Informe a razão social ou nome da organização.",
        });
      }
      if (!value.cnpj) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cnpj"], message: "Informe o CNPJ." });
      }
      if (!value.representationDeclaration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["representationDeclaration"],
          message: "Declare que possui poderes de representação.",
        });
      }
    }

    if (value.persona === "lawyer" || value.persona === "law_firm") {
      if (!value.oabNumber || !value.oabUf) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["oabNumber"],
          message: "Informe o número e a seccional da OAB.",
        });
      }
    }

    if (value.persona === "partner_legal" || value.persona === "partner_service") {
      if (!value.partnerCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["partnerCategory"],
          message: "Informe a categoria de atuação.",
        });
      }
    }
  })
  .transform((value) => ({
    ...value,
    displayName: value.displayName?.trim() || value.fullName.trim(),
    socialName: value.socialName?.trim() || undefined,
    tradeName: value.tradeName?.trim() || undefined,
    jobTitle: value.jobTitle?.trim() || undefined,
    oabNumber: value.oabNumber?.trim() || undefined,
    oabUf: value.oabUf?.trim() || undefined,
    practiceAreas: value.practiceAreas?.trim() || undefined,
    partnerDescription: value.partnerDescription?.trim() || undefined,
    address: {
      ...value.address,
      complement: value.address.complement?.trim() || undefined,
    },
  }));

export type OnboardingRegisterInput = z.infer<typeof onboardingRegisterSchema>;

/** Mantém compatibilidade com o schema legado de 3 campos. */
export { basePerson, passwordPairSchema, termsSchema, addressSchema };
