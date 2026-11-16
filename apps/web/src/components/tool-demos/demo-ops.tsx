"use client";

import { Button } from "@verasjuris/ui";
import { useState } from "react";
import { DEMO_DOCUMENTS, DEMO_FINANCIAL_ROWS, DEMO_MATTERS } from "../../lib/demo-data";
import { newId, useToolDemoState } from "../../lib/tool-demos/engine";
import type { ToolDemoConfig } from "../../lib/tool-demos/types";
import { DemoShell } from "./demo-shell";

const DOCS_CFG: ToolDemoConfig = {
  id: "demo-documentos",
  kind: "documentos",
  title: "Documentos (demo)",
  classification: "A",
  maxItems: 20,
  seedVersion: 1,
  limitations: ["Arquivos fictícios", "Sem upload real", "Prévia textual apenas"],
};

export function DemoDocumentos() {
  const demo = useToolDemoState(DOCS_CFG, () =>
    DEMO_DOCUMENTS.map((d) => ({
      ...d,
      folder: d.type,
      version: 1,
      preview: `Prévia fictícia de ${d.name}. Conteúdo demonstrativo sem valor jurídico.`,
    })),
  );
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(demo.state[0]?.id ?? "");
  const [name, setName] = useState("");
  const current = demo.state.find((d) => d.id === selected);

  return (
    <DemoShell
      config={DOCS_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-demo-split">
        <div className="vj-stack">
          <input
            className="vj-input"
            placeholder="Pesquisar"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <ul className="vj-demo-list">
            {demo.state
              .filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()))
              .map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className={
                      current?.id === d.id ? "vj-demo-list-item is-active" : "vj-demo-list-item"
                    }
                    onClick={() => setSelected(d.id)}
                  >
                    <strong>{d.name}</strong>
                    <span className="vj-meta">
                      {d.folder} · v{d.version}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
          <form
            className="vj-inline-actions"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !demo.assertLimit(demo.state.length)) return;
              const id = newId("doc");
              demo.setState((prev) => [
                {
                  id,
                  name: name.trim(),
                  type: "Demonstração",
                  matterId: DEMO_MATTERS[0]?.id ?? "m1",
                  updatedAt: new Date().toISOString().slice(0, 10),
                  folder: "Geral",
                  version: 1,
                  preview: "Documento fictício criado na demonstração.",
                },
                ...prev,
              ]);
              setName("");
              setSelected(id);
              demo.setStatus("Documento fictício adicionado.");
            }}
          >
            <input
              className="vj-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Novo documento"
            />
            <Button type="submit">Criar</Button>
          </form>
        </div>
        {current ? (
          <div className="vj-demo-panel vj-stack">
            <h4>{current.name}</h4>
            <p className="vj-meta">
              Pasta {current.folder} · versão {current.version}
            </p>
            <pre className="vj-demo-preview">{current.preview}</pre>
            <Button
              type="button"
              className="vj-button-secondary"
              onClick={() => {
                demo.setState((prev) =>
                  prev.map((d) =>
                    d.id === current.id
                      ? {
                          ...d,
                          version: d.version + 1,
                          updatedAt: new Date().toISOString().slice(0, 10),
                          preview: `${d.preview}\n\n[v${d.version + 1}] revisão demonstrativa.`,
                        }
                      : d,
                  ),
                );
                demo.setStatus("Nova versão fictícia criada.");
              }}
            >
              Nova versão
            </Button>
          </div>
        ) : null}
      </div>
    </DemoShell>
  );
}

const CONTRACTS_CFG: ToolDemoConfig = {
  id: "demo-contratos",
  kind: "contratos",
  title: "Editor de contratos (demo)",
  classification: "B",
  maxItems: 5,
  seedVersion: 1,
  limitations: [
    "Modelos fictícios",
    "Não constitui documento jurídico personalizado",
    "Exportação local apenas (.txt)",
  ],
};

