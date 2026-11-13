"use client";

import { ButtonLink } from "@verasjuris/ui";
import {
  Building2,
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Store,
  UsersRound,
  Briefcase,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEMO_APPOINTMENTS,
  DEMO_BANNER,
  DEMO_CLIENTS,
  DEMO_DOCUMENTS,
  DEMO_FINANCIAL_ROWS,
  DEMO_MATTERS,
  DEMO_MARKETPLACE_SERVICES,
  DEMO_ORGANIZATION,
  DEMO_TASKS,
  DEMO_VIEW_LABELS,
  DEMO_VIEWS,
  type DemoView,
  getDemoClient,
  isDemoView,
} from "../lib/demo-data";
import { RequireAuthCta } from "./require-auth-cta";

const VIEW_ICONS: Record<DemoView, typeof LayoutDashboard> = {
  painel: LayoutDashboard,
  clientes: UsersRound,
  processos: Briefcase,
  documentos: FileText,
  tarefas: CheckSquare,
  agenda: CalendarDays,
  financeiro: Wallet,
  marketplace: Store,
};

function DemoTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell) => (
                <td key={`${row[0]}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DemoPanel({ view }: { view: DemoView }) {
  if (view === "painel") {
    return (
      <div className="vj-stack">
        <div className="vj-split vj-metrics">
          <article className="vj-card">
            <p className="vj-meta">Processos ativos</p>
            <p className="vj-title">{DEMO_MATTERS.filter((m) => m.status !== "Concluído").length}</p>
          </article>
          <article className="vj-card">
            <p className="vj-meta">Clientes exemplo</p>
            <p className="vj-title">{DEMO_CLIENTS.length}</p>
          </article>
          <article className="vj-card">
            <p className="vj-meta">Tarefas pendentes</p>
            <p className="vj-title">{DEMO_TASKS.filter((t) => t.status !== "Concluída").length}</p>
          </article>
        </div>
        <DemoTable
          caption="Próximos prazos demonstrativos"
          headers={["Processo", "Responsável", "Prazo"]}
          rows={DEMO_MATTERS.map((matter) => [matter.title, matter.responsible, matter.nextDeadline])}
        />
      </div>
    );
  }

  if (view === "clientes") {
    return (
      <DemoTable
        caption="Clientes demonstrativos"
        headers={["Cliente", "Tipo", "Contato", "Casos"]}
        rows={DEMO_CLIENTS.map((client) => [
          client.name,
          client.kind,
          client.contact,
          String(client.activeMatters),
        ])}
      />
    );
  }

  if (view === "processos") {
    return (
      <DemoTable
        caption="Processos demonstrativos"
        headers={["Processo", "Área", "Cliente", "Status", "Prazo"]}
        rows={DEMO_MATTERS.map((matter) => [
          matter.title,
          matter.area,
          getDemoClient(matter.clientId)?.name ?? "Cliente Exemplo",
          matter.status,
          matter.nextDeadline,
        ])}
      />
    );
  }

  if (view === "documentos") {
    return (
      <DemoTable
        caption="Documentos demonstrativos"
        headers={["Documento", "Tipo", "Processo", "Atualização"]}
        rows={DEMO_DOCUMENTS.map((doc) => [
          doc.name,
          doc.type,
          DEMO_MATTERS.find((m) => m.id === doc.matterId)?.title ?? doc.matterId,
          doc.updatedAt,
        ])}
      />
    );
  }

  if (view === "tarefas") {
    return (
      <DemoTable
        caption="Tarefas demonstrativas"
        headers={["Tarefa", "Responsável", "Prazo", "Status"]}
        rows={DEMO_TASKS.map((task) => [task.title, task.responsible, task.due, task.status])}
      />
    );
  }

  if (view === "agenda") {
    return (
      <DemoTable
        caption="Agenda demonstrativa"
        headers={["Compromisso", "Data", "Horário"]}
        rows={DEMO_APPOINTMENTS.map((item) => [item.title, item.date, item.time])}
      />
    );
  }

  if (view === "financeiro") {
    return (
      <DemoTable
        caption="Financeiro demonstrativo"
        headers={["Descrição", "Cliente", "Valor", "Vencimento", "Status"]}
        rows={DEMO_FINANCIAL_ROWS.map((row) => [
          row.description,
          getDemoClient(row.clientId)?.name ?? "Cliente Exemplo",
          row.amount,
          row.due,
          row.status,
        ])}
      />
    );
  }

  return (
    <div className="vj-stack">
      <p className="vj-lead">
        Exemplos fictícios de serviços do marketplace jurídico. Perfis e valores não correspondem a
        profissionais reais.
      </p>
      <div className="vj-feature-grid">
        {DEMO_MARKETPLACE_SERVICES.map((service) => (
          <article key={service.id} className="vj-card">
            <p className="vj-meta">Exemplo</p>
            <h3 className="vj-section-title">{service.title}</h3>
            <p>{service.description}</p>
            <p className="vj-meta">
              {service.provider} · {service.area}
            </p>
            <p className="vj-meta">{service.priceNote}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ExploreDemo({ initialView = "painel" }: { initialView?: string }) {
  const starting = isDemoView(initialView) ? initialView : "painel";
  const [view, setView] = useState<DemoView>(starting);
  const [selectedMatter, setSelectedMatter] = useState(DEMO_MATTERS[0]?.id ?? "");

  const matterOptions = useMemo(
    () => DEMO_MATTERS.map((matter) => ({ value: matter.id, label: matter.title })),
    [],
  );

  return (
    <div className="vj-explore">
      <p className="vj-demo-banner" role="status">
        {DEMO_BANNER}
      </p>
      <div className="vj-explore-shell">
        <aside className="vj-explore-sidebar" aria-label="Módulos da demonstração">
          <p className="vj-brand-text-inverse vj-explore-org">
            <Building2 size={18} aria-hidden="true" />
            <span>{DEMO_ORGANIZATION}</span>
          </p>
          <nav className="vj-nav" aria-label="Visualizações demonstrativas">
            {DEMO_VIEWS.map((item) => {
              const Icon = VIEW_ICONS[item];
              const current = item === view;
              return (
                <button
                  key={item}
                  type="button"
                  className={current ? "vj-explore-nav-item is-current" : "vj-explore-nav-item"}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setView(item)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{DEMO_VIEW_LABELS[item]}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="vj-explore-main">
          <div className="vj-explore-topbar">
            <div>
              <h1 className="vj-title">{DEMO_VIEW_LABELS[view]}</h1>
              <p className="vj-meta">Pré-visualização pública com dados fictícios</p>
            </div>
            <div className="vj-inline-actions">
              <label className="vj-field vj-explore-filter">
                <span className="vj-label">Filtrar processo</span>
                <select
                  className="vj-select"
                  value={selectedMatter}
                  onChange={(event) => setSelectedMatter(event.target.value)}
                >
                  {matterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <RequireAuthCta
                actionLabel="Criar processo"
                title="Entre para criar um processo"
                message="Para criar um processo real, entre na sua conta ou cadastre-se no VerasJuris."
                redirectTo="/app/casos"
              />
              <RequireAuthCta
                actionLabel="Usar inteligência artificial"
                title="Entre para usar a inteligência artificial"
                message="A análise e a elaboração assistida por inteligência artificial exigem autenticação e controle de consumo."
                redirectTo="/app/ia"
                variant="secondary"
              />
            </div>
          </div>

          <DemoPanel view={view} />

          <div className="vj-explore-footnote">
            <p>
              Ações reais — criar, editar, contratar, enviar ou executar análises — exigem conta.
              Depois do cadastro, a experiência autenticada reutiliza a mesma linguagem visual.
            </p>
            <div className="vj-inline-actions">
              <ButtonLink href="/ferramentas">Ver catálogo completo</ButtonLink>
              <ButtonLink href="/cadastro" variant="secondary">
                Criar conta
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
