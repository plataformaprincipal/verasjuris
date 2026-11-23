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
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  formatDate,
  getActiveMembership,
  getActiveOrgId,
  inpi,
  isApiFailure,
  type InpiDispatch,
  type InpiMonitors,
} from "../../../lib/admin-procedures";

const STATUS: Record<
  InpiDispatch["status"],
  { label: string; tone: "warning" | "success" | "neutral" }
> = {
  new: { label: "A triar", tone: "warning" },
  triaged: { label: "Triado", tone: "success" },
  dismissed: { label: "Descartado", tone: "neutral" },
};

export default function InpiPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [monitors, setMonitors] = useState<InpiMonitors | null>(null);
  const [dispatches, setDispatches] = useState<InpiDispatch[]>([]);
  const [filter, setFilter] = useState<"new" | "">("new");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processNumber, setProcessNumber] = useState("");
  const [label, setLabel] = useState("");
  const [attorneyName, setAttorneyName] = useState("");
  const [days, setDays] = useState<Record<string, string>>({});

  const load = useCallback(async (activeId: string, status: "new" | "") => {
    const [m, d] = await Promise.all([
      inpi.monitors(activeId),
      inpi.dispatches(activeId, status || undefined),
    ]);
    setLoading(false);
    if (isApiFailure(m)) {
      setError(apiErrorMessage(m, "Não foi possível carregar o INPI."));
      return;
    }
    setMonitors(m);
    if (!isApiFailure(d)) setDispatches(d.items);
  }, []);

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const permissions = membership?.permissions ?? [];
      const readable = permissions.includes("administrative_process.read");
      setCanRead(readable);
      setCanManage(permissions.includes("administrative_process.update"));
      if (!readable) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId, "new");
    })();
  }, [load]);

  async function act(key: string, fn: () => Promise<unknown>, success: string): Promise<boolean> {
    if (!orgId) return false;
    setBusy(key);
    setError(null);
    setNotice(null);
    const result = await fn();
    setBusy(null);
    if (isApiFailure(result as never)) {
      setError(apiErrorMessage(result as never, "Não foi possível concluir."));
      return false;
    }
    setNotice(success);
    await load(orgId, filter);
    return true;
  }

  if (!canRead) {
    return (
      <EmptyState title="Sem permissão">
        Você não tem acesso a processos administrativos.
      </EmptyState>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "INPI" }]} />
      <PageHeader
        title="INPI — marcas"
        description="Despachos da Revista da Propriedade Industrial (RPI) nos processos de marca do escritório."
        actions={
          canManage && orgId ? (
            <Button
              variant="secondary"
              loading={busy === "run"}
              loadingLabel="Consultando a RPI"
              onClick={() =>
                void (async () => {
                  setBusy("run");
                  setError(null);
                  const r = await inpi.run(orgId);
                  setBusy(null);
                  if (isApiFailure(r)) {
                    setError(apiErrorMessage(r, "Não foi possível consultar a RPI."));
                    return;
                  }
                  setNotice(
                    r.result.status === "ok"
                      ? `RPI ${r.result.edition}: ${r.result.createdDispatches} despacho(s) novo(s)${r.result.discoveredProcesses ? `, ${r.result.discoveredProcesses} processo(s) descoberto(s) pelo procurador` : ""}.`
                      : (r.result.message ?? "Nada a processar."),
                  );
                  await load(orgId, filter);
                })()
              }
            >
              Consultar última RPI
            </Button>
          ) : undefined
        }
      />

      <Alert tone="info" title="Como funciona">
        A RPI sai às terças. A consulta automática roda às terças e quartas. Prazos da LPI são em
        dias corridos (art. 221) e contam da publicação; o vencimento sugerido vai para o dia útil
        seguinte quando cai em fim de semana ou feriado. Confirme cada prazo.
        {monitors?.lastRun
          ? ` Última edição processada: ${monitors.lastRun.edition} (${formatDate(monitors.lastRun.publishedOn)}).`
          : ""}
      </Alert>

      {notice ? (
        <Alert tone="success" title="Pronto">
          {notice}
        </Alert>
      ) : null}
      {error ? <ErrorState title="Atenção">{error}</ErrorState> : null}
      {loading ? <LoadingState label="Carregando…" /> : null}

      <section className="vj-card" aria-labelledby="despachos">
        <h2 id="despachos" className="vj-section-title">
          Despachos
        </h2>
        <div className="vj-form-actions">
          {(["new", ""] as const).map((f) => (
            <button
              key={f || "all"}
              type="button"
              className={filter === f ? "vj-button vj-button-primary" : "vj-button vj-button-ghost"}
              aria-pressed={filter === f}
              onClick={() => {
                setFilter(f);
                if (orgId) void load(orgId, f);
              }}
            >
              {f === "new" ? "A triar" : "Todos"}
            </button>
          ))}
        </div>
        {dispatches.length === 0 && !loading ? (
          <p className="vj-meta">Nenhum despacho neste filtro.</p>
        ) : (
          <ul className="vj-list">
            {dispatches.map((d) => (
              <li key={d.id} className="vj-card vj-card-calm">
                <div>
                  <strong>{d.name}</strong>{" "}
                  <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                </div>
                <div className="vj-meta">
                  RPI {d.edition} · {formatDate(d.publishedOn)} · processo{" "}
                  <a href={d.consultUrl} target="_blank" rel="noreferrer">
                    <span className="vj-technical">{d.processNumber}</span>
                  </a>
                  {d.markName ? ` · ${d.markName}` : ""}
                  {d.holders[0] ? ` · ${d.holders[0].name}` : ""}
                </div>
                {d.complement ? <p>{d.complement}</p> : null}
                <p className="vj-meta">{d.suggestionBasis}</p>
                {d.suggestedDueOn ? (
                  <p>
                    Vencimento sugerido: <strong>{formatDate(d.suggestedDueOn)}</strong>
                    {d.procedureName ? ` · ${d.procedureName}` : ""}
                  </p>
                ) : null}
                {canManage && d.status === "new" ? (
                  <div className="vj-inline-form">
                    <FormField id={`days-${d.id}`} label="Dias corridos">
                      <Input
                        id={`days-${d.id}`}
                        type="number"
                        min={1}
                        value={days[d.id] ?? (d.suggestedDays ? String(d.suggestedDays) : "")}
                        onChange={(e) => setDays({ ...days, [d.id]: e.target.value })}
                      />
                    </FormField>
                    <Button
                      loading={busy === d.id}
                      onClick={() => {
                        const n = Number(days[d.id] ?? d.suggestedDays ?? 0);
                        void act(
                          d.id,
                          () =>
                            inpi.triage(orgId!, d.id, {
                              createDeadline: n > 0,
                              createTask: true,
                              ruleDays: n > 0 ? n : undefined,
                            }),
                          n > 0 ? "Prazo sugerido e tarefa criados." : "Tarefa criada.",
                        );
                      }}
                    >
                      Triar
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy === d.id}
                      onClick={() =>
                        void act(
                          d.id,
                          () => inpi.dismiss(orgId!, d.id, "Sem providência necessária."),
                          "Despacho descartado.",
                        )
                      }
                    >
                      Sem providência
                    </Button>
                  </div>
                ) : null}
                {d.deadlineId ? <a href={`/app/prazos/${d.deadlineId}`}>Ver prazo</a> : null}{" "}
                {d.taskId ? <a href={`/app/tarefas/${d.taskId}`}>Ver tarefa</a> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="vj-split">
        <section className="vj-card" aria-labelledby="processos">
          <h2 id="processos" className="vj-section-title">
            Processos monitorados
          </h2>
          {canManage ? (
            <form
              className="vj-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  "add",
                  () => inpi.addProcess(orgId!, { processNumber, label: label || undefined }),
                  "Processo incluído no monitoramento.",
                ).then((ok) => {
                  if (!ok) return;
                  setProcessNumber("");
                  setLabel("");
                });
              }}
            >
              <FormField id="pn" label="Número do processo (9 dígitos)">
                <Input
                  id="pn"
                  inputMode="numeric"
                  value={processNumber}
                  onChange={(e) => setProcessNumber(e.target.value)}
                  required
                />
              </FormField>
              <FormField id="pl" label="Marca (opcional)">
                <Input id="pl" value={label} onChange={(e) => setLabel(e.target.value)} />
              </FormField>
              <Button type="submit" loading={busy === "add"}>
                Monitorar
              </Button>
            </form>
          ) : null}
          <ul className="vj-list">
            {(monitors?.processes ?? []).map((p) => (
              <li key={p.id}>
                <span className="vj-technical">{p.processNumber}</span> {p.label ?? ""}
                {p.discovered ? <Badge>descoberto pelo procurador</Badge> : null}
                {!p.active ? <Badge>pausado</Badge> : null}
                <div className="vj-meta">
                  {p.lastDispatchName
                    ? `Último despacho: ${p.lastDispatchName} (${formatDate(p.lastDispatchOn)})`
                    : "Sem despachos capturados ainda"}
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="vj-link-button"
                    onClick={() =>
                      void act(
                        p.id,
                        () => inpi.setProcessActive(orgId!, p.id, !p.active),
                        p.active ? "Pausado." : "Retomado.",
                      )
                    }
                  >
                    {p.active ? "Pausar" : "Retomar"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="vj-card" aria-labelledby="procuradores">
          <h2 id="procuradores" className="vj-section-title">
            Procurador monitorado
          </h2>
          <p className="vj-meta">
            Com o nome do procurador como aparece na RPI, os processos novos do escritório entram no
            monitoramento sozinhos.
          </p>
          {canManage ? (
            <form
              className="vj-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  "attorney",
                  () => inpi.addAttorney(orgId!, attorneyName),
                  "Procurador monitorado.",
                ).then((ok) => ok && setAttorneyName(""));
              }}
            >
              <FormField id="an" label="Nome do procurador">
                <Input
                  id="an"
                  value={attorneyName}
                  onChange={(e) => setAttorneyName(e.target.value)}
                  required
                />
              </FormField>
              <Button type="submit" loading={busy === "attorney"}>
                Monitorar
              </Button>
            </form>
          ) : null}
          <ul className="vj-list">
            {(monitors?.attorneys ?? []).map((a) => (
              <li key={a.id}>
                {a.attorneyName} {!a.active ? <Badge>pausado</Badge> : null}
                {canManage ? (
                  <button
                    type="button"
                    className="vj-link-button"
                    onClick={() =>
                      void act(
                        a.id,
                        () => inpi.setAttorneyActive(orgId!, a.id, !a.active),
                        a.active ? "Pausado." : "Retomado.",
                      )
                    }
                  >
                    {a.active ? " Pausar" : " Retomar"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
