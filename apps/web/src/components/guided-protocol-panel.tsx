"use client";

import { Alert, Badge, Button, FormField, Input, Select } from "@verasjuris/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiErrorMessage,
  catalog as fetchCatalog,
  deadlineText,
  formatDate,
  getActiveMembership,
  getActiveOrgId,
  guidedProtocol,
  isApiFailure,
  type GuidedProtocol,
  type Procedure,
} from "../lib/admin-procedures";
import { fetchDocuments } from "../lib/documents";

/**
 * Protocolo manual orientado: escolhe o procedimento do órgão, mostra onde e
 * como protocolar, planeja os prazos e registra o protocolo com comprovante.
 */
export function GuidedProtocolPanel({
  processId,
  agencyCode,
  onChanged,
}: {
  processId: string;
  agencyCode: string | null;
  onChanged?: () => void;
}) {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [history, setHistory] = useState<GuidedProtocol[]>([]);
  const [documents, setDocuments] = useState<Array<{ id: string; title: string }>>([]);
  const [startDate, setStartDate] = useState("");
  const [protocolNumber, setProtocolNumber] = useState("");
  const [protocolDate, setProtocolDate] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (activeId: string) => {
      const [cat, hist, docs] = await Promise.all([
        fetchCatalog(activeId),
        guidedProtocol.list(activeId, processId),
        fetchDocuments(activeId, {
          ownerType: "administrative_process",
          ownerId: processId,
          limit: 100,
        }),
      ]);
      if (!isApiFailure(cat)) {
        const fits = cat.procedures.filter(
          (p) =>
            p.agencyCode === agencyCode ||
            (p.agencyCode.startsWith("PROCON") && agencyCode?.startsWith("PROCON")) ||
            (p.agencyCode.startsWith("DETRAN") && agencyCode?.startsWith("DETRAN")),
        );
        setProcedures(fits);
        setSelectedKey((current) => current || fits[0]?.key || "");
      }
      if (!isApiFailure(hist)) setHistory(hist.items);
      if (!isApiFailure(docs)) setDocuments(docs.items.map((d) => ({ id: d.id, title: d.title })));
    },
    [processId, agencyCode],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) return;
      setOrgId(activeId);
      setCanManage(
        Boolean(membership?.permissions?.includes("administrative_process.manage_requests")),
      );
      await load(activeId);
    })();
  }, [load]);

  const procedure = useMemo(
    () => procedures.find((p) => p.key === selectedKey),
    [procedures, selectedKey],
  );
  const partyRules = procedure?.deadlines.filter((r) => r.actor === "party" && r.days) ?? [];

  async function plan() {
    if (!orgId || !procedure) return;
    setBusy(true);
    setError(null);
    const result = await guidedProtocol.plan(orgId, processId, {
      procedureKey: procedure.key,
      startDate,
    });
    setBusy(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível planejar o procedimento."));
      return;
    }
    setNotice(
      `Criados ${result.deadlineIds.length} prazo(s) sugerido(s) e uma tarefa com o passo a passo.`,
    );
    onChanged?.();
  }

  async function register() {
    if (!orgId || !procedure) return;
    setBusy(true);
    setError(null);
    const result = await guidedProtocol.register(orgId, processId, {
      procedureKey: procedure.key,
      protocolNumber,
      protocolDate,
      receiptDocumentId: receiptId,
    });
    setBusy(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível registrar o protocolo."));
      return;
    }
    setNotice(`Protocolo ${result.request.protocolNumber} registrado com comprovante.`);
    setProtocolNumber("");
    setReceiptId("");
    await load(orgId);
    onChanged?.();
  }

  if (procedures.length === 0) {
    return (
      <section className="vj-card" aria-labelledby="gp-title">
        <h2 id="gp-title" className="vj-section-title">
          Protocolo orientado
        </h2>
        <p className="vj-meta">
          Ainda não há procedimentos catalogados para este órgão. Registre o protocolo manualmente
          em “Requerimentos”.
        </p>
      </section>
    );
  }

  return (
    <section className="vj-card" aria-labelledby="gp-title">
      <h2 id="gp-title" className="vj-section-title">
        Protocolo orientado
      </h2>
      <p className="vj-meta">
        O protocolo é feito por você no portal do órgão. Aqui ficam o passo a passo, os documentos,
        os prazos e o registro com comprovante. Sem comprovante anexado, o protocolo não é
        registrado.
      </p>

      {notice ? (
        <Alert tone="success" title="Pronto">
          {notice}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" title="Atenção">
          {error}
        </Alert>
      ) : null}

      <FormField id="gp-proc" label="Procedimento">
        <Select id="gp-proc" value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
          {procedures.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      {procedure ? (
        <div className="vj-stack">
          <p>{procedure.summary}</p>
          <p>
            <a href={procedure.portalUrl} target="_blank" rel="noreferrer">
              Abrir {procedure.portalName}
            </a>
          </p>
          <div>
            <strong>Passo a passo</strong>
            <ol>
              {procedure.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div>
            <strong>Documentos</strong>
            <ul className="vj-list">
              {procedure.documents.map((doc) => (
                <li key={doc}>{doc}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Prazos</strong>
            <ul className="vj-list">
              {procedure.deadlines.map((rule) => (
                <li key={rule.key}>
                  {rule.label}: {deadlineText(rule)}{" "}
                  <Badge tone={rule.actor === "party" ? "warning" : "neutral"}>
                    {rule.actor === "party" ? "do escritório" : "do órgão"}
                  </Badge>
                  <div className="vj-meta">{rule.basis}</div>
                </li>
              ))}
            </ul>
          </div>

          {canManage && partyRules.length > 0 ? (
            <form
              className="vj-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void plan();
              }}
            >
              <FormField id="gp-start" label={`Data de ${partyRules[0]?.startsFrom ?? "início"}`}>
                <Input
                  id="gp-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </FormField>
              <Button type="submit" variant="secondary" disabled={!startDate || busy}>
                Criar prazos e tarefa
              </Button>
            </form>
          ) : null}

          {canManage ? (
            <form
              className="vj-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void register();
              }}
            >
              <strong>Registrar protocolo feito</strong>
              <FormField id="gp-num" label="Número do protocolo">
                <Input
                  id="gp-num"
                  value={protocolNumber}
                  onChange={(e) => setProtocolNumber(e.target.value)}
                  required
                />
              </FormField>
              <FormField id="gp-date" label="Data do protocolo">
                <Input
                  id="gp-date"
                  type="date"
                  value={protocolDate}
                  onChange={(e) => setProtocolDate(e.target.value)}
                  required
                />
              </FormField>
              <FormField
                id="gp-receipt"
                label="Comprovante"
                hint="Envie o PDF do comprovante em Documentos deste processo e selecione aqui."
              >
                <Select
                  id="gp-receipt"
                  value={receiptId}
                  onChange={(e) => setReceiptId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="vj-form-actions">
                <Button
                  type="submit"
                  loading={busy}
                  disabled={!protocolNumber || !protocolDate || !receiptId}
                >
                  Registrar protocolo
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {history.length > 0 ? (
        <div>
          <strong>Protocolos registrados</strong>
          <ul className="vj-list">
            {history.map((h) => (
              <li key={h.id}>
                {h.procedureName} · nº <span className="vj-technical">{h.protocolNumber}</span> ·{" "}
                {formatDate(h.submittedAt)} <Badge tone="success">com comprovante</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
