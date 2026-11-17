"use client";

import { Badge, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  createHomologationApproval,
  fetchHomologationReport,
  isApiFailure,
  platformAdminErrorMessage,
  recordSkuHomologationEvidence,
  revokeHomologationApproval,
  type HomologationReport,
} from "../../../../lib/platform-admin";

function resultTone(result: string): "success" | "error" | "warning" | "neutral" {
  if (result === "PASS") return "success";
  if (result === "FAIL") return "error";
  if (result === "NOT_VERIFIED") return "warning";
  return "neutral";
}

export default function AdminHomologacaoPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<HomologationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [skuCode, setSkuCode] = useState("AI_ASSISTENTE");
  const [checkKey, setCheckKey] = useState("e2e_sandbox_purchase");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchHomologationReport();
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      setReport(null);
    } else {
      setReport(res);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onApprove() {
    setBusy(true);
    setFlash(null);
    const res = await createHomologationApproval({ reason: approvalReason });
    setBusy(false);
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      return;
    }
    setFlash(res.envNote);
    setApprovalReason("");
    await reload();
  }

  async function onRevoke() {
    setBusy(true);
    setFlash(null);
    const res = await revokeHomologationApproval({ reason: revokeReason });
    setBusy(false);
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      return;
    }
    setFlash("Aprovação revogada. Checkout comercial permanece bloqueado.");
    setRevokeReason("");
    await reload();
  }

  async function onRecordEvidence() {
    setBusy(true);
    setFlash(null);
    const res = await recordSkuHomologationEvidence(skuCode.trim().toUpperCase(), {
      checkKey,
      result: "pass",
      notes: evidenceNotes || undefined,
      evidenceJson: { source: "admin_ui", recordedVia: "homologacao_page" },
    });
    setBusy(false);
    if (isApiFailure(res)) {
      setError(platformAdminErrorMessage(res));
      return;
    }
    setFlash(`Evidência ${res.evidence.checkKey} registrada para ${res.evidence.skuCode}.`);
    setEvidenceNotes("");
    await reload();
  }

  const checklist = report?.checklist;

  return (
    <div className="vj-stack">
      <PageHeader
        title="Homologação comercial"
        description="Checklist Asaas + evidências por SKU. PAYMENTS_LIVE=1 não libera compra sem aprovação DB."
      />

      {flash ? <p className="vj-hint">{flash}</p> : null}
      {loading ? <LoadingState label="Carregando homologação…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && checklist ? (
        <>
          <article className="vj-card vj-stack">
            <div className="vj-inline-actions" style={{ justifyContent: "space-between" }}>
              <strong>Estado da plataforma</strong>
              <Badge tone={resultTone(checklist.readyForLive ? "PASS" : "FAIL")}>
                {checklist.status}
              </Badge>
            </div>
            <p className="vj-meta">{checklist.note}</p>
            <p className="vj-hint">
              readyForLive={String(checklist.readyForLive)} · purchaseReady=
              {String(checklist.purchaseReady)} · PAYMENTS_LIVE=
              {checklist.paymentsLive ? "1" : "0"}
              {checklist.paymentsLiveInsufficientWithoutApproval
                ? " (env insuficiente sem aprovação)"
                : ""}
            </p>
            <p className="vj-hint">
              Required PASS {checklist.passedRequired}/{checklist.requiredTotal} · blocking:{" "}
              {checklist.blocking.join(", ") || "—"} · pending:{" "}
              {checklist.pendingVerification.join(", ") || "—"}
            </p>
            {checklist.activeApproval ? (
              <p className="vj-meta">
                Aprovação ativa: {checklist.activeApproval.id.slice(0, 8)}… até{" "}
                {checklist.activeApproval.validUntil
                  ? new Date(checklist.activeApproval.validUntil).toLocaleString("pt-BR")
                  : "sem expiração"}
              </p>
            ) : (
              <p className="vj-meta">Sem aprovação administrativa ativa.</p>
            )}
          </article>

          <section className="vj-stack">
            <h2 className="vj-card-title">Checks Asaas / pagamentos</h2>
            <div className="vj-admin-metrics">
              {checklist.checks.map((c) => (
                <article key={c.key} className="vj-card vj-stack">
                  <div className="vj-inline-actions" style={{ justifyContent: "space-between" }}>
                    <strong>{c.label}</strong>
                    <Badge tone={resultTone(c.result)}>{c.result}</Badge>
                  </div>
                  <p className="vj-hint">
                    {c.key}
                    {c.required ? " · required" : ""}
                  </p>
                  <p className="vj-meta">{c.evidence}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="vj-stack">
            <h2 className="vj-card-title">Pendências SKU</h2>
            {report?.skuSummary ? (
              <p className="vj-meta">
                Total {report.skuSummary.total} · ready {report.skuSummary.purchaseReady} · pending{" "}
                {report.skuSummary.pendingEvidence} · blocked {report.skuSummary.notHomologated}
              </p>
            ) : null}
            <div style={{ overflowX: "auto" }}>
              <table className="vj-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Status</th>
                    <th>Blocking</th>
                    <th>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {(report?.skus ?? [])
                    .filter((s) => !s.purchaseReady)
                    .slice(0, 40)
                    .map((s) => (
                      <tr key={s.sku}>
                        <td>
                          <code>{s.sku}</code>
                        </td>
                        <td>
                          <Badge tone={resultTone(s.purchaseReady ? "PASS" : "NOT_VERIFIED")}>
                            {s.status}
                          </Badge>
                        </td>
                        <td className="vj-hint">{s.blocking.join(", ") || "—"}</td>
                        <td className="vj-hint">{s.pendingVerification.join(", ") || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {(report?.skus ?? []).every((s) => s.purchaseReady) ? (
              <EmptyState title="SKUs">Nenhuma pendência de SKU no relatório.</EmptyState>
            ) : null}
          </section>

          <section className="vj-card vj-stack">
            <h2 className="vj-card-title">Registrar evidência SKU</h2>
            <label className="vj-stack">
              <span className="vj-meta">SKU</span>
              <input
                className="vj-input"
                value={skuCode}
                onChange={(e) => setSkuCode(e.target.value)}
              />
            </label>
            <label className="vj-stack">
              <span className="vj-meta">checkKey</span>
              <select
                className="vj-input"
                value={checkKey}
                onChange={(e) => setCheckKey(e.target.value)}
              >
                <option value="e2e_sandbox_purchase">e2e_sandbox_purchase</option>
                <option value="deliverability">deliverability</option>
              </select>
            </label>
            <label className="vj-stack">
              <span className="vj-meta">Notas</span>
              <textarea
                className="vj-input"
                rows={3}
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                placeholder="Descreva o teste sandbox / entregabilidade (sem segredos)."
              />
            </label>
            <button type="button" className="vj-button" disabled={busy} onClick={() => void onRecordEvidence()}>
              Registrar PASS
            </button>
          </section>

          <section className="vj-card vj-stack">
            <h2 className="vj-card-title">Aprovação / revogação live</h2>
            <p className="vj-hint">
              Não altera variáveis de ambiente. Ops ainda precisa de PAYMENTS_LIVE=1 para o adapter
              production.
            </p>
            <label className="vj-stack">
              <span className="vj-meta">Motivo da aprovação (≥12 chars)</span>
              <textarea
                className="vj-input"
                rows={3}
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="vj-button"
              disabled={busy || approvalReason.trim().length < 12}
              onClick={() => void onApprove()}
            >
              Aprovar liberação comercial
            </button>
            <label className="vj-stack">
              <span className="vj-meta">Motivo da revogação</span>
              <textarea
                className="vj-input"
                rows={2}
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="vj-button"
              disabled={busy || revokeReason.trim().length < 12 || !checklist.activeApproval}
              onClick={() => void onRevoke()}
            >
              Revogar aprovação
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}
