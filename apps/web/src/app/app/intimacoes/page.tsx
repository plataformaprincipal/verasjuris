"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  formatDate,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  listCommunications,
  STATUS_LABEL,
  STATUS_TONE,
  type CommunicationList,
  type CommunicationStatus,
} from "../../../lib/court-communications";

const TABS: Array<{ key: CommunicationStatus | ""; label: string }> = [
  { key: "new", label: "Novas" },
  { key: "linked", label: "Vinculadas" },
  { key: "triaged", label: "Triadas" },
  { key: "dismissed", label: "Descartadas" },
  { key: "", label: "Todas" },
];

export default function IntimacoesPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [data, setData] = useState<CommunicationList | null>(null);
  const [status, setStatus] = useState<CommunicationStatus | "">("new");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type Filters = { status: CommunicationStatus | ""; q: string; from: string; to: string };

  const load = useCallback(async (activeId: string, nextPage: number, filters: Filters) => {
    setLoading(true);
    setError(null);
    const result = await listCommunications(activeId, {
      status: filters.status || undefined,
      q: filters.q || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: nextPage,
    });
    setLoading(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível listar as intimações."));
      return;
    }
    setData(result);
    setPage(nextPage);
  }, []);

  const current = (): Filters => ({ status, q, from, to });

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const permissions = membership?.permissions ?? [];
      const readable = permissions.includes("judicial_process.read");
      setCanRead(readable);
      setCanManage(permissions.includes("judicial_process.manage_movements"));
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId, 1, { status: "new", q: "", from: "", to: "" });
    })();
  }, [load]);

  if (!canRead) {
    return (
      <EmptyState title="Sem permissão">
        Você não tem acesso às intimações desta organização.
      </EmptyState>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Intimações" }]} />
      <PageHeader
        title="Intimações"
        description="Comunicações capturadas no Diário de Justiça Eletrônico Nacional (DJEN) pelas OABs monitoradas."
        actions={
          canManage ? (
            <ButtonLink href="/app/intimacoes/monitores" variant="secondary">
              OABs monitoradas
            </ButtonLink>
          ) : undefined
        }
      />

      <Alert tone="info" title="Sugestões, não decisões">
        A captura roda duas vezes por dia. Categoria, providência e prazo são sugeridos por regras
        do CPC e da CLT e contados com feriados nacionais e o recesso forense. Feriados locais e
        portarias do tribunal não entram: confirme cada prazo antes de validar.
      </Alert>

      <nav className="vj-view-toggle" aria-label="Situação das intimações">
        {TABS.map((tab) => {
          const count = tab.key && data ? data.counts[tab.key] : undefined;
          const active = status === tab.key;
          return (
            <button
              key={tab.label}
              type="button"
              className={active ? "vj-button vj-button-primary" : "vj-button vj-button-ghost"}
              aria-pressed={active}
              onClick={() => {
                setStatus(tab.key);
                if (orgId) void load(orgId, 1, { ...current(), status: tab.key });
              }}
            >
              {tab.label}
              {count !== undefined ? ` (${count})` : ""}
            </button>
          );
        })}
      </nav>

      <form
        className="vj-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (orgId) void load(orgId, 1, current());
        }}
      >
        <FormField id="q" label="Buscar" hint="Número do processo, vara ou trecho do texto">
          <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} />
        </FormField>
        <FormField id="from" label="Disponibilizada de">
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FormField>
        <FormField id="to" label="até">
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FormField>
        <button type="submit" className="vj-button vj-button-secondary">
          Filtrar
        </button>
      </form>

      {loading ? <LoadingState label="Carregando intimações…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {!loading && data && data.items.length === 0 ? (
        <EmptyState title="Nenhuma intimação neste filtro">
          {canManage
            ? "Cadastre as OABs do escritório em “OABs monitoradas” para começar a captura."
            : "Peça a um administrador para cadastrar as OABs do escritório."}
        </EmptyState>
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th scope="col">Disponibilizada</th>
                <th scope="col">Processo</th>
                <th scope="col">Tribunal / órgão</th>
                <th scope="col">Sugestão</th>
                <th scope="col">Prazo sugerido</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Disponibilizada">{formatDate(item.availableOn)}</td>
                  <td data-label="Processo">
                    <a href={`/app/intimacoes/${item.id}`}>
                      <span className="vj-technical">
                        {item.processNumberMasked ?? "Sem número"}
                      </span>
                    </a>
                    <div className="vj-meta">{item.preview.slice(0, 120)}</div>
                  </td>
                  <td data-label="Tribunal / órgão">
                    {item.tribunal ?? "—"}
                    <div className="vj-meta">{item.courtBody ?? ""}</div>
                  </td>
                  <td data-label="Sugestão">{item.suggestedAction ?? "—"}</td>
                  <td data-label="Prazo sugerido">
                    {item.suggestedDueOn ? (
                      <>
                        {formatDate(item.suggestedDueOn)}
                        <div className="vj-meta">{item.suggestedDays} dias úteis</div>
                      </>
                    ) : (
                      <span className="vj-meta">sem contagem</span>
                    )}
                  </td>
                  <td data-label="Situação">
                    <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && totalPages > 1 ? (
        <div className="vj-form-actions">
          <button
            type="button"
            className="vj-button vj-button-secondary"
            disabled={page <= 1}
            onClick={() => orgId && void load(orgId, page - 1, current())}
          >
            Anterior
          </button>
          <span className="vj-meta">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className="vj-button vj-button-secondary"
            disabled={page >= totalPages}
            onClick={() => orgId && void load(orgId, page + 1, current())}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}
