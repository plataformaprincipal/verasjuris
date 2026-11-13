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
import { useLocale } from "./locale-provider";
import {
  JURIS_ONE_GUEST_LIMIT,
  JURIS_ONE_OBJECTIVES,
  JURIS_WORK_STATUS,
  jurisOneReply,
  modeForObjective,
  redirectsForObjective,
  type JurisOneObjectiveId,
} from "../lib/juris-one";

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
  const { locale } = useLocale();
  const inputId = useId();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [objective, setObjective] = useState<JurisOneObjectiveId | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "Olá. Sou o Juris One — assistente informativo do VerasJuris. Não sou advogado e não substituo orientação profissional individualizada. Nesta etapa pública, respondo com FAQ e encaminhamentos para recursos reais da plataforma.",
    },
  ]);

  useEffect(() => {
    setTurns(readGuestTurns());
  }, []);

  const remaining = Math.max(0, JURIS_ONE_GUEST_LIMIT - turns);
  const limitReached = remaining <= 0;
  const redirects = redirectsForObjective(objective);

  function startNewConversation() {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "system",
        content:
          "Nova conversa iniciada. A etapa gratuita de orientação nesta sessão continua sujeita ao limite já consumido.",
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

    // Simula latência leve de UI; resposta é local (FAQ), sem chamar provedor pago.
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
    "Como entrar na conta?",
    "Onde estão as políticas?",
    "Vocês são um escritório de advocacia?",
    "Como ver o status do sistema?",
  ];

  return (
    <div className="vj-juris-shell">
      {sidebarOpen ? (
        <aside className="vj-card vj-stack" aria-label="Painel Juris One">
          <div className="vj-inline-actions" style={{ justifyContent: "space-between" }}>
            <strong>
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
          <Button variant="secondary" onClick={startNewConversation}>
            <Plus size={16} aria-hidden="true" /> Nova conversa
          </Button>
          <div className="vj-stack">
            <p className="vj-meta">
              <History size={14} aria-hidden="true" /> Histórico persistente exige autenticação.
            </p>
            <p className="vj-meta">
              Etapa gratuita nesta sessão: {remaining} de {JURIS_ONE_GUEST_LIMIT} interações.
            </p>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">Modos</p>
            <button type="button" className="vj-button" aria-pressed="true">
              <MessageSquare size={16} aria-hidden="true" /> Chat
            </button>
            <button type="button" className="vj-button vj-button-secondary" disabled title={JURIS_WORK_STATUS.detail}>
              <BriefcaseBusiness size={16} aria-hidden="true" /> {JURIS_WORK_STATUS.label} — indisponível
            </button>
            <p className="vj-hint">{JURIS_WORK_STATUS.detail}</p>
          </div>
          <div className="vj-stack">
            <p className="vj-meta">Encaminhamentos</p>
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
            <PanelLeft size={16} aria-hidden="true" /> Painel
          </button>
        </div>
      )}

      <section className="vj-juris-chat" aria-label="Conversa Juris One">
        <div className="vj-stack">
          <p className="vj-meta">
            <Sparkles size={14} aria-hidden="true" /> Seu assistente inteligente no universo jurídico
          </p>
          <p className="vj-hint" role="note">
            <ShieldCheck size={14} aria-hidden="true" /> Respostas informativas. Sem chaves de API no
            cliente. Sem execução de ações externas nesta etapa.
          </p>
        </div>

        {objective === null ? (
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">Como podemos ajudar?</h2>
            <p className="vj-meta">Seleção opcional — não concede permissões profissionais.</p>
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
              Pular e iniciar no Chat
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
              <LoaderCircle size={14} className="vj-spin" aria-hidden="true" /> Processando…
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
            <strong>Etapa gratuita desta sessão concluída</strong>
            <p>
              Para continuar com recursos autenticados, crie conta, entre, conheça planos ou explore
              ferramentas e o marketplace.
            </p>
            <div className="vj-form-actions">
              <ButtonLink href="/cadastro">Criar conta</ButtonLink>
              <ButtonLink href="/entrar" variant="secondary">
                Entrar
              </ButtonLink>
              <ButtonLink href="/planos" variant="secondary">
                Planos
              </ButtonLink>
              <ButtonLink href="/ferramentas" variant="ghost">
                Ferramentas
              </ButtonLink>
              <ButtonLink href="/marketplace-juridico" variant="ghost">
                Marketplace
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
              Mensagem para o Juris One
            </label>
            <textarea
              id={inputId}
              className="vj-input"
              rows={2}
              value={input}
              disabled={pending || limitReached}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escreva sua pergunta…"
            />
          </div>
          <Button type="submit" disabled={pending || limitReached || !input.trim()}>
            <Send size={16} aria-hidden="true" /> Enviar
          </Button>
        </form>
      </section>
    </div>
  );
}
