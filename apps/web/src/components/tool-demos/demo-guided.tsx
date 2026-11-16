"use client";

import { Alert, Button } from "@verasjuris/ui";
import { useState } from "react";
import { DEMO_MARKETPLACE_SERVICES } from "../../lib/demo-data";
import { newId, useToolDemoState } from "../../lib/tool-demos/engine";
import type { ToolDemoConfig } from "../../lib/tool-demos/types";
import { DemoShell } from "./demo-shell";

const PREV_CFG: ToolDemoConfig = {
  id: "demo-previdenciario",
  kind: "previdenciario",
  title: "Calculadora previdenciária ilustrativa",
  classification: "C",
  maxItems: 5,
  seedVersion: 1,
  limitations: [
    "Operação matemática ilustrativa",
    "Não é resultado oficial do INSS",
    "Exige conferência profissional e premissas normativas atualizadas",
  ],
};

export function DemoPrevidenciario() {
  const demo = useToolDemoState(PREV_CFG, () => ({
    months: 120,
    monthlyBase: 2000,
    factor: 0.6,
  }));
  const estimate = demo.state.months * demo.state.monthlyBase * (demo.state.factor / 120);

  return (
    <DemoShell
      config={PREV_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <Alert tone="warning" title="Prévia ilustrativa">
        Premissa demonstrativa: (meses × base × fator) / 120. Não substitui cálculo oficial do
        INSS nem análise de tempo de contribuição.
      </Alert>
      <div className="vj-inicio-filters">
        <label className="vj-field">
          <span className="vj-label">Meses (ilustrativo)</span>
          <input
            className="vj-input"
            type="number"
            min={1}
            value={demo.state.months}
            onChange={(e) =>
              demo.setState((s) => ({ ...s, months: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="vj-field">
          <span className="vj-label">Base mensal (R$)</span>
          <input
            className="vj-input"
            type="number"
            min={0}
            value={demo.state.monthlyBase}
            onChange={(e) =>
              demo.setState((s) => ({ ...s, monthlyBase: Number(e.target.value) || 0 }))
            }
          />
        </label>
        <label className="vj-field">
          <span className="vj-label">Fator ilustrativo</span>
          <input
            className="vj-input"
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={demo.state.factor}
            onChange={(e) =>
              demo.setState((s) => ({ ...s, factor: Number(e.target.value) || 0 }))
            }
          />
        </label>
      </div>
      <p>
        <strong>Estimativa ilustrativa: R$ {estimate.toFixed(2)}</strong>
      </p>
      <p className="vj-hint">Competência normativa e regras reais não estão aplicadas nesta demo.</p>
    </DemoShell>
  );
}

const MKT_CFG: ToolDemoConfig = {
  id: "demo-marketplace",
  kind: "marketplace",
  title: "Marketplace (demo)",
  classification: "B",
  maxItems: 10,
  seedVersion: 1,
  limitations: ["Catálogo fictício", "Sem cobrança", "Sem contratação real"],
};

export function DemoMarketplace() {
  const demo = useToolDemoState(MKT_CFG, () => ({
    q: "",
    cart: [] as Array<{ id: string; title: string; priceNote: string }>,
    orders: [] as Array<{ id: string; title: string; status: string }>,
  }));
  const items = DEMO_MARKETPLACE_SERVICES.filter(
    (s) => !demo.state.q || s.title.toLowerCase().includes(demo.state.q.toLowerCase()),
  );

  return (
    <DemoShell
      config={MKT_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
      onUndo={demo.undo}
      canUndo={demo.canUndo}
    >
      <input
        className="vj-input"
        placeholder="Filtrar serviços fictícios"
        value={demo.state.q}
        onChange={(e) => demo.setState((s) => ({ ...s, q: e.target.value }))}
      />
      <div className="vj-inicio-grid">
        {items.map((s) => (
          <article key={s.id} className="vj-demo-card">
            <strong>{s.title}</strong>
            <p className="vj-meta">{s.priceNote}</p>
            <Button
              type="button"
              onClick={() => {
                if (!demo.assertLimit(demo.state.cart.length)) return;
                demo.setState((st) => ({
                  ...st,
                  cart: [
                    ...st.cart,
                    { id: s.id, title: s.title, priceNote: s.priceNote },
                  ],
                }));
                demo.setStatus("Item fictício no carrinho.");
              }}
            >
              Adicionar
            </Button>
          </article>
        ))}
      </div>
      <div className="vj-demo-panel vj-stack">
        <h4>Carrinho demo ({demo.state.cart.length})</h4>
        <ul>
          {demo.state.cart.map((c) => (
            <li key={`${c.id}-${c.title}`}>
              {c.title} · {c.priceNote}
            </li>
          ))}
        </ul>
        <Button
          type="button"
          disabled={demo.state.cart.length === 0}
          onClick={() => {
            const first = demo.state.cart[0];
            if (!first) return;
            demo.setState((s) => ({
              cart: [],
              q: s.q,
              orders: [
                {
                  id: newId("ord"),
                  title: first.title,
                  status: "Pedido fictício — aguardando (demo)",
                },
                ...s.orders,
              ],
            }));
            demo.setStatus("Pedido fictício criado. Nenhuma cobrança.");
          }}
        >
          Simular pedido (sem pagamento)
        </Button>
        {demo.state.orders.length > 0 ? (
          <ul>
            {demo.state.orders.map((o) => (
              <li key={o.id}>
                {o.id.slice(0, 8)} — {o.title}: {o.status}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DemoShell>
  );
}

const IA_CFG: ToolDemoConfig = {
  id: "demo-ia",
  kind: "ia",
  title: "IA jurídica — cenários preparados",
  classification: "C",
  maxItems: 5,
  seedVersion: 1,
  limitations: [
    "Respostas pré-definidas",
    "Não há análise de IA em tempo real nesta demonstração",
    "Revisão profissional obrigatória no produto real",
  ],
};

const IA_SCENARIOS = [
  {
    id: "s1",
    label: "Resumo de petição (exemplo)",
    input: "Petição inicial trabalhista com pedidos de verbas rescisórias…",
    output:
      "Resumo preparado: pedidos principais, partes e possíveis pontos de atenção. (Texto pré-definido — não gerado por modelo neste momento.)",
  },
  {
    id: "s2",
    label: "Organização de cláusulas (exemplo)",
    input: "Contrato com cláusulas de confidencialidade e SLA…",
    output:
      "Organização preparada: cláusulas agrupadas por tema e checklist de revisão. (Cenário preparado.)",
  },
  {
    id: "s3",
    label: "Lista de documentos faltantes (exemplo)",
    input: "Pasta do caso previdenciário incompleta…",
    output:
      "Sugestão preparada de documentos a conferir. (Não constitui análise oficial.)",
  },
];

export function DemoIa() {
  const demo = useToolDemoState(IA_CFG, () => ({ scenarioId: IA_SCENARIOS[0]!.id }));
  const scenario = IA_SCENARIOS.find((s) => s.id === demo.state.scenarioId) ?? IA_SCENARIOS[0]!;

  return (
    <DemoShell
      config={IA_CFG}
      status={demo.status}
      error={demo.error}
      onReset={demo.reset}
    >
      <Alert tone="info" title="Resposta preparada">
        Esta demonstração exibe entradas e saídas previamente definidas. Não afirma análise por IA
        em tempo real.
      </Alert>
      <label className="vj-field">
        <span className="vj-label">Cenário</span>
        <select
          className="vj-input"
          value={demo.state.scenarioId}
          onChange={(e) => {
            demo.setState({ scenarioId: e.target.value });
            demo.setStatus("Cenário preparado carregado.");
          }}
        >
          {IA_SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="vj-demo-split">
        <div className="vj-demo-panel">
          <h4>Entrada (exemplo)</h4>
          <pre className="vj-demo-preview">{scenario.input}</pre>
        </div>
        <div className="vj-demo-panel">
          <h4>Saída preparada</h4>
          <pre className="vj-demo-preview">{scenario.output}</pre>
        </div>
      </div>
    </DemoShell>
  );
}

const INT_CFG: ToolDemoConfig = {
  id: "demo-integracoes",
  kind: "integracoes",
  title: "Fluxo de integrações (prévia)",
  classification: "C",
  maxItems: 6,
  seedVersion: 1,
  limitations: [
    "Simulação visual de conexão",
    "Nenhuma integração ativa nesta demo",
    "Erros são ilustrativos",
  ],
};

const STEPS = [
  { id: "1", label: "Selecionar provedor", ok: true },
  { id: "2", label: "Informar credenciais (não coletadas aqui)", ok: true },
  { id: "3", label: "Testar conexão", ok: false },
  { id: "4", label: "Sincronizar", ok: false },
];

export function DemoIntegracoes() {
  const [step, setStep] = useState(0);
  const [errorMode, setErrorMode] = useState(false);
  const demo = useToolDemoState(INT_CFG, () => ({ step: 0 }));

  return (
    <DemoShell
      config={INT_CFG}
      status={demo.status}
      error={demo.error}
      onReset={() => {
        setStep(0);
        setErrorMode(false);
        demo.reset();
      }}
    >
      <Alert tone="warning" title="Prévia guiada">
        Nenhuma conexão fictícia é apresentada como integração ativa.
      </Alert>
      <ol className="vj-demo-flow">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
            className={
              i === step ? "vj-demo-card is-active" : i < step ? "vj-demo-card is-done" : "vj-demo-card"
            }
          >
            <strong>
              {i + 1}. {s.label}
            </strong>
            {i === step && errorMode ? (
              <p className="vj-meta">Erro ilustrativo: credenciais inválidas / timeout.</p>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="vj-inline-actions">
        <Button
          type="button"
          disabled={step >= STEPS.length - 1}
          onClick={() => {
            setErrorMode(false);
            setStep((s) => Math.min(STEPS.length - 1, s + 1));
            demo.setStatus("Avançou etapa ilustrativa.");
          }}
        >
          Avançar
        </Button>
        <Button
          type="button"
          className="vj-button-secondary"
          onClick={() => {
            setErrorMode(true);
            demo.setStatus("Estado de erro ilustrativo.");
          }}
        >
          Simular erro
        </Button>
      </div>
    </DemoShell>
  );
}
