import type { AIGateway } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { assistantConversations, assistantFeedback, assistantMessages } from "@verasjuris/database";
import type { MemoryRateLimiter } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import type { RequestMeta } from "../auth/service.js";
import {
  createJurisWorkTask,
  getJurisWorkTask,
  listJurisWorkTasks,
} from "../juris-work/service.js";
import {
  gatherVerifiedOrgContext,
  listOrgCrmClients,
  listOrgDeadlines,
  listOrgDocuments,
  listOrgMatters,
  listOrgTasks,
} from "./org-tools.js";
import {
  assertNoCriticalAutonomousAction,
  assertToolAllowed,
  FAQ_FALLBACK,
  resolveNavigation,
  systemPromptForLocale,
  type AssistantToolName,
} from "./tool-registry.js";

const JURIS_ONE_CHAT_FEATURE = "juris_one.chat";
const LEGACY_CHAT_FEATURE = "education.question_answering";

export type AssistantServiceDeps = {
  rateLimiter?: MemoryRateLimiter;
};

const ALL_TOOLS: AssistantToolName[] = [
  "searchHelp",
  "navigateTo",
  "createSupportRequest",
  "listMatters",
  "listDeadlines",
  "listDocuments",
  "listTasks",
  "listCrmClients",
  "createWorkTask",
  "getWorkTask",
  "prepareCommunicationDraft",
];

export class AssistantService {
  constructor(
    private readonly db: AppDatabase,
    private readonly aiGateway?: AIGateway | null,
    private readonly deps: AssistantServiceDeps = {},
  ) {}

  async createConversation(
    account: SessionAccount,
    input: { title?: string; locale?: string; organizationId?: string },
  ) {
    if (input.organizationId) {
      requireOrganizationPermission(account, input.organizationId, "assistant.use");
    }
    const locale = input.locale ?? account.user.locale ?? "pt-BR";
    const [row] = await this.db
      .insert(assistantConversations)
      .values({
        userId: account.user.id,
        organizationId: input.organizationId ?? null,
        title: input.title ?? null,
        locale,
        status: "active",
        metadata: { favorite: false },
      })
      .returning();
    await this.db.insert(assistantMessages).values({
      conversationId: row!.id,
      role: "system",
      content: systemPromptForLocale(locale),
      providerKey: "system",
    });
    return { conversation: row };
  }

  async listConversations(account: SessionAccount, organizationId?: string) {
    const items = await this.db.query.assistantConversations.findMany({
      where: organizationId
        ? and(
            eq(assistantConversations.userId, account.user.id),
            eq(assistantConversations.organizationId, organizationId),
          )
        : eq(assistantConversations.userId, account.user.id),
      orderBy: [desc(assistantConversations.updatedAt)],
      limit: 50,
    });
    return {
      items: items.filter((c) => c.status !== "deleted"),
    };
  }

  async getMessages(account: SessionAccount, conversationId: string) {
    await this.requireOwnedConversation(account, conversationId);
    const messages = await this.db.query.assistantMessages.findMany({
      where: eq(assistantMessages.conversationId, conversationId),
      orderBy: [asc(assistantMessages.createdAt)],
      limit: 500,
    });
    return { items: messages };
  }

