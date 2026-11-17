"use client";

import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@verasjuris/ui";
import {
  BrainCircuit,
  BriefcaseBusiness,
  Copy,
  FileText,
  LoaderCircle,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  fetchAiStatus,
  isApiFailure,
  type AiStatus,
} from "../lib/ai";
import {
  createConversation,
  deleteConversation,
  ensureInitialWorkCredits,
  getMessages,
  getWorkCredits,
  jurisOneApiErrorMessage,
  listConversations,
  listWorkTasks,
  sendFeedback,
  sendMessage,
  updateConversation,
  type JurisConversation,
  type JurisMessage,
  type JurisWorkCredits,
} from "../lib/juris-one-api";
import { JURIS_WORK_STATUS } from "../lib/juris-one";
import { useOrgContext } from "../lib/use-org-context";

const PREFS_KEY = "vj.juris-one.app.prefs";

type LocalPrefs = {
  displayName: string;
  tone: "formal" | "neutro" | "direto";
  detail: "resumo" | "equilibrado" | "detalhado";
};

const DEFAULT_PREFS: LocalPrefs = {
  displayName: "",
  tone: "neutro",
  detail: "equilibrado",
};

function readPrefs(): LocalPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<LocalPrefs>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName.slice(0, 80) : "",
      tone:
        parsed.tone === "formal" || parsed.tone === "direto" || parsed.tone === "neutro"
          ? parsed.tone
          : "neutro",
      detail:
        parsed.detail === "resumo" || parsed.detail === "detalhado" || parsed.detail === "equilibrado"
          ? parsed.detail
          : "equilibrado",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: LocalPrefs) {
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

function softInstruction(prefs: LocalPrefs): string | null {
  const bits: string[] = [];
  if (prefs.displayName.trim()) bits.push(`Trate o usuário como "${prefs.displayName.trim()}".`);
  if (prefs.tone === "formal") bits.push("Prefira tom formal.");
  if (prefs.tone === "direto") bits.push("Prefira respostas diretas.");
  if (prefs.detail === "resumo") bits.push("Seja conciso.");
  if (prefs.detail === "detalhado") bits.push("Inclua um pouco mais de contexto quando útil.");
  if (bits.length === 0) return null;
  return `[Preferência local de apresentação — não altera segurança nem permissões] ${bits.join(" ")}`;
}

function isFavorite(conversation: JurisConversation): boolean {
  return Boolean(conversation.metadata && conversation.metadata.favorite === true);
}

function conversationTitle(conversation: JurisConversation): string {
  const title = conversation.title?.trim();
  if (title) return title;
  return `Conversa ${conversation.id.slice(0, 8)}`;
}

function aiStatusLabel(status: AiStatus | null): { label: string; tone: "neutral" | "warning" | "success" } {
  if (!status) return { label: "IA · status desconhecido", tone: "neutral" };
  const state = status.provider.state ?? (status.provider.configured ? "configured" : "not_configured");
  if (state === "not_configured" || !status.provider.configured) {
    return { label: "IA · não configurada", tone: "warning" };
  }
  if (state === "degraded" || state === "unavailable") {
    return { label: `IA · ${state}`, tone: "warning" };
  }
  return { label: "IA · ok", tone: "success" };
}

function visibleMessages(items: JurisMessage[]): JurisMessage[] {
  return items.filter((item) => item.role === "user" || item.role === "assistant");
}

export function JurisOneApp() {
  const org = useOrgContext();
  const inputId = useId();
  const prefsNameId = useId();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<JurisConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<JurisMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [credits, setCredits] = useState<JurisWorkCredits | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [pendingWorkCount, setPendingWorkCount] = useState(0);
  const [prefs, setPrefs] = useState<LocalPrefs>(DEFAULT_PREFS);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastProviderKey, setLastProviderKey] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(readPrefs());
  }, []);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, pending]);

  async function bootstrap(orgId: string) {
    setLoading(true);
    setError(null);

    const ensured = await ensureInitialWorkCredits(orgId);
    if (isApiFailure(ensured)) {
      setError(jurisOneApiErrorMessage(ensured, "Não foi possível preparar créditos Work."));
    } else {
      setCredits(ensured.credits);
    }

    const [convRes, creditsRes, aiRes, tasksRes] = await Promise.all([
      listConversations(orgId),
      getWorkCredits(orgId),
      fetchAiStatus(orgId),
      listWorkTasks(orgId),
    ]);

    if (isApiFailure(convRes)) {
      setError(jurisOneApiErrorMessage(convRes, "Não foi possível carregar conversas."));
      setConversations([]);
    } else {
      setConversations(convRes.items);
      if (!activeId && convRes.items[0]) {
        setActiveId(convRes.items[0].id);
      }
    }

    if (!isApiFailure(creditsRes)) setCredits(creditsRes.credits);
    if (!isApiFailure(aiRes)) setAiStatus(aiRes);
    if (!isApiFailure(tasksRes)) {
      setPendingWorkCount(
        tasksRes.items.filter((task) =>
          ["awaiting_approval", "running", "planned", "draft"].includes(task.status),
        ).length,
      );
      if (tasksRes.credits) setCredits(tasksRes.credits);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId) {
      setLoading(false);
      setError("Selecione uma organização ativa para usar o Juris One autenticado.");
      return;
    }
    void bootstrap(org.orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/org change only
  }, [org.ready, org.orgId]);

  useEffect(() => {
    if (!org.orgId || !activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getMessages(org.orgId!, activeId);
      if (cancelled) return;
      if (isApiFailure(res)) {
        setError(jurisOneApiErrorMessage(res, "Não foi possível carregar mensagens."));
        setMessages([]);
        return;
      }
      setMessages(visibleMessages(res.items));
    })();
    return () => {
      cancelled = true;
    };
  }, [org.orgId, activeId]);

  async function refreshConversations(orgId: string) {
    const res = await listConversations(orgId);
    if (!isApiFailure(res)) setConversations(res.items);
  }

  async function handleNewConversation() {
    if (!org.orgId || pending) return;
    setPending(true);
    setError(null);
    const res = await createConversation(org.orgId, {
      title: "Nova conversa",
      locale: "pt-BR",
    });
    setPending(false);
    if (isApiFailure(res)) {
      setError(jurisOneApiErrorMessage(res, "Não foi possível criar a conversa."));
      return;
    }
    setConversations((prev) => [res.conversation, ...prev]);
    setActiveId(res.conversation.id);
    setMessages([]);
    setLastProviderKey(null);
  }

  async function handleSend(textOverride?: string) {
    if (!org.orgId || pending) return;
    const raw = (textOverride ?? input).trim();
    if (!raw) return;

    let conversationId = activeId;
    if (!conversationId) {
      const created = await createConversation(org.orgId, {
        title: raw.slice(0, 60),
        locale: "pt-BR",
      });
      if (isApiFailure(created)) {
        setError(jurisOneApiErrorMessage(created, "Não foi possível criar a conversa."));
        return;
      }
      conversationId = created.conversation.id;
      setConversations((prev) => [created.conversation, ...prev]);
      setActiveId(conversationId);
    }

    const instruction = softInstruction(prefs);
    const content = instruction ? `${instruction}\n\n${raw}` : raw;

    setPending(true);
    setInput("");
    setError(null);
    const optimisticUser: JurisMessage = {
      id: `local-u-${Date.now()}`,
      role: "user",
      content: raw,
    };
    setMessages((prev) => [...prev, optimisticUser]);

    const res = await sendMessage(org.orgId, {
      sessionId: conversationId,
      content,
    });

    if (isApiFailure(res)) {
      setPending(false);
      setError(jurisOneApiErrorMessage(res, "Não foi possível enviar a mensagem."));
      setMessages((prev) => prev.filter((item) => item.id !== optimisticUser.id));
      return;
    }

    setLastProviderKey(res.providerKey ?? res.message.providerKey ?? null);
    const refreshed = await getMessages(org.orgId, conversationId);
    if (!isApiFailure(refreshed)) {
      setMessages(visibleMessages(refreshed.items));
    } else {
      setMessages((prev) => [
        ...prev.filter((item) => item.id !== optimisticUser.id),
        { ...optimisticUser, id: `u-${Date.now()}` },
        res.message,
      ]);
    }
    await refreshConversations(org.orgId);
    setPending(false);
  }

  async function handleRegenerate() {
    const lastUser = [...messages].reverse().find((item) => item.role === "user");
    if (!lastUser) return;
    await handleSend(lastUser.content);
  }

  async function handleToggleFavorite(conversation: JurisConversation) {
    if (!org.orgId) return;
    const next = !isFavorite(conversation);
    const res = await updateConversation(org.orgId, conversation.id, { favorite: next });
    if (isApiFailure(res)) {
      setError(jurisOneApiErrorMessage(res, "Não foi possível atualizar favorito."));
      return;
    }
    setConversations((prev) =>
      prev.map((item) => (item.id === conversation.id ? res.conversation : item)),
    );
  }

  async function handleDelete(conversationId: string) {
    if (!org.orgId) return;
    const res = await deleteConversation(org.orgId, conversationId);
    if (isApiFailure(res)) {
      setError(jurisOneApiErrorMessage(res, "Não foi possível excluir a conversa."));
      return;
    }
    setConversations((prev) => prev.filter((item) => item.id !== conversationId));
    if (activeId === conversationId) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function handleFeedback(rating: "positive" | "negative") {
    if (!org.orgId || !activeId) return;
    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
    const res = await sendFeedback(org.orgId, {
      conversationId: activeId,
      messageId: lastAssistant?.id,
      rating,
    });
    if (isApiFailure(res)) {
      setError(jurisOneApiErrorMessage(res, "Não foi possível registrar o feedback."));
    }
  }

  function savePrefs(next: LocalPrefs) {
    setPrefs(next);
    writePrefs(next);
  }

  async function copyLastAssistant() {
    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant");
    if (!lastAssistant || typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(lastAssistant.content);
  }

  const history = conversations.filter((item) => !isFavorite(item));
  const favorites = conversations.filter((item) => isFavorite(item));
  const statusPill = aiStatusLabel(aiStatus);
  const creditBalance = credits?.balance ?? null;

  if (!org.ready || loading) {
    return <LoadingState label="Carregando Juris One…" />;
  }

  if (!org.orgId) {
    return (
      <ErrorState title="Organização necessária">
        Selecione uma organização ativa para usar o hub autenticado do Juris One.
      </ErrorState>
    );
  }

  return (
    <div className="vj-juris-app-shell">
      {sidebarOpen ? (
        <aside className="vj-juris-app-sidebar" aria-label="Painel Juris One">
          <div className="vj-juris-app-sidebar-head">
            <strong className="vj-juris-app-brand">
              <BrainCircuit size={18} aria-hidden="true" /> Juris One
            </strong>
            <button
              type="button"
              className="vj-button vj-button-ghost"
              aria-label="Recolher painel"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeft size={18} aria-hidden="true" />
            </button>
          </div>

          <Button variant="secondary" disabled={pending} onClick={() => void handleNewConversation()}>
            <Plus size={16} aria-hidden="true" /> Nova conversa
          </Button>

          <div className="vj-juris-app-nav">
            <span className="vj-meta" aria-current="page">
              <MessageSquare size={14} aria-hidden="true" /> Chat
            </span>
            <Link href="/app/juris-one/work" className="vj-juris-app-nav-link">
              <BriefcaseBusiness size={14} aria-hidden="true" /> Work
              {creditBalance != null ? (
                <span className="vj-juris-credit-badge" title="Créditos Work">
                  {creditBalance}
                </span>
              ) : null}
            </Link>
            <Link href="/ferramentas" className="vj-juris-app-nav-link">
              <Wrench size={14} aria-hidden="true" /> Ferramentas
            </Link>
            <Link href="/app/documentos" className="vj-juris-app-nav-link">
              <FileText size={14} aria-hidden="true" /> Arquivos
            </Link>
            <Link href="/app/configuracoes" className="vj-juris-app-nav-link">
              <Settings size={14} aria-hidden="true" /> Configurações
            </Link>
          </div>

          <div className="vj-stack vj-juris-app-section">
            <p className="vj-meta">
              <Star size={14} aria-hidden="true" /> Favoritas
            </p>
            {favorites.length === 0 ? (
              <p className="vj-hint">Nenhuma conversa favorita.</p>
            ) : (
              <ul className="vj-juris-history-list">
                {favorites.map((item) => (
                  <li key={item.id} className="vj-juris-history-row">
                    <button
                      type="button"
                      className={
                        activeId === item.id
                          ? "vj-juris-history-item is-active"
                          : "vj-juris-history-item"
                      }
                      onClick={() => setActiveId(item.id)}
                    >
                      {conversationTitle(item)}
                    </button>
                    <div className="vj-juris-history-actions">
                      <button
                        type="button"
                        className="vj-button vj-button-ghost"
                        aria-label="Remover dos favoritos"
                        onClick={() => void handleToggleFavorite(item)}
                      >
                        <Star size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="vj-stack vj-juris-app-section">
            <p className="vj-meta">Histórico</p>
            {history.length === 0 ? (
              <p className="vj-hint">Ainda não há conversas nesta organização.</p>
            ) : (
              <ul className="vj-juris-history-list">
                {history.map((item) => (
                  <li key={item.id} className="vj-juris-history-row">
                    <button
                      type="button"
                      className={
                        activeId === item.id
                          ? "vj-juris-history-item is-active"
                          : "vj-juris-history-item"
                      }
                      onClick={() => setActiveId(item.id)}
                    >
                      {conversationTitle(item)}
                    </button>
                    <div className="vj-juris-history-actions">
                      <button
                        type="button"
                        className="vj-button vj-button-ghost"
                        aria-label="Favoritar"
                        onClick={() => void handleToggleFavorite(item)}
                      >
                        <Star size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="vj-button vj-button-ghost"
                        aria-label="Excluir conversa"
                        onClick={() => void handleDelete(item.id)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="vj-juris-app-sidebar-foot">
            <Badge tone={statusPill.tone}>{statusPill.label}</Badge>
            <p className="vj-hint">Conversas ilimitadas, sujeitas à política de uso justo.</p>
          </div>
        </aside>
      ) : (
        <div className="vj-juris-app-sidebar-collapsed">
          <button
            type="button"
            className="vj-button vj-button-secondary"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft size={16} aria-hidden="true" /> Painel
          </button>
        </div>
      )}

      <section
        className={
          dragOver ? "vj-juris-chat vj-juris-app-chat is-dragover" : "vj-juris-chat vj-juris-app-chat"
        }
        aria-label="Conversa Juris One"
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
        }}
      >
        <div className="vj-juris-app-chat-head">
          <div className="vj-stack" style={{ gap: "0.35rem" }}>
            <p className="vj-meta">
              <Sparkles size={14} aria-hidden="true" /> Hub autenticado · FAQ/fallback quando a IA não
              está configurada
            </p>
            <p className="vj-hint" role="note">
              <ShieldCheck size={14} aria-hidden="true" /> IA pode errar. Não substitui advogado nem
              executa ações críticas sem confirmação humana.
            </p>
          </div>
          <div className="vj-inline-actions">
            <button
              type="button"
              className="vj-button vj-button-ghost"
              aria-pressed={prefsOpen}
              onClick={() => setPrefsOpen((value) => !value)}
            >
              Preferências
            </button>
            <button
              type="button"
              className="vj-button vj-button-ghost"
              aria-label={contextOpen ? "Ocultar contexto" : "Mostrar contexto"}
              onClick={() => setContextOpen((value) => !value)}
            >
              <PanelRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {prefsOpen ? (
          <div className="vj-card vj-stack vj-juris-prefs">
            <p className="vj-meta">Preferências locais (somente neste dispositivo)</p>
            <label className="vj-stack" htmlFor={prefsNameId}>
              Nome de exibição
              <input
                id={prefsNameId}
                className="vj-input"
                value={prefs.displayName}
                onChange={(event) =>
                  savePrefs({ ...prefs, displayName: event.target.value.slice(0, 80) })
                }
              />
            </label>
            <label className="vj-stack">
              Tom
              <select
                className="vj-input"
                value={prefs.tone}
                onChange={(event) =>
                  savePrefs({
                    ...prefs,
                    tone: event.target.value as LocalPrefs["tone"],
                  })
                }
              >
                <option value="neutro">Neutro</option>
                <option value="formal">Formal</option>
                <option value="direto">Direto</option>
              </select>
            </label>
            <label className="vj-stack">
              Detalhe
              <select
                className="vj-input"
                value={prefs.detail}
                onChange={(event) =>
                  savePrefs({
                    ...prefs,
                    detail: event.target.value as LocalPrefs["detail"],
                  })
                }
              >
                <option value="equilibrado">Equilibrado</option>
                <option value="resumo">Resumo</option>
                <option value="detalhado">Detalhado</option>
              </select>
            </label>
            <p className="vj-hint">
              Preferências locais não desativam segurança, permissões nem a política de uso justo.
            </p>
          </div>
        ) : null}

        {error ? (
          <Alert tone="error" title="Não foi possível concluir a ação">
            {error}
          </Alert>
        ) : null}

        <div className="vj-juris-messages vj-juris-app-messages" aria-live="polite">
          {messages.length === 0 && !pending ? (
            <div className="vj-juris-empty">
              <EmptyState title="Comece uma conversa">
                Pergunte sobre caminhos da plataforma, status de IA ou próximos passos no Work. Com
                provedor não configurado, as respostas usam FAQ e orientação honesta.
              </EmptyState>
            </div>
          ) : null}
          {messages.map((message) => (
            <div key={message.id} className="vj-juris-msg-block">
              <p
                className={
                  message.role === "user"
                    ? "vj-juris-bubble vj-juris-bubble-user"
                    : "vj-juris-bubble"
                }
              >
                {message.content}
              </p>
              {message.role === "assistant" && message.providerKey ? (
                <p className="vj-meta">Provedor: {message.providerKey}</p>
              ) : null}
            </div>
          ))}
          {pending ? (
            <p className="vj-meta vj-juris-processing" role="status">
              <LoaderCircle size={14} className="vj-spin" aria-hidden="true" /> Processando…
            </p>
          ) : null}
          {lastProviderKey === "faq_fallback" || lastProviderKey === "not_configured" ? (
            <p className="vj-hint">Última resposta via FAQ/fallback (provedor OpenAI não ativo).</p>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        <div className="vj-inline-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !messages.some((m) => m.role === "assistant")}
            onClick={() => void copyLastAssistant()}
          >
            <Copy size={16} aria-hidden="true" /> Copiar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !messages.some((m) => m.role === "user")}
            onClick={() => void handleRegenerate()}
          >
            <RefreshCw size={16} aria-hidden="true" /> Regenerar
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!activeId || pending}
            onClick={() => void handleFeedback("positive")}
          >
            <ThumbsUp size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!activeId || pending}
            onClick={() => void handleFeedback("negative")}
          >
            <ThumbsDown size={16} aria-hidden="true" />
          </Button>
        </div>

        <form
          className="vj-juris-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <div
            className={dragOver ? "vj-juris-dropzone is-active" : "vj-juris-dropzone"}
            aria-hidden="true"
          />
          <div className="vj-stack" style={{ gap: "0.35rem" }}>
            <label className="vj-visually-hidden" htmlFor={inputId}>
              Mensagem
            </label>
            <textarea
              id={inputId}
              className="vj-input"
              rows={3}
              value={input}
              disabled={pending}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escreva sua mensagem…"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
          </div>
          <Button type="submit" disabled={pending || !input.trim()}>
            <Send size={16} aria-hidden="true" /> Enviar
          </Button>
        </form>
      </section>

      {contextOpen ? (
        <aside className="vj-juris-context-panel" aria-label="Contexto Juris One">
          <h2 className="vj-subtitle">Contexto</h2>
          <div className="vj-stack">
            <p className="vj-meta">Créditos Work</p>
            <p>
              <span className="vj-juris-credit-badge is-large">
                {creditBalance != null ? creditBalance : "—"}
              </span>
            </p>
            <ButtonLink href="/app/juris-one/work" variant="secondary">
              Abrir Work
            </ButtonLink>
            <p className="vj-hint">{JURIS_WORK_STATUS.detail}</p>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">Provedor de IA</p>
            <Badge tone={statusPill.tone}>{statusPill.label}</Badge>
            <p className="vj-hint">
              {aiStatus?.provider.configured
                ? aiStatus.provider.message ?? "Provedor marcado como configurado neste ambiente."
                : "OpenAI não está configurado (FEATURE_AI=0). O chat autenticado usa FAQ/fallback — sem streaming e sem alegar modelo ao vivo."}
            </p>
            <Link href="/app/ia" className="vj-juris-app-nav-link">
              Administração de IA
            </Link>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">Work pendente</p>
            <p>{pendingWorkCount} tarefa(s) em andamento ou aguardando aprovação.</p>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">Segurança</p>
            <p className="vj-hint" role="note">
              IA pode errar. Confirme fatos críticos. Ações externas (protocolo, pagamento, envio)
              permanecem bloqueadas no scaffold Work.
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
