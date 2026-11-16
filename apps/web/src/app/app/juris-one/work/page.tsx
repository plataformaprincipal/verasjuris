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
  createWorkTask,
  ensureInitialWorkCredits,
  getWorkCredits,
  jurisOneApiErrorMessage,
  listWorkTasks,
  type JurisWorkCredits,
  type JurisWorkTask,
} from "../../../../lib/juris-one-api";
import { JURIS_WORK_STATUS } from "../../../../lib/juris-one";
import { useOrgContext } from "../../../../lib/use-org-context";
import { CSRF_HEADER } from "@verasjuris/security/constants";

async function approveRun(orgId: string, taskId: string) {
  const headers = {
    "Content-Type": "application/json",
    [CSRF_HEADER]: "1",
  };
  await fetch(`/api/v1/organizations/${orgId}/juris-work/${taskId}/approve`, {
    method: "POST",
    credentials: "include",
    headers,
    body: "{}",
  });
  await fetch(`/api/v1/organizations/${orgId}/juris-work/${taskId}/run-next`, {
    method: "POST",
    credentials: "include",
    headers,
    body: "{}",
  });
}

export default function JurisOneWorkPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<JurisWorkTask[]>([]);
  const [credits, setCredits] = useState<JurisWorkCredits | null>(null);
  const [title, setTitle] = useState("Organizar dossiê");
  const [objective, setObjective] = useState(
    "Organizar documentos, extrair dados e gerar relatório interno para revisão humana.",
  );
  const [busy, setBusy] = useState(false);
  const [createNote, setCreateNote] = useState<string | null>(null);

  async function refresh(orgId: string) {
    const [tasksRes, creditsRes] = await Promise.all([
      listWorkTasks(orgId),
      getWorkCredits(orgId),
    ]);
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

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    let cancelled = false;
    void (async () => {
      const ensured = await ensureInitialWorkCredits(org.orgId!);
      if (cancelled) return;
      if (!isApiFailure(ensured)) setCredits(ensured.credits);
      await refresh(org.orgId!);
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
  }

  async function approveAndRun(taskId: string) {
    if (!org.orgId) return;
    setBusy(true);
    await approveRun(org.orgId, taskId);
    setBusy(false);
    await refresh(org.orgId);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Juris One", href: "/app/juris-one" },
          { label: "Work" },
        ]}
      />
      <PageHeader title="Juris One Work" description={JURIS_WORK_STATUS.detail} />
      <p className="vj-hint">
        Scaffold autenticado com créditos: planejamento, aprovação humana, passos internos e
        bloqueio de ações externas. Não homologado para produção comercial.
      </p>
      <div className="vj-inline-actions">
        <Badge tone="neutral">
          Créditos: {credits?.balance != null ? credits.balance : "—"}
        </Badge>
        <Badge tone={JURIS_WORK_STATUS.authenticatedAvailable ? "success" : "warning"}>
          {JURIS_WORK_STATUS.authenticatedAvailable
            ? "Scaffold com créditos disponível"
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
            {task.status === "awaiting_approval" || task.status === "running" ? (
              <Button type="button" disabled={busy} onClick={() => void approveAndRun(task.id)}>
                Aprovar / executar próximo passo interno
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