const TEMPLATES = [
  {
    id: "t1",
    name: "Prestação de serviços (demo)",
    body: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS (DEMONSTRAÇÃO)\n\nContratante: {{cliente}}\nContratado: {{escritorio}}\nObjeto: {{objeto}}\nValor: {{valor}}\n\nEste texto é fictício e não substitui assessoria profissional.",
  },
  {
    id: "t2",
    name: "NDA simplificado (demo)",
    body: "ACORDO DE CONFIDENCIALIDADE (DEMONSTRAÇÃO)\n\nPartes: {{cliente}} e {{escritorio}}\nObjeto da confidencialidade: {{objeto}}\n\nDocumento demonstrativo sem validade jurídica.",
  },
];

export function DemoContratos() {
  const demo = useToolDemoState(CONTRACTS_CFG, () => ({
    templateId: TEMPLATES[0]!.id,
    fields: {
      cliente: "Cliente Demonstração Ltda.",
      escritorio: "Escritório Exemplo",
      objeto: "Assessoria jurídica demonstrativa",
      valor: "a combinar",
    },
  }));
  const template = TEMPLATES.find((t) => t.id === demo.state.templateId) ?? TEMPLATES[0]!;
  const preview = Object.entries(demo.state.fields).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template.body,
  );

  return (
    <DemoShell
      config={CONTRACTS_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-demo-split">
        <div className="vj-stack">
          <label className="vj-field">
            <span className="vj-label">Modelo</span>
            <select
              className="vj-input"
              value={demo.state.templateId}
              onChange={(e) =>
                demo.setState((s) => ({ ...s, templateId: e.target.value }))
              }
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {Object.entries(demo.state.fields).map(([key, value]) => (
            <label key={key} className="vj-field">
              <span className="vj-label">{key}</span>
              <input
                className="vj-input"
                value={value}
                onChange={(e) =>
                  demo.setState((s) => ({
                    ...s,
                    fields: { ...s.fields, [key]: e.target.value },
                  }))
                }
              />
            </label>
          ))}
          <Button
            type="button"
            onClick={() => {
              const blob = new Blob([preview], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "contrato-demonstracao.txt";
              a.click();
              URL.revokeObjectURL(url);
              demo.setStatus("Arquivo .txt exportado localmente.");
            }}
          >
            Exportar .txt
          </Button>
        </div>
        <pre className="vj-demo-preview">{preview}</pre>
      </div>
    </DemoShell>
  );
}

const CRM_CFG: ToolDemoConfig = {
  id: "demo-crm",
  kind: "crm",
  title: "Pipeline CRM (demo)",
  classification: "B",
  maxItems: 20,
  seedVersion: 1,
  limitations: ["Oportunidades fictícias", "Sem e-mail real"],
};

type Opp = {
  id: string;
  name: string;
  stage: "Lead" | "Qualificação" | "Proposta" | "Fechamento";
  contact: string;
};

const STAGES: Opp["stage"][] = ["Lead", "Qualificação", "Proposta", "Fechamento"];

export function DemoCrm() {
  const demo = useToolDemoState<Opp[]>(CRM_CFG, () => [
    { id: "o1", name: "Empresa Alfa", stage: "Lead", contact: "ana@alfa.demo" },
    { id: "o2", name: "Comércio Beta", stage: "Proposta", contact: "beta@demo" },
    { id: "o3", name: "Grupo Gama", stage: "Qualificação", contact: "gama@demo" },
  ]);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState<Opp["stage"] | "all">("all");

  return (
    <DemoShell
      config={CRM_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-inline-actions">
        <select
          className="vj-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Opp["stage"] | "all")}
        >
          <option value="all">Todas as etapas</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <form
          className="vj-inline-actions"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !demo.assertLimit(demo.state.length)) return;
            demo.setState((prev) => [
              {
                id: newId("opp"),
                name: name.trim(),
                stage: "Lead",
                contact: "contato@demo.local",
              },
              ...prev,
            ]);
            setName("");
            demo.setStatus("Oportunidade fictícia criada.");
          }}
        >
          <input
            className="vj-input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nova oportunidade"
          />
          <Button type="submit">Adicionar</Button>
        </form>
      </div>
      <div className="vj-demo-kanban">
        {STAGES.filter((s) => filter === "all" || filter === s).map((stage) => (
          <div key={stage} className="vj-demo-column">
            <h4>{stage}</h4>
            {demo.state
              .filter((o) => o.stage === stage)
              .map((o) => (
                <article key={o.id} className="vj-demo-card">
                  <strong>{o.name}</strong>
                  <p className="vj-meta">{o.contact}</p>
                  <div className="vj-inline-actions">
                    {STAGES.filter((s) => s !== stage).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="vj-button vj-button-ghost"
                        onClick={() => {
                          demo.setState((prev) =>
                            prev.map((x) => (x.id === o.id ? { ...x, stage: s } : x)),
                          );
                          demo.setStatus(`Movido para ${s}.`);
                        }}
                      >
                        → {s}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
          </div>
        ))}
      </div>
    </DemoShell>
  );
}

const FIN_CFG: ToolDemoConfig = {
  id: "demo-financeiro",
  kind: "financeiro",
  title: "Simulador financeiro (demo)",
  classification: "B",
  maxItems: 30,
  seedVersion: 1,
  limitations: ["Cálculos locais", "Sem cobrança real", "Sem Asaas"],
};

export function DemoFinanceiro() {
  const demo = useToolDemoState(FIN_CFG, () => ({
    hours: 10,
    rate: 350,
    rows: DEMO_FINANCIAL_ROWS.map((r, index) => ({
      id: r.id,
      description: r.description,
      amount: 800 + index * 250,
      kind: r.status === "Paga" ? ("receita" as const) : ("despesa" as const),
    })),
  }));
  const honorarios = demo.state.hours * demo.state.rate;
  const receitas = demo.state.rows
    .filter((r) => r.kind === "receita")
    .reduce((s, r) => s + r.amount, 0);
  const despesas = demo.state.rows
    .filter((r) => r.kind === "despesa")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <DemoShell
      config={FIN_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-demo-split">
        <div className="vj-stack">
          <h4>Simulador de honorários</h4>
          <label className="vj-field">
            <span className="vj-label">Horas</span>
            <input
              className="vj-input"
              type="number"
              min={0}
              value={demo.state.hours}
              onChange={(e) =>
                demo.setState((s) => ({ ...s, hours: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="vj-field">
            <span className="vj-label">Valor/hora (R$)</span>
            <input
              className="vj-input"
              type="number"
              min={0}
              value={demo.state.rate}
              onChange={(e) =>
                demo.setState((s) => ({ ...s, rate: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <p>
            <strong>Estimativa: R$ {honorarios.toFixed(2)}</strong>
          </p>
          <p className="vj-hint">Simulação local — não gera cobrança.</p>
        </div>
        <div className="vj-stack">
          <h4>Fluxo de caixa demo</h4>
          <div className="vj-demo-bars">
            <div className="vj-demo-bar">
              <span>Receitas</span>
              <span className="vj-demo-bar-fill" style={{ width: `${Math.min(100, receitas / 50)}%` }} />
              <strong>R$ {receitas.toFixed(2)}</strong>
            </div>
            <div className="vj-demo-bar">
              <span>Despesas</span>
              <span
                className="vj-demo-bar-fill is-warn"
                style={{ width: `${Math.min(100, despesas / 50)}%` }}
              />
              <strong>R$ {despesas.toFixed(2)}</strong>
            </div>
            <div className="vj-demo-bar">
              <span>Saldo simulado</span>
              <strong>R$ {(receitas - despesas + honorarios).toFixed(2)}</strong>
            </div>
          </div>
          <Button
            type="button"
            className="vj-button-secondary"
            onClick={() => {
              if (!demo.assertLimit(demo.state.rows.length)) return;
              demo.setState((s) => ({
                ...s,
                rows: [
                  {
                    id: newId("fin"),
                    description: "Lançamento demonstrativo",
                    amount: 500,
                    kind: "receita",
                  },
                  ...s.rows,
                ],
              }));
              demo.setStatus("Lançamento fictício adicionado.");
            }}
          >
            Adicionar lançamento fictício
          </Button>
        </div>
      </div>
    </DemoShell>
  );
}

const REL_CFG: ToolDemoConfig = {
  id: "demo-relatorios",
  kind: "relatorios",
  title: "Relatórios dinâmicos (demo)",
  classification: "B",
  maxItems: 10,
  seedVersion: 1,
  limitations: ["Indicadores locais da sessão", "Sem dados de produção"],
};

export function DemoRelatorios() {
  const demo = useToolDemoState(REL_CFG, () => ({
    processos: DEMO_MATTERS.length,
    clientes: 4,
    tarefas: 6,
    receita: 12,
  }));

  const metrics = [
    { key: "processos", label: "Processos" },
    { key: "clientes", label: "Clientes" },
    { key: "tarefas", label: "Tarefas" },
    { key: "receita", label: "Receitas (índice)" },
  ] as const;

  return (
    <DemoShell
      config={REL_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-demo-bars">
        {metrics.map((m) => (
          <div key={m.key} className="vj-demo-bar">
            <div className="vj-inline-actions">
              <span>{m.label}</span>
              <Button
                type="button"
                className="vj-button-ghost"
                onClick={() => {
                  demo.setState((s) => ({ ...s, [m.key]: s[m.key] + 1 }));
                  demo.setStatus(`${m.label} incrementado na demo.`);
                }}
              >
                +1
              </Button>
            </div>
            <span
              className="vj-demo-bar-fill"
              style={{ width: `${Math.min(100, demo.state[m.key] * 8)}%` }}
            />
            <strong>{demo.state[m.key]}</strong>
          </div>
        ))}
      </div>
    </DemoShell>
  );
}

const AUTO_CFG: ToolDemoConfig = {
  id: "demo-automacao",
  kind: "automacao",
  title: "Construtor de fluxos (demo)",
  classification: "B",
  maxItems: 12,
  seedVersion: 1,
  limitations: ["Execução local apenas", "Não envia mensagens nem protocola"],
};

type Node = { id: string; type: "trigger" | "condition" | "action"; label: string };

export function DemoAutomacao() {
  const demo = useToolDemoState(AUTO_CFG, () => ({
    nodes: [
      { id: "n1", type: "trigger" as const, label: "Novo prazo criado" },
      { id: "n2", type: "condition" as const, label: "Urgência = alta" },
      { id: "n3", type: "action" as const, label: "Criar tarefa de revisão (simulado)" },
    ] as Node[],
    log: [] as string[],
  }));

  return (
    <DemoShell
      config={AUTO_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <div className="vj-stack">
        <ol className="vj-demo-flow">
          {demo.state.nodes.map((n, i) => (
            <li key={n.id} className="vj-demo-card">
              <span className="vj-meta">
                {i + 1}. {n.type}
              </span>
              <strong>{n.label}</strong>
            </li>
          ))}
        </ol>
        <div className="vj-inline-actions">
          <Button
            type="button"
            className="vj-button-secondary"
            onClick={() => {
              if (!demo.assertLimit(demo.state.nodes.length)) return;
              demo.setState((s) => ({
                ...s,
                nodes: [
                  ...s.nodes,
                  {
                    id: newId("node"),
                    type: "action",
                    label: "Notificar responsável (simulado)",
                  },
                ],
              }));
              demo.setStatus("Nó de ação adicionado.");
            }}
          >
            Adicionar ação
          </Button>
          <Button
            type="button"
            onClick={() => {
              const log = demo.state.nodes.map(
                (n, i) => `Passo ${i + 1}: executou ${n.type} — ${n.label} [simulado]`,
              );
              demo.setState((s) => ({ ...s, log }));
              demo.setStatus("Fluxo executado localmente.");
            }}
          >
            Executar fluxo
          </Button>
        </div>
        {demo.state.log.length > 0 ? (
          <ul className="vj-demo-panel">
            {demo.state.log.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </DemoShell>
  );
}
