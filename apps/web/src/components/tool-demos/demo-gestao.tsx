"use client";

import { Button } from "@verasjuris/ui";
import { useState } from "react";
import { DEMO_APPOINTMENTS, DEMO_CLIENTS, DEMO_MATTERS, DEMO_TASKS } from "../../lib/demo-data";
import { newId, useToolDemoState } from "../../lib/tool-demos/engine";
import type { ToolDemoConfig } from "../../lib/tool-demos/types";
import { DemoShell } from "./demo-shell";

const PROCESSOS_CFG: ToolDemoConfig = {
  id: "demo-processos",
  kind: "processos",
  title: "Gestão de processos (demo)",
  classification: "A",
  maxItems: 12,
  seedVersion: 1,
  limitations: [
    "Dados fictícios apenas nesta sessão do navegador",
    "Sem consulta a tribunais",
    "Andamentos não têm validade processual",
  ],
};

type Matter = {
  id: string;
  title: string;
  status: string;
  area: string;
  events: Array<{ id: string; text: string; at: string }>;
};

function seedMatters(): Matter[] {
  return DEMO_MATTERS.slice(0, 4).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.status,
    area: m.area,
    events: [
      {
        id: `${m.id}-e1`,
        text: `Caso demonstrativo — responsável ${m.responsible}`,
        at: m.nextDeadline,
      },
    ],
  }));
}

export function DemoProcessos() {
  const demo = useToolDemoState(PROCESSOS_CFG, seedMatters);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [eventText, setEventText] = useState("");

  const filtered = demo.state.filter(
    (m) =>
      !q.trim() ||
      m.title.toLowerCase().includes(q.toLowerCase()) ||
      m.status.toLowerCase().includes(q.toLowerCase()),
  );
  const current = demo.state.find((m) => m.id === selected) ?? filtered[0] ?? null;

  return (
    <DemoShell
      config={PROCESSOS_CFG}
      status={demo.status}
      error={demo.error}
      onReset={() => {
        demo.reset();
        setSelected(null);
      }}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-demo-split">
        <div className="vj-stack">
          <label className="vj-field">
            <span className="vj-label">Buscar</span>
            <input className="vj-input" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <ul className="vj-demo-list">
            {filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className={
                    current?.id === m.id ? "vj-demo-list-item is-active" : "vj-demo-list-item"
                  }
                  onClick={() => setSelected(m.id)}
                >
                  <strong>{m.title}</strong>
                  <span className="vj-meta">
                    {m.status} · {m.area}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="vj-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !demo.assertLimit(demo.state.length)) return;
              const id = newId("proc");
              demo.setState((prev) => [
                {
                  id,
                  title: title.trim(),
                  status: "Em andamento",
                  area: "Demonstração",
                  events: [
                    {
                      id: newId("ev"),
                      text: "Processo fictício criado",
                      at: new Date().toISOString().slice(0, 10),
                    },
                  ],
                },
                ...prev,
              ]);
              setTitle("");
              setSelected(id);
              demo.setStatus("Processo fictício adicionado.");
            }}
          >
            <label className="vj-field">
              <span className="vj-label">Novo processo fictício</span>
              <input
                className="vj-input"
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <Button type="submit">Cadastrar</Button>
          </form>
        </div>
        {current ? (
          <div className="vj-stack vj-demo-panel">
            <h4 className="vj-section-title">{current.title}</h4>
            <label className="vj-field">
              <span className="vj-label">Status</span>
              <select
                className="vj-input"
                value={current.status}
                onChange={(e) => {
                  const status = e.target.value;
                  demo.setState((prev) =>
                    prev.map((m) => (m.id === current.id ? { ...m, status } : m)),
                  );
                  demo.setStatus("Status atualizado (demo).");
                }}
              >
                {["Em andamento", "Aguardando documentos", "Em análise", "Concluído"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <h5 className="vj-meta">Linha do tempo</h5>
            <ol className="vj-inicio-timeline">
              {current.events.map((ev) => (
                <li key={ev.id}>
                  <strong>{ev.at}</strong>
                  <p>{ev.text}</p>
                </li>
              ))}
            </ol>
            <form
              className="vj-stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (!eventText.trim()) return;
                demo.setState((prev) =>
                  prev.map((m) =>
                    m.id === current.id
                      ? {
                          ...m,
                          events: [
                            {
                              id: newId("ev"),
                              text: eventText.trim(),
                              at: new Date().toISOString().slice(0, 10),
                            },
                            ...m.events,
                          ],
                        }
                      : m,
                  ),
                );
                setEventText("");
                demo.setStatus("Andamento fictício registrado.");
              }}
            >
              <label className="vj-field">
                <span className="vj-label">Novo andamento</span>
                <input
                  className="vj-input"
                  required
                  value={eventText}
                  onChange={(e) => setEventText(e.target.value)}
                />
              </label>
              <Button type="submit">Adicionar andamento</Button>
            </form>
          </div>
        ) : null}
      </div>
    </DemoShell>
  );
}

