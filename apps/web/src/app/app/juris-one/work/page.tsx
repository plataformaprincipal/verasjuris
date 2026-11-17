"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { isApiFailure } from "../../../../lib/ai";
import {
  approveWorkStep,
  approveWorkTask,
  cancelWorkTask,
  createWorkTask,
  ensureInitialWorkCredits,
  getWorkCredits,
  getWorkTask,
  jurisOneApiErrorMessage,
  listWorkTasks,
  runNextWorkStep,
  type JurisWorkCredits,
  type JurisWorkStep,
  type JurisWorkTask,
} from "../../../../lib/juris-one-api";
import { JURIS_WORK_STATUS } from "../../../../lib/juris-one";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function JurisOneWorkPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<JurisWorkTask[]>([]);
  const [credits, setCredits] = useState<JurisWorkCredits | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [steps, setSteps] = useState<JurisWorkStep[]>([]);
  const [title, setTitle] = useState("Organizar dossiê");
  const [objective, setObjective] = useState(
    "Organizar documentos, extrair dados e gerar relatório interno para revisão humana.",
  );
  const [busy, setBusy] = useState(false);
  const [createNote, setCreateNote] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<string | null>(null);

  async function refresh(orgId: string) {
    const [tasksRes, creditsRes] = await Promise.all([listWorkTasks(orgId), getWorkCredits(orgId)]);
    if (isApiFailure(tasksRes)) {
      setError(jurisOneApiErrorMessage(tasksRes, "Não foi possível carregar tarefas Work."));
      setTasks([]);
    } else {
      setError(null);
      setTasks(tasksRes.items);
      if (tasksRes.credits) setCredits(tasksRes.credits);
    }
    if (!isApiFailure(creditsRes)) setCredits(creditsRes.credits);
    setLoading(false);
  }

  async function loadTaskDetail(orgId: string, taskId: string) {
    const detail = await getWorkTask(orgId, taskId);
    if (isApiFailure(detail)) {
      setError(jurisOneApiErrorMessage(detail, "Não foi possível carregar a tarefa."));
      return;
    }
    setSelectedId(taskId);
    setSteps(detail.steps);
    if (detail.credits) setCredits(detail.credits);
    const completed = [...detail.steps]
      .reverse()
      .find((step) => step.status === "completed" && step.output);
    const content =
      completed?.output && typeof completed.output.content === "string"
        ? completed.output.content
        : null;
    setLastOutput(content);
  }

  useEffect(() => {
    const orgId = org.orgId;
    if (!org.ready || !orgId) return;
    let cancelled = false;
    void (async () => {
      const ensured = await ensureInitialWorkCredits(orgId);
      if (cancelled) return;
      if (!isApiFailure(ensured)) setCredits(ensured.credits);
      const [tasksRes, creditsRes] = await Promise.all([
        listWorkTasks(orgId),
        getWorkCredits(orgId),
      ]);
      if (cancelled) return;
      if (isApiFailure(tasksRes)) {
        setError(jurisOneApiErrorMessage(tasksRes, "Não foi possível carregar tarefas Work."));
        setTasks([]);
      } else {
        setError(null);
        setTasks(tasksRes.items);
        if (tasksRes.credits) setCredits(tasksRes.credits);
      }
      if (!isApiFailure(creditsRes)) setCredits(creditsRes.credits);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId]);

  async function createTask() {
    if (!org.orgId) return;
    setBusy(true);
    setCreateNote(null);
    const result = await createWorkTask(org.orgId, { title, objective });
    setBusy(false);
    if (isApiFailure(result)) {
      setError(jurisOneApiErrorMessage(result, "Não foi possível criar a tarefa."));
      return;
    }
    if (result.credits) {
      setCredits(result.credits);
      setCreateNote(`Tarefa criada. Créditos restantes: ${result.credits.balance}.`);
    } else {
      setCreateNote("Tarefa criada.");
    }
    await refresh(org.orgId);
    await loadTaskDetail(org.orgId, result.task.id);
  }

  async function approveAndRun(taskId: string) {
    if (!org.orgId) return;
    setBusy(true);
    setError(null);
    const approved = await approveWorkTask(org.orgId, taskId);
    if (isApiFailure(approved)) {
      setBusy(false);
      setError(jurisOneApiErrorMessage(approved, "Não foi possível aprovar a tarefa."));
      return;
    }
    const ran = await runNextWorkStep(org.orgId, taskId);
    setBusy(false);
    if (isApiFailure(ran)) {
      setError(jurisOneApiErrorMessage(ran, "Não foi possível executar o próximo passo."));
      await loadTaskDetail(org.orgId, taskId);
      await refresh(org.orgId);
      return;
    }
    if (ran.credits) setCredits(ran.credits);
    if (ran.step?.output && typeof ran.step.output.content === "string") {
      setLastOutput(ran.step.output.content);
    }
    await refresh(org.orgId);
    await loadTaskDetail(org.orgId, taskId);
  }

  async function runNext(taskId: string) {
    if (!org.orgId) return;
    setBusy(true);
    setError(null);
    const ran = await runNextWorkStep(org.orgId, taskId);
    setBusy(false);
    if (isApiFailure(ran)) {
      setError(jurisOneApiErrorMessage(ran, "Não foi possível executar o próximo passo."));
      await loadTaskDetail(org.orgId, taskId);
      return;
    }
    if (ran.credits) setCredits(ran.credits);
    if (ran.step?.output && typeof ran.step.output.content === "string") {
      setLastOutput(ran.step.output.content);
    }
    await refresh(org.orgId);
    await loadTaskDetail(org.orgId, taskId);
  }

  async function approveStep(taskId: string, stepId: string) {
    if (!org.orgId) return;
    setBusy(true);
    const result = await approveWorkStep(org.orgId, taskId, stepId);
    setBusy(false);
    if (isApiFailure(result)) {
      setError(jurisOneApiErrorMessage(result, "Não foi possível aprovar o passo."));
      return;
    }
    await loadTaskDetail(org.orgId, taskId);
  }

  async function cancelTask(taskId: string) {
    if (!org.orgId) return;
    setBusy(true);
    const result = await cancelWorkTask(org.orgId, taskId);
    setBusy(false);
    if (isApiFailure(result)) {
      setError(jurisOneApiErrorMessage(result, "Não foi possível cancelar a tarefa."));
      return;
    }
    if (result.credits) setCredits(result.credits);
    setSelectedId(null);
    setSteps([]);
    await refresh(org.orgId);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Juris One", href: "/app/juris-one" }, { label: "Work" }]} />
      <PageHeader title="Juris One Work" description={JURIS_WORK_STATUS.detail} />
      <p className="vj-hint">
        Agente autenticado com RBAC (`ai.use`), isolamento por organização, créditos, auditoria e
        aprovação humana. Passos internos usam OpenAI quando configurada; ações externas (protocolo,
        pagamento, e-mail, exclusão) permanecem bloqueadas.
      </p>
      <div className="vj-inline-actions">
        <Badge tone="neutral">Créditos: {credits?.balance != null ? credits.balance : "—"}</Badge>
        <Badge tone={JURIS_WORK_STATUS.authenticatedAvailable ? "success" : "warning"}>
          {JURIS_WORK_STATUS.authenticatedAvailable
            ? "Work autenticado disponível"
            : "Indisponível"}
        </Badge>
      </div>
      {loading ? <LoadingState label="Carregando tarefas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {createNote ? (
        <Alert tone="success" title="Tarefa Work">
          {createNote}
        </Alert>
      ) : null}
      <section className="vj-card vj-stack" aria-labelledby="new-work-task">
        <h2 id="new-work-task" className="vj-subtitle">
          Nova tarefa
        </h2>
        <label className="vj-stack">
          Título
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="vj-stack">
          Objetivo
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={4} />
        </label>
        <Button type="button" disabled={busy || !org.orgId} onClick={() => void createTask()}>
          Criar plano
        </Button>
      </section>
      {!loading && tasks.length === 0 ? (
        <EmptyState title="Nenhuma tarefa">Crie um plano para começar.</EmptyState>
      ) : null}
      <ul className="vj-stack">
        {tasks.map((task) => (
          <li key={task.id} className="vj-card vj-stack">
            <strong>{task.title}</strong>
            <p className="vj-hint">
              {task.status} · gasto {Math.round(task.spentMicros / 1000)} /{" "}
              {task.budgetMicros != null ? Math.round(task.budgetMicros / 1000) : "—"} (milésimos de
              micro)
            </p>
            <p>{task.objective}</p>
            {task.lastError ? <p className="vj-hint">Erro: {task.lastError}</p> : null}
            <div className="vj-inline-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => org.orgId && void loadTaskDetail(org.orgId, task.id)}
              >
                Detalhes
              </Button>
              {task.status === "awaiting_approval" ? (
                <Button type="button" disabled={busy} onClick={() => void approveAndRun(task.id)}>
                  Aprovar e executar próximo passo
                </Button>
              ) : null}
              {task.status === "running" ? (
                <Button type="button" disabled={busy} onClick={() => void runNext(task.id)}>
                  Executar próximo passo
                </Button>
              ) : null}
              {task.status === "awaiting_approval" || task.status === "running" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void cancelTask(task.id)}
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {selectedId ? (
        <section className="vj-card vj-stack" aria-labelledby="work-steps">
          <h2 id="work-steps" className="vj-subtitle">
            Etapas da tarefa
          </h2>
          <ol className="vj-stack">
            {steps.map((step) => (
              <li key={step.id} className="vj-stack">
                <strong>
                  {step.stepIndex + 1}. {step.title}
                </strong>
                <p className="vj-hint">
                  {step.toolName} · {step.status}
                  {step.requiresApproval ? " · requer aprovação" : ""}
                </p>
                {step.status === "awaiting_approval" ? (
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void approveStep(selectedId, step.id)}
                  >
                    Aprovar passo interno
                  </Button>
                ) : null}
                {step.output && typeof step.output.content === "string" ? (
                  <p className="vj-hint">{step.output.content}</p>
                ) : null}
              </li>
            ))}
          </ol>
          {lastOutput ? (
            <Alert tone="info" title="Última saída assistiva">
              Revisar antes de qualquer uso externo. Ações externas não foram executadas.
            </Alert>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
