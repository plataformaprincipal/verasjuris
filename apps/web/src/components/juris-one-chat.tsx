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
  jurisOneReply,
  modeForObjective,
  redirectsForObjective,
  type JurisOneObjectiveId,
} from "../lib/juris-one";
import { useLocale } from "./locale-provider";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

const STORAGE_KEY = "vj.juris-one.guest-turns";

function readGuestTurns(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function writeGuestTurns(value: number) {
  window.sessionStorage.setItem(STORAGE_KEY, String(value));
}

export function JurisOneChat() {
  const { locale, t } = useLocale();
  const inputId = useId();
  const [signedIn, setSignedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [objective, setObjective] = useState<JurisOneObjectiveId | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setTurns(readGuestTurns());
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
      const account = await fetchSessionAccount();
      if (!cancelled) setSignedIn(Boolean(account));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = Math.max(0, JURIS_ONE_GUEST_LIMIT - turns);
  const limitReached = remaining <= 0;
  const redirects = redirectsForObjective(objective);

  function startNewConversation() {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "system",
        content: t("jurisOne.welcomeNew"),
      },
    ]);
    setInput("");
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || pending) return;
    if (limitReached) return;

    setPending(true);
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);

    await new Promise((resolve) => setTimeout(resolve, 220));

    const nextTurns = turns + 1;
    writeGuestTurns(nextTurns);
    setTurns(nextTurns);

    const mode = modeForObjective(objective);
    const { reply } = jurisOneReply(locale, mode, text, JURIS_ONE_GUEST_LIMIT - nextTurns + 1);
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
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
                limit: JURIS_ONE_GUEST_LIMIT,
              })}
            </p>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">{t("jurisOne.modes")}</p>
            <button type="button" className="vj-button" aria-pressed="true">
              <MessageSquare size={16} aria-hidden="true" /> {t("jurisOne.chat")}
            </button>
            <button
              type="button"
              className="vj-button vj-button-secondary"
              disabled
              title={JURIS_WORK_STATUS.detail}
            >
              <BriefcaseBusiness size={16} aria-hidden="true" /> {JURIS_WORK_STATUS.label} —{" "}
              {t("jurisOne.unavailable")}
            </button>
            <p className="vj-hint">{JURIS_WORK_STATUS.detail}</p>
            <p className="vj-hint">
              Com conta, o hub autenticado em /app/juris-one oferece Chat e scaffold Work com
              créditos.
            </p>
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
        </div>

        {!limitReached ? (
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
              disabled={pending || limitReached}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("jurisOne.placeholder")}
            />
          </div>
          <Button type="submit" disabled={pending || limitReached || !input.trim()}>
            <Send size={16} aria-hidden="true" /> {t("jurisOne.send")}
          </Button>
        </form>
      </section>
    </div>
  );
}
