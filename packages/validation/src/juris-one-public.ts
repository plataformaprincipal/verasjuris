import { z } from "zod";

export const jurisOnePublicChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Informe uma mensagem.")
    .max(2_000, "A mensagem pode ter no máximo 2.000 caracteres."),
  locale: z.enum(["pt-BR", "en-US", "es-ES"]).optional(),
  /** Identificador opaco do visitante (cliente); o servidor aplica rate limit por IP + visitor. */
  visitorId: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, "Identificador de visitante inválido.")
    .optional(),
  /** Contexto curto das últimas mensagens (máx. 6). */
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2_000),
      }),
    )
    .max(6)
    .optional(),
});

export type JurisOnePublicChatInput = z.infer<typeof jurisOnePublicChatSchema>;
