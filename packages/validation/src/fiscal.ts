import { z } from "zod";

export const FISCAL_DOCUMENT_KINDS = ["nfse", "nfe", "other"] as const;

export const requestFiscalDocumentSchema = z.object({
  kind: z.enum(FISCAL_DOCUMENT_KINDS).default("nfse"),
  invoiceId: z.string().uuid().optional(),
  amountCents: z.coerce.number().int().positive().max(100_000_000_000),
  currency: z.string().trim().length(3).default("BRL"),
  description: z.string().trim().max(500).optional(),
  customerTaxId: z.string().trim().max(20).optional(),
  customerName: z.string().trim().max(200).optional(),
  serviceCode: z.string().trim().max(40).optional(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const fiscalDocumentListQuerySchema = z.object({
  status: z.string().trim().max(40).optional(),
  kind: z.enum(FISCAL_DOCUMENT_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type RequestFiscalDocumentInput = z.infer<typeof requestFiscalDocumentSchema>;
