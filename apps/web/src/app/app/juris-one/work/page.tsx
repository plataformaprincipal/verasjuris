"use client";

import {
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { CSRF_HEADER } from "@verasjuris/security/constants";
import { useOrgContext } from "../../../../lib/use-org-context";
import { JURIS_WORK_STATUS } from "../../../../lib/juris-one";

type WorkTask = {
  id: string;
  title: string;
  objective: string;
  status: string;
  spentMicros: number;
  budgetMicros: number | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T | { error: string }> {
  try {
    const res = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const body = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
    if (!res.ok) {
      return { error: body.message ?? body.error ?? `HTTP ${res.status}` };
    }
    return body;
  } catch {
    return { error: "Falha de rede." };
  }
}

export default function JurisOneWorkPage() {
  const org = useOrgContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [title, setTitle] = useState("Organizar dossiê");
  const [objective, setObjective] = useState(
    "Organizar documentos, extrair dados e gerar relatório interno para revisão humana.",
  );
  const [busy, setBusy] = useState(false);

  async function refresh(orgId: string) {
    const data = await api<{ items: WorkTask[] }>(
      `/api/v1/organizations/${orgId}/juris-work`,
    );
    if ("error" in data) {
      setError(data.error);
      setTasks([]);
    } else {
      setError(null);
      setTasks(data.items);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!org.ready || !org.orgId) return;
    void refresh(org.orgId);
  }, [org.ready, org.orgId]);

  async function createTask() {
    if (!org.orgId) return;
    setBusy(true);
    const result = await api<{ task: WorkTask }>(`/api/v1/organizations/${org.orgId}/juris-work`, {
      method: "POST",
      body: JSON.stringify({ title, objective }),
    });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    await refresh(org.orgId);
  }

  async function approveAndRun(taskId: string) {
    if (!org.orgId) return;
    setBusy(true);
    await api(`/api/v1/organizations/${org.orgId}/juris-work/${taskId}/approve`, {
      method: "POST",
      body: "{}",
    });
    await api(`/api/v1/organizations/${org.orgId}/juris-work/${taskId}/run-next`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    await refresh(org.orgId);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "JurisOne", href: "/juris-one" },
          { label: "Work" },
        ]}
      />
      <PageHeader
        title="JurisOne Work"
        description={JURIS_WORK_STATUS.detail}
      />
      <p className="vj-hint">
        Scaffold autenticado: planejamento, aprovação humana, execução de passos internos e
        bloqueio de ações externas. Não homologado para produção comercial.
      </p>
      {loading ? <LoadingState label="Carregando tarefas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
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
              <Button
                type="button"
                disabled={busy}
                onClick={() => void approveAndRun(task.id)}
              >
                Aprovar / executar próximo passo interno
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
