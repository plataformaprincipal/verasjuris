"use client";

import { Button, ButtonLink } from "@verasjuris/ui";
import {
  ArrowUpRight,
  BrainCircuit,
  BriefcaseBusiness,
  History,
  LoaderCircle,
  MessageSquare,
  PanelLeft,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { fetchSessionAccount } from "../lib/crm";
import {
  JURIS_ONE_GUEST_LIMIT,
  JURIS_ONE_OBJECTIVES,
  JURIS_WORK_STATUS,
  redirectsForObjective,
  type JurisOneObjectiveId,
} from "../lib/juris-one";
import {
  fetchJurisOnePublicStatus,
  getOrCreateJurisOneVisitorId,
  sendJurisOnePublicChat,
} from "../lib/juris-one-public-api";
import { useLocale } from "./locale-provider";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export function JurisOneChat() {
  const { locale, t } = useLocale();
  const inputId = useId();
  const [signedIn, setSignedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [objective, setObjective] = useState<JurisOneObjectiveId | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(JURIS_ONE_GUEST_LIMIT);
  const [dailyLimit, setDailyLimit] = useState(JURIS_ONE_GUEST_LIMIT);
  const [aiStatus, setAiStatus] = useState<string>("unknown");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "system",
        content: t("jurisOne.welcome"),
      },
    ]);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [account, status] = await Promise.all([
        fetchSessionAccount(),
        fetchJurisOnePublicStatus(),
      ]);
      if (cancelled) return;
      setSignedIn(Boolean(account));
      if (status) {
        setAiStatus(status.status);
        setDailyLimit(status.publicChat.dailyLimit);
        setRemaining(status.publicChat.dailyLimit);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const limitReached = remaining <= 0;
  const redirects = redirectsForObjective(objective);
  const aiUnavailable = aiStatus === "not_configured";

  function startNewConversation() {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "system",
        content: t("jurisOne.welcomeNew"),
      },
    ]);
    setInput("");
    setError(null);
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || pending) return;
    if (limitReached || aiUnavailable) return;

    setPending(true);
    setError(null);
    setInput("");
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);

    const result = await sendJurisOnePublicChat({
      message: text,
      locale,
      visitorId: getOrCreateJurisOneVisitorId(),
      history,
    });

    if ("error" in result) {
      setError(result.error.message);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "system",
          content: result.error.message,
        },
      ]);
      if (result.error.code === "RATE_LIMIT") {
        setRemaining(0);
      }
      setPending(false);
      return;
    }

    setRemaining(result.remainingToday);
    setDailyLimit(result.dailyLimit);
    setMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: "assistant", content: result.reply },
    ]);
    setPending(false);
  }

  const suggestions = [
    t("jurisOne.suggest.login"),
    t("jurisOne.suggest.policies"),
    t("jurisOne.suggest.firm"),
    t("jurisOne.suggest.status"),
  ];

  return (
    <div className="vj-juris-shell">
      {sidebarOpen ? (
        <aside className="vj-card vj-stack" aria-label={t("jurisOne.panelAria")}>
          <div className="vj-inline-actions" style={{ justifyContent: "space-between" }}>
            <strong>
              <BrainCircuit size={18} aria-hidden="true" /> Juris One
            </strong>
            <button
              type="button"
              className="vj-button vj-button-ghost"
              aria-label={t("jurisOne.collapse")}
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeft size={18} aria-hidden="true" />
            </button>
          </div>
          <Button variant="secondary" onClick={startNewConversation}>
            <Plus size={16} aria-hidden="true" /> {t("jurisOne.newChat")}
          </Button>
          <div className="vj-stack">
            <p className="vj-meta">
              <History size={14} aria-hidden="true" /> {t("jurisOne.historyHint")}
            </p>
            <p className="vj-meta">
              {t("jurisOne.freeQuota", undefined, {
                remaining,
                limit: dailyLimit,
              })}
            </p>
            {aiUnavailable ? (
              <p className="vj-hint" role="status">
                {t(
                  "jurisOne.aiUnavailable",
                  "A inteligência artificial está temporariamente indisponível.",
                )}
              </p>
            ) : null}
          </div>
          <div className="vj-stack">
            <p className="vj-meta">{t("jurisOne.modes")}</p>
            <button type="button" className="vj-button" aria-pressed="true">
              <MessageSquare size={16} aria-hidden="true" /> {t("jurisOne.chat")}
            </button>
            <ButtonLink
              href={signedIn ? JURIS_WORK_STATUS.hrefAuthenticated : JURIS_WORK_STATUS.hrefLogin}
              variant="secondary"
            >
              <BriefcaseBusiness size={16} aria-hidden="true" /> {JURIS_WORK_STATUS.label}
              {signedIn ? "" : ` — ${t("jurisOne.signInForWork", "entrar para usar")}`}
            </ButtonLink>
            <p className="vj-hint">{JURIS_WORK_STATUS.detail}</p>
            <ButtonLink href="/entrar?redirect=%2Fapp%2Fjuris-one" variant="secondary">
              Entrar no app
            </ButtonLink>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">{t("jurisOne.redirects")}</p>
            {redirects.map((item) => (
              <a key={item.href} href={item.href}>
                <ArrowUpRight size={14} aria-hidden="true" /> {item.label}
              </a>
            ))}
          </div>
        </aside>
      ) : (
        <div>
          <button
            type="button"
            className="vj-button vj-button-secondary"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeft size={16} aria-hidden="true" /> {t("jurisOne.panel")}
          </button>
        </div>
      )}

      <section className="vj-juris-chat" aria-label={t("jurisOne.conversationAria")}>
        <div className="vj-stack">
          <p className="vj-meta">
            <Sparkles size={14} aria-hidden="true" /> {t("jurisOne.tagline")}
          </p>
          <p className="vj-hint" role="note">
            <ShieldCheck size={14} aria-hidden="true" /> {t("jurisOne.safetyNote")}
          </p>
          {signedIn ? (
            <div className="vj-form-actions">
              <ButtonLink href="/app/juris-one">
                {t("jurisOne.openAuthenticated", "Abrir Juris One com sua conta")}
              </ButtonLink>
              <ButtonLink href="/app" variant="ghost">
                {t("nav.backToPlatform", "Voltar à plataforma")}
              </ButtonLink>
            </div>
          ) : null}
        </div>

        {objective === null ? (
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">{t("jurisOne.howHelp")}</h2>
            <p className="vj-meta">{t("jurisOne.optionalSelect")}</p>
            <div className="vj-service-grid">
              {JURIS_ONE_OBJECTIVES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="vj-interactive-card"
                  onClick={() => setObjective(item.id)}
                >
                  <strong>{item.label}</strong>
                  <span className="vj-meta">{item.hint}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={() => setObjective("orientacao")}>
              {t("jurisOne.skipChat")}
            </Button>
          </div>
        ) : null}

        <div className="vj-juris-messages" aria-live="polite">
          {messages.map((message) => (
            <p
              key={message.id}
              className={
                message.role === "user" ? "vj-juris-bubble vj-juris-bubble-user" : "vj-juris-bubble"
              }
            >
              {message.content}
            </p>
          ))}
          {pending ? (
            <p className="vj-meta" role="status">
              <LoaderCircle size={14} className="vj-spin" aria-hidden="true" />{" "}
              {t("jurisOne.processing")}
            </p>
          ) : null}
          {error ? (
            <p className="vj-hint" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {!limitReached && !aiUnavailable ? (
          <div className="vj-juris-suggestions">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="vj-button vj-button-secondary"
                disabled={pending}
                onClick={() => void send(item)}
              >
                {item}
              </button>
            ))}
          </div>
        ) : (
          <div className="vj-card vj-stack" role="status">
            <strong>{t("jurisOne.limitTitle")}</strong>
            <p>{t("jurisOne.limitBody")}</p>
            <div className="vj-form-actions">
              <ButtonLink href="/cadastro">{t("nav.signup")}</ButtonLink>
              <ButtonLink href="/entrar" variant="secondary">
                {t("nav.login")}
              </ButtonLink>
              <ButtonLink href="/planos" variant="secondary">
                {t("footer.plans")}
              </ButtonLink>
              <ButtonLink href="/ferramentas" variant="ghost">
                {t("nav.tools")}
              </ButtonLink>
              <ButtonLink href="/marketplace-juridico" variant="ghost">
                {t("nav.marketplace")}
              </ButtonLink>
            </div>
          </div>
        )}

        <form
          className="vj-juris-compose"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className="vj-stack" style={{ gap: "0.35rem" }}>
            <label className="vj-visually-hidden" htmlFor={inputId}>
              {t("jurisOne.messageLabel")}
            </label>
            <textarea
              id={inputId}
              className="vj-input"
              rows={2}
              value={input}
              disabled={pending || limitReached || aiUnavailable}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("jurisOne.placeholder")}
            />
          </div>
          <Button
            type="submit"
            disabled={pending || limitReached || aiUnavailable || !input.trim()}
          >
            <Send size={16} aria-hidden="true" /> {t("jurisOne.send")}
          </Button>
        </form>
      </section>
    </div>
  );
}
