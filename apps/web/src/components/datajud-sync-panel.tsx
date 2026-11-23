"use client";

import { Alert, Button } from "@verasjuris/ui";
import { useState } from "react";
import {
  apiErrorMessage,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  syncProcessFromDatajud,
} from "../lib/court-communications";

type Outcome =
  | { kind: "ok"; created: number; summary: string }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string };

/** Botão "Atualizar pelo Datajud" com o resultado inline. */
export function DatajudSyncPanel({
  processId,
  onSynced,
}: {
  processId: string;
  onSynced?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function sync() {
    setBusy(true);
    setOutcome(null);
    const [orgId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
    if (!orgId) {
      setOutcome({ kind: "error", message: "Nenhuma organização ativa." });
      setBusy(false);
      return;
    }
    if (!membership?.permissions?.includes("judicial_process.manage_movements")) {
      setOutcome({
        kind: "error",
        message: "Você não tem permissão para atualizar movimentações.",
      });
      setBusy(false);
      return;
    }
    const result = await syncProcessFromDatajud(orgId, processId);
    setBusy(false);
    if (isApiFailure(result)) {
      setOutcome({
        kind: "error",
        message: apiErrorMessage(result, "Não foi possível consultar o Datajud."),
      });
      return;
    }
    if (!result.found) {
      setOutcome({
        kind: "empty",
        message: result.message ?? "Processo não encontrado no Datajud.",
      });
      return;
    }
    const first = result.records[0];
    const summary = result.records
      .map(
        (r) =>
          `${r.tribunal} ${r.degree ?? ""} · ${r.className ?? "classe não informada"} · ${r.movements} movimentações`,
      )
      .join("; ");
    setOutcome({
      kind: "ok",
      created: result.created,
      summary: first?.courtBody ? `${summary}. Órgão: ${first.courtBody}.` : summary,
    });
    if (result.created > 0) onSynced?.();
  }

  return (
    <section className="vj-card" aria-labelledby="datajud-title">
      <h2 id="datajud-title" className="vj-section-title">
        Datajud (CNJ)
      </h2>
      <p className="vj-meta">
        Importa classe, assuntos, órgão julgador e movimentações da base pública do CNJ. Não traz
        partes, advogados nem documentos. Movimentações já importadas não se repetem.
      </p>
      <div className="vj-form-actions">
        <Button
          variant="secondary"
          onClick={() => void sync()}
          loading={busy}
          loadingLabel="Consultando"
        >
          Atualizar pelo Datajud
        </Button>
      </div>
      {outcome?.kind === "ok" ? (
        <Alert
          tone="success"
          title={
            outcome.created === 1 ? "1 movimentação nova" : `${outcome.created} movimentações novas`
          }
        >
          {outcome.summary}
        </Alert>
      ) : null}
      {outcome?.kind === "empty" ? (
        <Alert tone="info" title="Sem registro no Datajud">
          {outcome.message}
        </Alert>
      ) : null}
      {outcome?.kind === "error" ? (
        <Alert tone="error" title="Não foi possível atualizar">
          {outcome.message}
        </Alert>
      ) : null}
    </section>
  );
}
