"use client";

import { useState } from "react";
import {
  DEMO_BANNER,
  DEMO_CLIENTS,
  DEMO_MATTERS,
  DEMO_ORGANIZATION,
  DEMO_TASKS,
  DEMO_VIEW_LABELS,
  DEMO_VIEWS,
  type DemoView,
} from "../lib/demo-data";

export function HomeProductPreview() {
  const [view, setView] = useState<DemoView>("painel");

  return (
    <div className="vj-product-preview" aria-label="Prévia visual do ambiente VerasJuris">
      <p className="vj-demo-banner" role="status">
        {DEMO_BANNER}
      </p>
      <div className="vj-product-preview-frame">
        <aside className="vj-product-preview-side" aria-hidden="true">
          <p className="vj-meta">{DEMO_ORGANIZATION}</p>
          <ul className="vj-product-preview-nav">
            {DEMO_VIEWS.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={item === view ? "is-current" : undefined}
                  onClick={() => setView(item)}
                >
                  {DEMO_VIEW_LABELS[item]}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="vj-product-preview-body">
          <h2 className="vj-section-title">{DEMO_VIEW_LABELS[view]}</h2>
          {view === "painel" || view === "processos" ? (
            <ul className="vj-preview-list">
              {DEMO_MATTERS.slice(0, 3).map((matter) => (
                <li key={matter.id}>
                  <strong>{matter.title}</strong>
                  <span className="vj-meta">
                    {matter.area} · {matter.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {view === "clientes" ? (
            <ul className="vj-preview-list">
              {DEMO_CLIENTS.map((client) => (
                <li key={client.id}>
                  <strong>{client.name}</strong>
                  <span className="vj-meta">{client.kind}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {view === "tarefas" || view === "agenda" ? (
            <ul className="vj-preview-list">
              {DEMO_TASKS.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  <span className="vj-meta">
                    {task.due} · {task.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {view === "documentos" || view === "financeiro" || view === "marketplace" ? (
            <p className="vj-lead">
              Visualização demonstrativa de {DEMO_VIEW_LABELS[view].toLowerCase()}. Abra a
              demonstração completa para navegar com mais detalhes.
            </p>
          ) : null}
          <a className="vj-button vj-button-secondary" href={`/explorar?view=${view}`}>
            Abrir demonstração interativa
          </a>
        </div>
      </div>
    </div>
  );
}
