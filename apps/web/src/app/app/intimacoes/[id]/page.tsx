"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  dismissCommunication,
  formatDate,
  getActiveMembership,
  getActiveOrgId,
  getCommunication,
  isApiFailure,
  linkCommunication,
  searchProcessOptions,
  STATUS_LABEL,
  STATUS_TONE,
  triageCommunication,
  type CourtCommunication,
} from "../../../../lib/court-communications";

type LinkedProcess = { id: string; cnjNumber: string; legalMatterId: string } | null;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="vj-check-row">
      <span className="vj-meta">{label}</span>
      <span>{children}</span>
    </div>
  );
}

export default function IntimacaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [item, setItem] = useState<CourtCommunication | null>(null);
  const [linked, setLinked] = useState<LinkedProcess>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Vínculo
  const [processQuery, setProcessQuery] = useState("");
  const [processOptions, setProcessOptions] = useState<
    Array<{ id: string; cnjNumber: string; matterTitle: string }>
  >([]);
  const [selectedProcess, setSelectedProcess] = useState("");

  // Triagem
  const [createDeadline, setCreateDeadline] = useState(true);
  const [ruleDays, setRuleDays] = useState("");
  const [createTask, setCreateTask] = useState(true);
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("high");
  const [busy, setBusy] = useState(false);

  // Descarte
  const [dismissReason, setDismissReason] = useState("");

  const load = useCallback(
    async (activeId: string) => {
      const result = await getCommunication(activeId, id);
      setLoading(false);
      if (isApiFailure(result)) {
        setError(apiErrorMessage(result, "Não foi possível abrir a intimação."));
        return;
      }
      setItem(result.communication);
      setLinked(result.judicialProcess);
      setRuleDays(
        result.communication.suggestedDays ? String(result.communication.suggestedDays) : "",
      );
      setCreateDeadline(Boolean(result.communication.suggestedDays));
    },
    [id],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      setCanManage(Boolean(membership?.permissions?.includes("judicial_process.manage_movements")));
      await load(activeId);
    })();
  }, [load]);

  async function searchProcesses() {
    if (!orgId) return;
    const result = await searchProcessOptions(orgId, processQuery);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível buscar processos."));
      return;
    }
    setProcessOptions(result.items);
    setSelectedProcess(result.items[0]?.id ?? "");
  }

  async function link(processId: string | null) {
    if (!orgId) return;
    setBusy(true);
    const result = await linkCommunication(orgId, id, processId);
    setBusy(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível vincular."));
      return;
    }
    setNotice(processId ? "Intimação vinculada ao processo." : "Vínculo removido.");
    await load(orgId);
  }

  async function triage() {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    const days = Number(ruleDays);
    const result = await triageCommunication(orgId, id, {
      createDeadline,
      createTask,
      ruleDays: createDeadline && Number.isFinite(days) && days > 0 ? days : undefined,
      priority,
    });
    setBusy(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível concluir a triagem."));
      return;
    }
    setNotice("Triagem concluída. O prazo entra como sugerido até alguém confirmar.");
    await load(orgId);
  }

  async function dismiss() {
    if (!orgId) return;
    setBusy(true);
    const result = await dismissCommunication(orgId, id, dismissReason);
    setBusy(false);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível descartar."));
      return;
    }
    setNotice("Intimação descartada.");
    await load(orgId);
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Intimações", href: "/app/intimacoes" },
    { label: item?.processNumberMasked ?? "Intimação" },
  ];

  if (loading) return <LoadingState label="Carregando intimação" />;
  if (!item) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Intimação indisponível">{error ?? "Não encontrada."}</ErrorState>
      </div>
    );
  }

  const open = item.status === "new" || item.status === "linked";

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={item.processNumberMasked ?? "Comunicação sem número de processo"}
        eyebrow={`${item.tribunal ?? "Tribunal não informado"} · ${item.communicationType ?? "Comunicação"}`}
        description={item.courtBody ?? undefined}
        actions={<Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>}
      />

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

      <div className="vj-detail-grid">
        <div className="vj-stack">
          <section className="vj-card" aria-labelledby="texto">
            <h2 id="texto" className="vj-section-title">
              Íntegra
            </h2>
            <p className="vj-prose" style={{ whiteSpace: "pre-wrap" }}>
              {item.content}
            </p>
            <div className="vj-form-actions">
              {item.link ? (
                <a
                  className="vj-button vj-button-secondary"
                  href={item.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir no tribunal
                </a>
              ) : null}
              {item.certificateUrl ? (
                <a
                  className="vj-button vj-button-ghost"
                  href={item.certificateUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Certidão de publicação (DJEN)
                </a>
              ) : null}
            </div>
          </section>

          {item.recipients.length > 0 || item.lawyers.length > 0 ? (
            <section className="vj-card" aria-labelledby="destinatarios">
              <h2 id="destinatarios" className="vj-section-title">
                Destinatários
              </h2>
              <ul className="vj-list">
                {item.recipients.map((r) => (
                  <li key={`p-${r.name}`}>
                    {r.name}
                    {r.side ? <span className="vj-meta"> · polo {r.side}</span> : null}
                  </li>
                ))}
                {item.lawyers.map((l) => (
                  <li key={`a-${l.name}-${l.oabNumber}`}>
                    {l.name}
                    {l.oabNumber ? (
                      <span className="vj-meta">
                        {" "}
                        · OAB {l.oabNumber}/{l.oabUf}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="vj-stack">
          <section className="vj-card" aria-labelledby="datas">
            <h2 id="datas" className="vj-section-title">
              Datas e sugestão
            </h2>
            <Row label="Disponibilização">{formatDate(item.availableOn)}</Row>
            <Row label="Publicação">{formatDate(item.publishedOn)}</Row>
            <Row label="Início do prazo">{formatDate(item.termStartsOn)}</Row>
            <Row label="Providência sugerida">{item.suggestedAction ?? "—"}</Row>
            <Row label="Vencimento sugerido">
              {item.suggestedDueOn
                ? `${formatDate(item.suggestedDueOn)} (${item.suggestedDays} dias úteis)`
                : "sem contagem de prazo"}
            </Row>
            {item.suggestionBasis ? <p className="vj-meta">{item.suggestionBasis}</p> : null}
          </section>

          <section className="vj-card" aria-labelledby="processo">
            <h2 id="processo" className="vj-section-title">
              Processo
            </h2>
            {linked ? (
              <>
                <p>
                  Vinculada a{" "}
                  <a href={`/app/casos/${linked.legalMatterId}/processos/${linked.id}`}>
                    <span className="vj-technical">{linked.cnjNumber}</span>
                  </a>
                  .
                </p>
                {canManage && open ? (
                  <Button variant="ghost" onClick={() => void link(null)} disabled={busy}>
                    Remover vínculo
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p className="vj-meta">
                  Nenhum processo da organização tem este número. Vincule a um processo existente ou
                  cadastre o processo no caso correspondente.
                </p>
                {canManage && open ? (
                  <form
                    className="vj-stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void searchProcesses();
                    }}
                  >
                    <FormField id="pq" label="Buscar processo" hint="Número CNJ ou título do caso">
                      <Input
                        id="pq"
                        value={processQuery}
                        onChange={(e) => setProcessQuery(e.target.value)}
                      />
                    </FormField>
                    <div className="vj-form-actions">
                      <Button type="submit" variant="secondary">
                        Buscar
                      </Button>
                    </div>
                    {processOptions.length > 0 ? (
                      <>
                        <FormField id="ps" label="Processo">
                          <Select
                            id="ps"
                            value={selectedProcess}
                            onChange={(e) => setSelectedProcess(e.target.value)}
                          >
                            {processOptions.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.cnjNumber} — {p.matterTitle}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                        <div className="vj-form-actions">
                          <Button
                            onClick={() => void link(selectedProcess)}
                            disabled={!selectedProcess || busy}
                          >
                            Vincular
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </form>
                ) : null}
              </>
            )}
          </section>

          {canManage && open ? (
            <section className="vj-card" aria-labelledby="triagem">
              <h2 id="triagem" className="vj-section-title">
                Triagem
              </h2>
              <p className="vj-meta">
                Cria um prazo provisório (sugerido, pendente de validação) e uma tarefa. Nada é
                protocolado.
              </p>
              <label className="vj-check-row">
                <input
                  type="checkbox"
                  checked={createDeadline}
                  onChange={(e) => setCreateDeadline(e.target.checked)}
                />{" "}
                Criar prazo
              </label>
              {createDeadline ? (
                <FormField id="days" label="Dias úteis" hint="Contados a partir do início do prazo">
                  <Input
                    id="days"
                    type="number"
                    min={1}
                    max={365}
                    value={ruleDays}
                    onChange={(e) => setRuleDays(e.target.value)}
                  />
                </FormField>
              ) : null}
              <label className="vj-check-row">
                <input
                  type="checkbox"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                />{" "}
                Criar tarefa
              </label>
              {createTask ? (
                <FormField id="prio" label="Prioridade da tarefa">
                  <Select
                    id="prio"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as typeof priority)}
                  >
                    <option value="urgent">Urgente</option>
                    <option value="high">Alta</option>
                    <option value="normal">Normal</option>
                    <option value="low">Baixa</option>
                  </Select>
                </FormField>
              ) : null}
              <div className="vj-form-actions">
                <Button
                  onClick={() => void triage()}
                  loading={busy}
                  disabled={!createDeadline && !createTask}
                >
                  Concluir triagem
                </Button>
              </div>
            </section>
          ) : null}

          {item.status === "triaged" ? (
            <section className="vj-card" aria-labelledby="gerados">
              <h2 id="gerados" className="vj-section-title">
                Gerado na triagem
              </h2>
              <div className="vj-form-actions">
                {item.deadlineId ? (
                  <ButtonLink href={`/app/prazos/${item.deadlineId}`} variant="secondary">
                    Ver prazo
                  </ButtonLink>
                ) : null}
                {item.taskId ? (
                  <ButtonLink href={`/app/tarefas/${item.taskId}`} variant="secondary">
                    Ver tarefa
                  </ButtonLink>
                ) : null}
              </div>
            </section>
          ) : null}

          {canManage && open ? (
            <section className="vj-card" aria-labelledby="descartar">
              <h2 id="descartar" className="vj-section-title">
                Descartar
              </h2>
              <FormField
                id="reason"
                label="Motivo"
                hint="Ex.: processo de outro escritório, mera ciência"
              >
                <Textarea
                  id="reason"
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  rows={3}
                />
              </FormField>
              <div className="vj-form-actions">
                <Button
                  variant="danger"
                  onClick={() => void dismiss()}
                  disabled={dismissReason.trim().length < 3 || busy}
                >
                  Descartar intimação
                </Button>
              </div>
            </section>
          ) : null}

          {item.status === "dismissed" && item.dismissedReason ? (
            <Alert tone="info" title="Descartada">
              {item.dismissedReason}
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}
