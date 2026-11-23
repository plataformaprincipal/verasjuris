"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  apiErrorMessage,
  catalog as fetchCatalog,
  deadlineText,
  getActiveOrgId,
  isApiFailure,
  type Catalog,
} from "../../../lib/admin-procedures";

export default function ProcedimentosPage() {
  const [data, setData] = useState<Catalog | null>(null);
  const [agency, setAgency] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const orgId = await getActiveOrgId();
      if (!orgId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const result = await fetchCatalog(orgId);
      setLoading(false);
      if (isApiFailure(result)) {
        setError(apiErrorMessage(result, "Não foi possível carregar o catálogo."));
        return;
      }
      setData(result);
    })();
  }, []);

  const procedures = (data?.procedures ?? []).filter((p) => !agency || p.agencyCode === agency);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Painel", href: "/app" }, { label: "Órgãos e procedimentos" }]}
      />
      <PageHeader
        title="Órgãos e procedimentos"
        description="Onde e como protocolar em cada órgão, com documentos e prazos legais."
      />
      <Alert tone="info" title="Protocolo manual orientado">
        O protocolo é feito no portal oficial. Para registrar, abra o processo administrativo do
        caso e use “Protocolo orientado”: o registro exige o comprovante anexado. Prazos sem fonte
        conferida aparecem como “prazo na notificação”.
      </Alert>
      {loading ? <LoadingState label="Carregando catálogo…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {data ? (
        <FormField id="ag" label="Órgão">
          <Select id="ag" value={agency} onChange={(e) => setAgency(e.target.value)}>
            <option value="">Todos</option>
            {data.agencies.map((a) => (
              <option key={a.code} value={a.code}>
                {a.acronym} — {a.name}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      {data && procedures.length === 0 ? (
        <EmptyState title="Nenhum procedimento">Sem procedimentos para este órgão.</EmptyState>
      ) : null}
      {procedures.map((p) => (
        <section key={p.key} className="vj-card" aria-labelledby={`p-${p.key}`}>
          <h2 id={`p-${p.key}`} className="vj-section-title">
            {p.name} <Badge>{p.agencyCode}</Badge>
          </h2>
          <p>{p.summary}</p>
          <p>
            <a href={p.portalUrl} target="_blank" rel="noreferrer">
              {p.portalName}
            </a>
          </p>
          <div className="vj-split">
            <div>
              <strong>Passo a passo</strong>
              <ol>
                {p.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <strong>Documentos</strong>
              <ul className="vj-list">
                {p.documents.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Prazos</strong>
              <ul className="vj-list">
                {p.deadlines.map((r) => (
                  <li key={r.key}>
                    {r.label}: {deadlineText(r)}{" "}
                    <Badge tone={r.actor === "party" ? "warning" : "neutral"}>
                      {r.actor === "party" ? "do escritório" : "do órgão"}
                    </Badge>
                    <div className="vj-meta">{r.basis}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
