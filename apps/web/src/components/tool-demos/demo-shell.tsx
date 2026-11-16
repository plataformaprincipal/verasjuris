"use client";

import { Alert, Button } from "@verasjuris/ui";
import type { ReactNode } from "react";
import type { ToolDemoConfig } from "../../lib/tool-demos/types";
import { useLocale } from "../locale-provider";

export function DemoShell({
  config,
  status,
  error,
  onReset,
  onUndo,
  canUndo,
  children,
}: {
  config: ToolDemoConfig;
  status: string;
  error: string | null;
  onReset: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  children: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section className="vj-demo-shell" aria-label={config.title}>
      <div className="vj-demo-banner" role="status">
        <strong>{t("showroom.demo.banner", "Modo demonstração")}</strong>
        <span>
          {t(
            "showroom.demo.bannerBody",
            "Dados fictícios. Nenhuma operação real, cobrança ou envio externo.",
          )}
        </span>
        <span className="vj-demo-class">
          {t("showroom.demo.class", "Classe")}: {config.classification}
        </span>
      </div>
      <div className="vj-demo-toolbar">
        <h3 className="vj-subtitle">{config.title}</h3>
        <div className="vj-inline-actions">
          {onUndo ? (
            <Button type="button" className="vj-button-secondary" disabled={!canUndo} onClick={onUndo}>
              {t("showroom.demo.undo", "Desfazer")}
            </Button>
          ) : null}
          <Button type="button" className="vj-button-secondary" onClick={onReset}>
            {t("showroom.demo.reset", "Reiniciar")}
          </Button>
        </div>
      </div>
      {error ? (
        <Alert tone="error" title={t("common.error", "Erro")}>
          {error}
        </Alert>
      ) : null}
      <p className="vj-meta" aria-live="polite">
        {status}
      </p>
      <div className="vj-demo-stage">{children}</div>
      <footer className="vj-demo-limits">
        <h4 className="vj-meta">{t("showroom.demo.limits", "Limitações desta demonstração")}</h4>
        <ul>
          {config.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </footer>
    </section>
  );
}
