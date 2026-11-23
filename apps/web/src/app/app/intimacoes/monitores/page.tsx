"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  createMonitor,
  formatDate,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  listMonitors,
  listOabSuggestions,
  runMonitor,
  updateMonitor,
  type CourtMonitor,
} from "../../../../lib/court-communications";

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const RUN_LABEL: Record<
  CourtMonitor["lastRunStatus"],
  { label: string; tone: "success" | "warning" | "error" | "neutral" }
> = {
  never_run: { label: "Ainda não rodou", tone: "neutral" },
  ok: { label: "Em dia", tone: "success" },
  partial: { label: "Parcial", tone: "warning" },
  error: { label: "Falhou", tone: "error" },
};

type Suggestion = { membershipId: string; lawyerName: string; oabNumber: string; oabUf: string };

export default function MonitoresPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(true);
  const [items, setItems] = useState<CourtMonitor[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [lawyerName, setLawyerName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [oabUf, setOabUf] = useState("PB");

  const load = useCallback(async (activeId: string) => {
    const [monitors, oabs] = await Promise.all([
      listMonitors(activeId),
      listOabSuggestions(activeId),
    ]);
    setLoading(false);
    if (isApiFailure(monitors)) {
      setError(apiErrorMessage(monitors, "Não foi possível listar as OABs monitoradas."));
      return;
    }
    setItems(monitors.items);
    if (!isApiFailure(oabs)) {
      const taken = new Set(monitors.items.map((m) => `${m.oabNumber}/${m.oabUf}`));
      setSuggestions(oabs.items.filter((s) => !taken.has(`${s.oabNumber}/${s.oabUf}`)));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const manage = Boolean(
        membership?.permissions?.includes("judicial_process.manage_movements"),
      );
      setCanManage(manage);
      if (!manage) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId);
    })();
  }, [load]);

  async function add(input: {
    lawyerName: string;
    oabNumber: string;
    oabUf: string;
    membershipId?: string;
  }) {
    if (!orgId) return;
    setError(null);
    setNotice(null);
    const result = await createMonitor(orgId, input);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível cadastrar a OAB."));
      return;
    }
    setLawyerName("");
    setOabNumber("");
    setNotice(
      `OAB ${result.monitor.oabNumber}/${result.monitor.oabUf} cadastrada. Use “Capturar agora” para buscar os últimos 7 dias.`,
    );
    await load(orgId);
  }

  async function run(monitor: CourtMonitor) {
    if (!orgId) return;
    setBusyId(monitor.id);
    setError(null);
    setNotice(null);
    const result = await runMonitor(orgId, monitor.id);
    setBusyId(null);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível capturar agora."));
      return;
    }
    const r = result.result;
    if (r.status === "error") {
      setError(r.message ?? "A consulta ao DJEN falhou.");
    } else {
      setNotice(
        `${r.found} comunicações encontradas, ${r.created} novas${r.linked ? `, ${r.linked} vinculadas a processos` : ""}.${r.message ? ` ${r.message}` : ""}`,
      );
    }
    await load(orgId);
  }

  async function toggle(monitor: CourtMonitor) {
    if (!orgId) return;
    setBusyId(monitor.id);
    const result = await updateMonitor(orgId, monitor.id, { active: !monitor.active });
    setBusyId(null);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível atualizar."));
      return;
    }
    await load(orgId);
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Intimações", href: "/app/intimacoes" },
    { label: "OABs monitoradas" },
  ];

  if (!canManage) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <EmptyState title="Sem permissão">
          Apenas quem gerencia movimentações processuais pode cadastrar OABs.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="OABs monitoradas"
        description="Cada OAB cadastrada é consultada no DJEN duas vezes por dia. A consulta é pública e gratuita."
      />

      {notice ? (
        <Alert tone="success" title="Pronto">
          {notice}
        </Alert>
      ) : null}
      {error ? <ErrorState title="Atenção">{error}</ErrorState> : null}

      {suggestions.length > 0 ? (
        <section className="vj-card" aria-labelledby="sugestoes">
          <h2 id="sugestoes" className="vj-section-title">
            OABs da equipe ainda não monitoradas
          </h2>
          <ul className="vj-list">
            {suggestions.map((s) => (
              <li key={`${s.oabNumber}/${s.oabUf}`}>
                {s.lawyerName} · OAB {s.oabNumber}/{s.oabUf}{" "}
                <Button variant="secondary" onClick={() => void add(s)}>
                  Monitorar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="vj-card" aria-labelledby="nova">
        <h2 id="nova" className="vj-section-title">
          Cadastrar OAB
        </h2>
        <form
          className="vj-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void add({ lawyerName, oabNumber, oabUf });
          }}
        >
          <FormField id="ln" label="Advogado(a)">
            <Input
              id="ln"
              value={lawyerName}
              onChange={(e) => setLawyerName(e.target.value)}
              required
            />
          </FormField>
          <FormField id="on" label="Número da OAB">
            <Input
              id="on"
              inputMode="numeric"
              value={oabNumber}
              onChange={(e) => setOabNumber(e.target.value)}
              required
            />
          </FormField>
          <FormField id="ou" label="UF">
            <Select id="ou" value={oabUf} onChange={(e) => setOabUf(e.target.value)}>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </FormField>
          <button type="submit" className="vj-button vj-button-primary">
            Cadastrar
          </button>
        </form>
      </section>

      {loading ? <LoadingState label="Carregando OABs…" /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhuma OAB monitorada">
          Cadastre a OAB de cada advogado do escritório para receber as intimações automaticamente.
        </EmptyState>
      ) : null}

      {items.length > 0 ? (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th scope="col">Advogado(a)</th>
                <th scope="col">OAB</th>
                <th scope="col">Última captura</th>
                <th scope="col">Situação</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <td data-label="Advogado(a)">{m.lawyerName}</td>
                  <td data-label="OAB">
                    <span className="vj-technical">
                      {m.oabNumber}/{m.oabUf}
                    </span>
                  </td>
                  <td data-label="Última captura">
                    {m.lastRunAt ? new Date(m.lastRunAt).toLocaleString("pt-BR") : "—"}
                    <div className="vj-meta">
                      {m.capturedThrough ? `varrido até ${formatDate(m.capturedThrough)}` : ""}
                      {m.lastRunAt ? ` · ${m.lastRunCreated} novas` : ""}
                    </div>
                    {m.lastRunMessage ? <div className="vj-meta">{m.lastRunMessage}</div> : null}
                  </td>
                  <td data-label="Situação">
                    {m.active ? (
                      <Badge tone={RUN_LABEL[m.lastRunStatus].tone}>
                        {RUN_LABEL[m.lastRunStatus].label}
                      </Badge>
                    ) : (
                      <Badge>Pausado</Badge>
                    )}
                  </td>
                  <td data-label="Ações">
                    <div className="vj-form-actions">
                      <Button
                        variant="secondary"
                        onClick={() => void run(m)}
                        loading={busyId === m.id}
                        loadingLabel="Capturando"
                        disabled={!m.active}
                      >
                        Capturar agora
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void toggle(m)}
                        disabled={busyId === m.id}
                      >
                        {m.active ? "Pausar" : "Retomar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