  async renameConversation(account: SessionAccount, conversationId: string, title: string) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    const [updated] = await this.db
      .update(assistantConversations)
      .set({ title: title.trim().slice(0, 200), updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id))
      .returning();
    return { conversation: updated };
  }

  async archiveConversation(account: SessionAccount, conversationId: string) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    const [updated] = await this.db
      .update(assistantConversations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id))
      .returning();
    return { conversation: updated };
  }

  async favoriteConversation(account: SessionAccount, conversationId: string, favorite: boolean) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    const metadata = {
      ...(conversation.metadata ?? {}),
      favorite,
    };
    const [updated] = await this.db
      .update(assistantConversations)
      .set({ metadata, updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id))
      .returning();
    return { conversation: updated };
  }

  async updateConversation(
    account: SessionAccount,
    conversationId: string,
    input: { title?: string; status?: "active" | "archived"; favorite?: boolean },
  ) {
    let conversation = (await this.requireOwnedConversation(account, conversationId)) as
      | typeof assistantConversations.$inferSelect
      | undefined;

    if (input.title !== undefined) {
      conversation = (await this.renameConversation(account, conversationId, input.title))
        .conversation!;
    }
    if (input.status === "archived") {
      conversation = (await this.archiveConversation(account, conversationId)).conversation!;
    } else if (input.status === "active") {
      const [updated] = await this.db
        .update(assistantConversations)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(assistantConversations.id, conversationId))
        .returning();
      conversation = updated!;
    }
    if (input.favorite !== undefined) {
      conversation = (await this.favoriteConversation(account, conversationId, input.favorite))
        .conversation!;
    }
    return { conversation };
  }

  async deleteConversation(account: SessionAccount, conversationId: string) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    const [updated] = await this.db
      .update(assistantConversations)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id))
      .returning();
    return { conversation: updated };
  }

  async sendMessage(
    account: SessionAccount,
    input: {
      sessionId: string;
      content: string;
      requestCriticalAction?: boolean;
      criticalActionKey?: string;
    },
  ) {
    this.consumeRateLimit(account, input.sessionId);

    const conversation = await this.requireOwnedConversation(account, input.sessionId);
    assertNoCriticalAutonomousAction(input.content, Boolean(input.requestCriticalAction));

    await this.db.insert(assistantMessages).values({
      conversationId: conversation.id,
      role: "user",
      content: input.content,
      providerKey: "user",
    });

    const locale = conversation.locale || "pt-BR";
    if (!conversation.organizationId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Conversa sem organização. Crie a conversa no contexto da organização ativa.",
      );
    }
    if (!this.aiGateway) {
      throw new AppError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "O serviço de inteligência artificial está temporariamente indisponível.",
      );
    }

    const health = await this.aiGateway.healthCheck();
    const description = this.aiGateway.describe();
    if (description.status === "not_configured" || health.status === "not_configured") {
      throw new AppError(
        "AI_PROVIDER_NOT_CONFIGURED",
        "O serviço de inteligência artificial está temporariamente indisponível.",
      );
    }
    if (health.status === "unavailable") {
      throw new AppError(
        "AI_PROVIDER_UNAVAILABLE",
        "O provedor de inteligência artificial está indisponível no momento.",
      );
    }

    const recent = await this.db.query.assistantMessages.findMany({
      where: eq(assistantMessages.conversationId, conversation.id),
      orderBy: [desc(assistantMessages.createdAt)],
      limit: 12,
    });
    const chronological = [...recent].reverse();
    const contextLines = chronological
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => `${m.role}: ${m.content.slice(0, 1_500)}`);

    const faqHint = this.faqReply(locale, input.content);
    const verified = await gatherVerifiedOrgContext(
      this.db,
      account,
      conversation.organizationId,
      input.content,
    );

    const modelInput = [
      contextLines.length > 0 ? contextLines.join("\n") : "",
      verified || null,
      faqHint
        ? `FAQ COMPLEMENTAR (fonte institucional; use só se pertinente, não como se fosse geração livre): ${faqHint}`
        : null,
      `user: ${input.content}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const result = await this.generateChatText(
      account,
      conversation.organizationId,
      locale,
      modelInput,
    );
    const providerKey = result.provider || "ai";

    const [assistantMsg] = await this.db
      .insert(assistantMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: result.data,
        providerKey,
        metadata: {
          model: result.model,
          feature: result.feature,
          faqComplementary: Boolean(faqHint),
          verifiedOrgContext: Boolean(verified),
          streaming: false,
          streamingStatus: "not_compatible_openai_provider",
        },
      })
      .returning();

    await this.db
      .update(assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id));

    return {
      message: assistantMsg,
      providerKey,
      model: result.model,
      faqHint,
      processing: { streamed: false, reason: "OpenAIProvider sem streamText homologado" },
      tools: ALL_TOOLS,
    };
  }

  async invokeTool(
    account: SessionAccount,
    conversationId: string,
    tool: AssistantToolName,
    params: Record<string, unknown> = {},
    meta: RequestMeta = { requestId: "assistant-tool", ip: null, userAgent: null },
  ) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    assertToolAllowed(account, conversation.organizationId, tool);
    const organizationId = conversation.organizationId;
    if (!organizationId && tool !== "searchHelp" && tool !== "navigateTo") {
      throw new AppError("AUTHORIZATION_ERROR", "Ferramenta requer organização ativa.");
    }

    let result: unknown;
    switch (tool) {
      case "createSupportRequest": {
        const ticket = {
          id: cryptoRandom(),
          subject: String(params.subject ?? "Suporte assistente"),
          status: "open",
          organizationId,
          note: "Solicitação registrada na conversa. Não abre ticket externo homologado.",
        };
        result = ticket;
        break;
      }
      case "searchHelp":
        result = {
          faq: this.faqReply(conversation.locale, String(params.q ?? "")),
          complementaryOnly: true,
        };
        break;
      case "navigateTo":
        result = resolveNavigation(String(params.path ?? params.q ?? "/app"));
        break;
      case "listMatters":
        result = await listOrgMatters(this.db, account, organizationId!);
        break;
      case "listDeadlines":
        result = await listOrgDeadlines(this.db, account, organizationId!);
        break;
      case "listDocuments":
        result = await listOrgDocuments(this.db, account, organizationId!);
        break;
      case "listTasks":
        result = await listOrgTasks(this.db, account, organizationId!);
        break;
      case "listCrmClients":
        result = await listOrgCrmClients(this.db, account, organizationId!);
        break;
      case "createWorkTask": {
        const title = String(params.title ?? "Tarefa Work pelo Assistente").slice(0, 180);
        const objective = String(params.objective ?? params.description ?? "").trim();
        if (objective.length < 10) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Informe um objetivo com pelo menos 10 caracteres para criar a tarefa Work.",
          );
        }
        result = await createJurisWorkTask(
          this.db,
          account,
          organizationId!,
          { title, objective },
          meta,
          { gateway: this.aiGateway },
        );
        break;
      }
      case "getWorkTask": {
        const taskId = String(params.taskId ?? "");
        if (!taskId) {
          result = await listJurisWorkTasks(this.db, account, organizationId!);
        } else {
          result = await getJurisWorkTask(this.db, account, organizationId!, taskId);
        }
        break;
      }
      case "prepareCommunicationDraft": {
        result = {
          status: "draft_only",
          subject: String(params.subject ?? "Comunicação interna").slice(0, 180),
          body: String(params.body ?? "").slice(0, 4000),
          sendStatus: "NOT_CONFIGURED",
          note: "Rascunho preparado. Envio via Resend permanece bloqueado até aprovação humana e homologação do fluxo de comunicação externa.",
        };
        break;
      }
      default:
        throw new AppError("VALIDATION_ERROR", "Ferramenta do assistente desconhecida.");
    }

    await this.db.insert(assistantMessages).values({
      conversationId,
      role: "tool",
      content: JSON.stringify({ tool, result }),
      providerKey: "tool",
    });
    return { result };
  }

  async feedback(
    account: SessionAccount,
    input: {
      conversationId?: string;
      messageId?: string;
      rating: "positive" | "negative" | "neutral";
      comment?: string;
    },
  ) {
    const [row] = await this.db
      .insert(assistantFeedback)
      .values({
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        userId: account.user.id,
        rating: input.rating,
        comment: input.comment ?? null,
      })
      .returning();
    return { feedback: row };
  }

  private async generateChatText(
    account: SessionAccount,
    organizationId: string,
    locale: string,
    content: string,
  ) {
    const gateway = this.aiGateway!;
    const base = {
      userId: account.user.id,
      organizationId,
      promptVersion: "assistant-v2" as const,
      instructions: systemPromptForLocale(locale),
      input: content,
    };
    try {
      return await gateway.generateText({ ...base, feature: JURIS_ONE_CHAT_FEATURE });
    } catch (error) {
      if (error instanceof AppError && error.code === "VALIDATION_ERROR") {
        return gateway.generateText({ ...base, feature: LEGACY_CHAT_FEATURE });
      }
      throw error;
    }
  }

  private consumeRateLimit(account: SessionAccount, conversationId: string) {
    if (!this.deps.rateLimiter) return;
    const result = this.deps.rateLimiter.consume(
      `assistant:chat:${account.user.id}:${conversationId}`,
      30,
      60_000,
    );
    if (!result.allowed) {
      throw new AppError(
        "RATE_LIMIT",
        `Muitas mensagens no chat. Aguarde ${result.retryAfterSeconds}s e tente novamente.`,
      );
    }
  }

  private faqReply(locale: string, content: string): string {
    const lang = locale.toLowerCase().startsWith("en") ? "en" : "pt-BR";
    const faqs = FAQ_FALLBACK[lang] ?? FAQ_FALLBACK["pt-BR"]!;
    const hit = faqs.find((f) =>
      content
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.length > 3 && f.toLowerCase().includes(w)),
    );
    return hit ?? faqs[0]!;
  }

  private async requireOwnedConversation(account: SessionAccount, id: string) {
    const row = await this.db.query.assistantConversations.findFirst({
      where: and(
        eq(assistantConversations.id, id),
        eq(assistantConversations.userId, account.user.id),
      ),
    });
    if (!row || row.status === "deleted") {
      throw new AppError("NOT_FOUND", "Conversa do assistente não encontrada.");
    }
    if (row.organizationId) {
      const membership = account.memberships.find((m) => m.organizationId === row.organizationId);
      if (!membership) {
        throw new AppError("AUTHORIZATION_ERROR", "Conversa pertence a outra organização.");
      }
    }
    return row;
  }
}

function cryptoRandom(): string {
  return `sup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
