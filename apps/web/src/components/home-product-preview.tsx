"use client";

import { useState } from "react";
import {
  DEMO_CLIENTS,
  DEMO_MATTERS,
  DEMO_TASKS,
  DEMO_VIEW_LABELS,
  DEMO_VIEWS,
  type DemoView,
} from "../lib/demo-data";
import { demoViewLabelKey } from "../lib/public-i18n";
import { useLocale } from "./locale-provider";

export function HomeProductPreview() {
  const { t } = useLocale();
  const [view, setView] = useState<DemoView>("painel");
  const viewLabel = t(demoViewLabelKey(view), DEMO_VIEW_LABELS[view]);

  return (
    <section className="vj-product-preview" aria-label={t("demo.previewAria")}>
      <p className="vj-demo-banner" role="status">
        {t("demo.banner")}
      </p>
      <div className="vj-product-preview-frame">
        <aside className="vj-product-preview-side" aria-hidden="true">
          <p className="vj-meta">{t("demo.organization")}</p>
          <ul className="vj-product-preview-nav">
            {DEMO_VIEWS.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className={item === view ? "is-current" : undefined}
                  onClick={() => setView(item)}
                >
                  {t(demoViewLabelKey(item), DEMO_VIEW_LABELS[item])}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="vj-product-preview-body">
          <h2 className="vj-section-title">{viewLabel}</h2>
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
              {t("demo.viewPlaceholder", undefined, { view: viewLabel.toLowerCase() })}
            </p>
          ) : null}
          <a className="vj-button vj-button-secondary" href={`/explorar?view=${view}`}>
            {t("demo.openFull")}
          </a>
        </div>
      </div>
    </section>
  );
}
