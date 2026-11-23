import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.");

const optionalUuid = z.string().uuid("O identificador não é válido.").optional();

export const UF_CODES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const createCourtMonitorSchema = z.object({
  lawyerName: z.string().trim().min(2, "Informe o nome do advogado.").max(200),
  oabNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length >= 1 && v.length <= 8, "Número de OAB inválido."),
  oabUf: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => (UF_CODES as readonly string[]).includes(v), "UF da OAB inválida."),
  membershipId: optionalUuid,
});

export const updateCourtMonitorSchema = z
  .object({
    active: z.boolean().optional(),
    lawyerName: z.string().trim().min(2).max(200).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Informe ao menos um campo." });

export const runCourtMonitorSchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "A data inicial deve ser anterior à final.",
  });

export const courtCommunicationListQuerySchema = z.object({
  status: z.enum(["new", "linked", "triaged", "dismissed"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  q: z.string().trim().max(200).optional(),
  monitorId: optionalUuid,
  judicialProcessId: optionalUuid,
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const linkCourtCommunicationSchema = z.object({
  judicialProcessId: z.string().uuid("O identificador não é válido.").nullable(),
});

export const dismissCourtCommunicationSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Explique por que a comunicação não exige providência.")
    .max(1000),
});

export const triageCourtCommunicationSchema = z
  .object({
    createDeadline: z.boolean(),
    deadlineTitle: z.string().trim().max(300).optional(),
    ruleDays: z.number().int().min(1).max(365).optional(),
    createTask: z.boolean(),
    taskTitle: z.string().trim().max(300).optional(),
    responsibleMembershipId: optionalUuid,
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  })
  .refine((v) => v.createDeadline || v.createTask, {
    message: "Crie ao menos um prazo ou uma tarefa, ou descarte a comunicação.",
  });

export type CreateCourtMonitorInput = z.infer<typeof createCourtMonitorSchema>;
export type TriageCourtCommunicationInput = z.infer<typeof triageCourtCommunicationSchema>;