const CLIENTES_CFG: ToolDemoConfig = {
  id: "demo-clientes",
  kind: "clientes",
  title: "Gestão de clientes (demo)",
  classification: "A",
  maxItems: 12,
  seedVersion: 1,
  limitations: ["Clientes fictícios", "Sem CRM real", "Sem envio de mensagens"],
};

type Client = {
  id: string;
  name: string;
  contact: string;
  notes: string[];
  caseIds: string[];
};

export function DemoClientes() {
  const demo = useToolDemoState(CLIENTES_CFG, () =>
    DEMO_CLIENTS.map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      notes: [`Atendimento demonstrativo — ${c.activeMatters} caso(s) exemplo`],
      caseIds: DEMO_MATTERS.filter((m) => m.clientId === c.id).map((m) => m.id),
    })),
  );
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState(demo.state[0]?.id ?? "");
  const current = demo.state.find((c) => c.id === selected) ?? demo.state[0];

  return (
    <DemoShell
      config={CLIENTES_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-demo-split">
        <ul className="vj-demo-list">
          {demo.state.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={
                  current?.id === c.id ? "vj-demo-list-item is-active" : "vj-demo-list-item"
                }
                onClick={() => setSelected(c.id)}
              >
                <strong>{c.name}</strong>
                <span className="vj-meta">{c.contact}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="vj-stack">
          <form
            className="vj-inline-actions"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !demo.assertLimit(demo.state.length)) return;
              const id = newId("cli");
              demo.setState((prev) => [
                { id, name: name.trim(), contact: "demo@exemplo.com", notes: [], caseIds: [] },
                ...prev,
              ]);
              setName("");
              setSelected(id);
              demo.setStatus("Cliente fictício criado.");
            }}
          >
            <input
              className="vj-input"
              placeholder="Novo cliente"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit">Adicionar</Button>
          </form>
          {current ? (
            <div className="vj-demo-panel vj-stack">
              <h4>{current.name}</h4>
              <p className="vj-meta">{current.contact}</p>
              <p className="vj-meta">Casos simulados: {current.caseIds.join(", ") || "nenhum"}</p>
              <ul>
                {current.notes.map((n) => (
                  <li key={`${current.id}-n-${n}`}>{n}</li>
                ))}
              </ul>
              <form
                className="vj-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  demo.setState((prev) =>
                    prev.map((c) =>
                      c.id === current.id ? { ...c, notes: [note.trim(), ...c.notes] } : c,
                    ),
                  );
                  setNote("");
                  demo.setStatus("Registro de atendimento fictício adicionado.");
                }}
              >
                <input
                  className="vj-input"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota de atendimento"
                />
                <Button type="submit">Registrar atendimento</Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </DemoShell>
  );
}

const AGENDA_CFG: ToolDemoConfig = {
  id: "demo-agenda",
  kind: "agenda",
  title: "Agenda (demo)",
  classification: "A",
  maxItems: 20,
  seedVersion: 1,
  limitations: ["Compromissos fictícios", "Sem sincronização Google/Outlook"],
};

type Appt = { id: string; title: string; date: string; time: string };

export function DemoAgenda() {
  const demo = useToolDemoState(AGENDA_CFG, () => DEMO_APPOINTMENTS.map((a) => ({ ...a })));
  const [draft, setDraft] = useState({ title: "", date: "", time: "09:00" });

  return (
    <DemoShell
      config={AGENDA_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <form
        className="vj-inicio-filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.title.trim() || !draft.date || !demo.assertLimit(demo.state.length)) return;
          demo.setState((prev) => [
            { id: newId("apt"), title: draft.title.trim(), date: draft.date, time: draft.time },
            ...prev,
          ]);
          setDraft({ title: "", date: "", time: "09:00" });
          demo.setStatus("Compromisso fictício criado.");
        }}
      >
        <input
          className="vj-input"
          required
          placeholder="Título"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <input
          className="vj-input"
          type="date"
          required
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
        <input
          className="vj-input"
          type="time"
          required
          value={draft.time}
          onChange={(e) => setDraft({ ...draft, time: e.target.value })}
        />
        <Button type="submit">Incluir</Button>
      </form>
      <ul className="vj-stack">
        {demo.state
          .slice()
          .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
          .map((a) => (
            <li key={a.id} className="vj-demo-panel vj-inline-actions">
              <div>
                <strong>{a.title}</strong>
                <p className="vj-meta">
                  {a.date} · {a.time}
                </p>
              </div>
              <Button
                type="button"
                className="vj-button-secondary"
                onClick={() => {
                  const nextDate = window.prompt("Nova data (AAAA-MM-DD)", a.date);
                  if (!nextDate) return;
                  demo.setState((prev) =>
                    prev.map((x) => (x.id === a.id ? { ...x, date: nextDate } : x)),
                  );
                  demo.setStatus("Compromisso remarcado (demo).");
                }}
              >
                Remarcar
              </Button>
              <Button
                type="button"
                className="vj-button-ghost"
                onClick={() => {
                  demo.setState((prev) => prev.filter((x) => x.id !== a.id));
                  demo.setStatus("Compromisso removido.");
                }}
              >
                Excluir
              </Button>
            </li>
          ))}
      </ul>
    </DemoShell>
  );
}

