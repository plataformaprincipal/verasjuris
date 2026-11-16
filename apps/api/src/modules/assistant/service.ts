import type { AIGateway } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { assistantConversations, assistantFeedback, assistantMessages } from "@verasjuris/database";
import type { MemoryRateLimiter } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import {
  assertNoCriticalAutonomousAction,
  assertToolAllowed,
  FAQ_FALLBACK,
  systemPromptForLocale,
  type AssistantToolName,
} from "./tool-registry.js";

const JURIS_ONE_CHAT_FEATURE = "juris_one.chat";
const LEGACY_CHAT_FEATURE = "education.question_answering";

export type AssistantServiceDeps = {
  rateLimiter?: MemoryRateLimiter;
};

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

  async favoriteConversation(
    account: SessionAccount,
    conversationId: string,
    favorite: boolean,
  ) {
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
      conversation = (
        await this.favoriteConversation(account, conversationId, input.favorite)
      ).conversation!;
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
    let replyText: string;
    let providerKey = "faq_fallback";

    if (this.aiGateway) {
      try {
        const health = await this.aiGateway.healthCheck();
        if (health.status === "not_configured") {
          replyText = this.notConfiguredReply(locale, input.content);
          providerKey = "faq_fallback";
        } else if (conversation.organizationId) {
          const result = await this.generateChatText(
            account,
            conversation.organizationId,
            locale,
            input.content,
          );
          replyText = result.data;
          providerKey = result.provider || "ai";
        } else {
          replyText = this.faqReply(locale, input.content);
          providerKey = "faq_fallback";
        }
      } catch {
        replyText = this.faqReply(locale, input.content);
        providerKey = "faq_fallback";
      }
    } else {
      replyText = this.notConfiguredReply(locale, input.content);
    }

    const [assistantMsg] = await this.db
      .insert(assistantMessages)
      .values({
        conversationId: conversation.id,
        role: "assistant",
        content: replyText,
        providerKey,
      })
      .returning();

    await this.db
      .update(assistantConversations)
      .set({ updatedAt: new Date() })
      .where(eq(assistantConversations.id, conversation.id));

    return {
      message: assistantMsg,
      providerKey,
      tools: [
        "searchHelp",
        "navigateTo",
        "createSupportRequest",
        "listMatters",
        "listDeadlines",
        "listDocuments",
      ],
    };
  }

  async invokeTool(
    account: SessionAccount,
    conversationId: string,
    tool: AssistantToolName,
    params: Record<string, unknown> = {},
  ) {
    const conversation = await this.requireOwnedConversation(account, conversationId);
    assertToolAllowed(account, conversation.organizationId, tool);
    if (tool === "createSupportRequest") {
      const ticket = {
        id: cryptoRandom(),
        subject: String(params.subject ?? "Suporte assistente"),
        status: "open",
        organizationId: conversation.organizationId,
      };
      await this.db.insert(assistantMessages).values({
        conversationId,
        role: "tool",
        content: JSON.stringify({ tool, ticket }),
        providerKey: "tool",
      });
      return { result: ticket };
    }
    if (tool === "searchHelp") {
      return { result: this.faqReply(conversation.locale, String(params.q ?? "")) };
    }
    if (tool === "navigateTo") {
      return { result: { path: String(params.path ?? "/app"), allowed: true } };
    }
    return {
      result: { tool, items: [], note: "Lista filtrada por permissão; dados via domínio fonte." },
    };
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

  /** Prefere juris_one.chat; se o gateway customizado não permitir, usa o feature legado. */
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
      promptVersion: "assistant-v1" as const,
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

  private notConfiguredReply(locale: string, content: string): string {
    const lang = locale.toLowerCase().startsWith("en") ? "en" : "pt-BR";
    const honesty =
      lang === "en"
        ? "The AI provider is not configured (FEATURE_AI=0 / AI_PROVIDER=not_configured). Falling back to FAQ."
        : "O provedor de IA não está configurado (FEATURE_AI=0 / AI_PROVIDER=not_configured). Resposta via FAQ.";
    return `${honesty}\n\n${this.faqReply(locale, content)}`;
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