const PRAZOS_CFG: ToolDemoConfig = {
  id: "demo-prazos",
  kind: "prazos",
  title: "Prazos demonstrativos",
  classification: "A",
  maxItems: 15,
  seedVersion: 1,
  limitations: [
    "Datas informadas manualmente pelo visitante",
    "Não calcula prazos processuais oficiais",
    "Não constitui calendário jurídico válido",
  ],
};

type Deadline = { id: string; title: string; due: string; urgency: "baixa" | "media" | "alta" };

export function DemoPrazos() {
  const demo = useToolDemoState<Deadline[]>(PRAZOS_CFG, () => [
    { id: "d1", title: "Entregar documentos (demo)", due: "2026-11-20", urgency: "alta" },
    { id: "d2", title: "Revisar petição (demo)", due: "2026-11-28", urgency: "media" },
  ]);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [urgency, setUrgency] = useState<Deadline["urgency"]>("media");

  return (
    <DemoShell
      config={PRAZOS_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <p className="vj-hint">
        Informe datas manualmente. Este painel não calcula prazos processuais oficiais.
      </p>
      <form
        className="vj-inicio-filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !due || !demo.assertLimit(demo.state.length)) return;
          demo.setState((prev) => [
            { id: newId("dl"), title: title.trim(), due, urgency },
            ...prev,
          ]);
          setTitle("");
          setDue("");
          demo.setStatus("Lembrete demonstrativo criado.");
        }}
      >
        <input
          className="vj-input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lembrete"
        />
        <input
          className="vj-input"
          type="date"
          required
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <select
          className="vj-input"
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as Deadline["urgency"])}
        >
          <option value="baixa">Baixa</option>
          <option value="media">Média</option>
          <option value="alta">Alta</option>
        </select>
        <Button type="submit">Criar</Button>
      </form>
      <div className="vj-demo-kanban">
        {(["alta", "media", "baixa"] as const).map((u) => (
          <div key={u} className="vj-demo-column">
            <h4 className="vj-meta">Urgência {u}</h4>
            {demo.state
              .filter((d) => d.urgency === u)
              .map((d) => (
                <article key={d.id} className="vj-demo-card">
                  <strong>{d.title}</strong>
                  <p className="vj-meta">Vence {d.due}</p>
                </article>
              ))}
          </div>
        ))}
      </div>
    </DemoShell>
  );
}

const TAREFAS_CFG: ToolDemoConfig = {
  id: "demo-tarefas",
  kind: "tarefas",
  title: "Kanban de tarefas (demo)",
  classification: "A",
  maxItems: 20,
  seedVersion: 1,
  limitations: ["Atribuições fictícias", "Sem notificações reais"],
};

type Task = {
  id: string;
  title: string;
  assignee: string;
  status: "Pendente" | "Em andamento" | "Concluída";
};

const COLS: Task["status"][] = ["Pendente", "Em andamento", "Concluída"];

export function DemoTarefas() {
  const demo = useToolDemoState(TAREFAS_CFG, () =>
    DEMO_TASKS.map((t) => ({
      id: t.id,
      title: t.title,
      assignee: t.responsible,
      status: t.status,
    })),
  );
  const [title, setTitle] = useState("");

  function move(id: string, status: Task["status"]) {
    demo.setState((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    demo.setStatus(`Tarefa movida para ${status}.`);
  }

  return (
    <DemoShell
      config={TAREFAS_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <form
        className="vj-inline-actions"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !demo.assertLimit(demo.state.length)) return;
          demo.setState((prev) => [
            { id: newId("task"), title: title.trim(), assignee: "Equipe Demo", status: "Pendente" },
            ...prev,
          ]);
          setTitle("");
          demo.setStatus("Tarefa fictícia criada.");
        }}
      >
        <input
          className="vj-input"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa"
        />
        <Button type="submit">Criar</Button>
      </form>
      <ul className="vj-demo-kanban">
        {COLS.map((col) => (
          <li key={col} className="vj-demo-column" aria-label={col}>
            <h4>{col}</h4>
            {demo.state
              .filter((t) => t.status === col)
              .map((t) => (
                <article key={t.id} className="vj-demo-card">
                  <strong>{t.title}</strong>
                  <p className="vj-meta">{t.assignee}</p>
                  <div className="vj-inline-actions">
                    {COLS.filter((c) => c !== col).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="vj-button vj-button-ghost"
                        onClick={() => move(t.id, c)}
                      >
                        → {c}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
          </li>
        ))}
      </ul>
    </DemoShell>
  );
}
