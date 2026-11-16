"use client";

import { Alert, Badge, Breadcrumb, EmptyState, PageHeader } from "@verasjuris/ui";
import type { OnboardingPersona } from "@verasjuris/validation";
import { CreateOrganizationForm } from "./organization-forms";
import { useLocale } from "./locale-provider";
import {
  AVAILABILITY_LABEL_KEYS,
  type ModuleAvailability,
  type WorkspaceModule,
} from "../lib/persona-workspace";

type AccountEvent = { id: string; occurredAt: string; action: string };

function availabilityTone(status: ModuleAvailability): "neutral" | "success" | "warning" | "error" {
  if (status === "available") return "success";
  if (status === "partial" || status === "demo") return "warning";
  if (status === "unavailable") return "error";
  return "neutral";
}

export function DashboardHome({
  organizationName,
  organizationSlug,
  verificationStatus,
  events,
  actionLabels,
  taskTotal,
  calendarUpcoming,
  deadlineSuggested,
  deadlineConfirmed,
  persona,
  personaLabel,
  displayName,
  modules,
}: {
  organizationName: string | null;
  organizationSlug: string | null;
  verificationStatus: string | null;
  events: AccountEvent[];
  actionLabels: Record<string, string>;
  taskTotal: number | null;
  calendarUpcoming: number | null;
  deadlineSuggested: number | null;
  deadlineConfirmed: number | null;
  persona: OnboardingPersona | null;
  personaLabel: string;
  displayName: string;
  modules: WorkspaceModule[];
}) {
  const { t, locale } = useLocale();
  const hasOrg = Boolean(organizationName);
  const hasProductivity =
    taskTotal !== null || calendarUpcoming !== null || deadlineSuggested !== null;

  const verification =
    verificationStatus === "not_submitted"
      ? t("dashboard.verification.notSubmitted", "Verificação profissional não enviada.")
      : verificationStatus === "pending"
        ? t(
            "dashboard.verification.pending",
            "Verificação profissional pendente — permissões reservadas a advogados habilitados não foram liberadas automaticamente.",
          )
        : verificationStatus
          ? t("dashboard.verification.status", undefined, { status: verificationStatus })
          : null;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: t("dashboard.title") }]} />
      <PageHeader
        eyebrow={organizationName ?? t("dashboard.noOrg")}
        title={`${t("dashboard.welcome")} · ${displayName}`}
        description={
          persona
            ? t(
                "dashboard.personaLead",
                "Ambiente preparado para o perfil {persona}. Continue pelos módulos autorizados abaixo.",
                { persona: personaLabel },
              )
            : t("dashboard.description")
        }
      />

      {hasOrg ? (
        <section className="vj-card">
          <h2 className="vj-section-title">{t("dashboard.activeContext")}</h2>
          <p>
            {organizationName}
            {organizationSlug ? <span className="vj-technical"> · {organizationSlug}</span> : null}
          </p>
          {personaLabel ? (
            <p className="vj-meta">
              {t("dashboard.persona", "Perfil de cadastro")}: {personaLabel}
            </p>
          ) : null}
          {verification ? <p>{verification}</p> : null}
          <div className="vj-inline-actions" style={{ marginTop: "0.75rem" }}>
            <a className="vj-button vj-button-secondary" href="/app/conta">
              {t("dashboard.openProfile", "Abrir meu perfil")}
            </a>
            <a className="vj-button vj-button-ghost" href="/app/previsualizacao">
              {t("dashboard.browseCatalog", "Ver catálogo de módulos")}
            </a>
          </div>
        </section>
      ) : (
        <EmptyState title={t("dashboard.empty.orgTitle")}>
          {t("dashboard.emptyOrgBody")}
          <CreateOrganizationForm />
        </EmptyState>
      )}

      {hasOrg && modules.length > 0 ? (
        <section className="vj-stack">
          <h2 className="vj-section-title">{t("dashboard.yourModules", "Seus módulos")}</h2>
          <p className="vj-meta">
            {t(
              "dashboard.modulesLead",
              "Acesso conforme suas permissões. Estados parciais e em desenvolvimento não executam operações sensíveis.",
            )}
          </p>
          <div className="vj-feature-grid">
            {modules.map((module) => {
              const href =
                module.availability === "in_development" || module.availability === "demo"
                  ? (module.previewHref ?? module.href)
                  : module.href;
              const label = t(AVAILABILITY_LABEL_KEYS[module.availability], module.availability);
              return (
                <a key={module.id} className="vj-card vj-card-link" href={href}>
                  <div className="vj-inline-actions">
                    <Badge tone={availabilityTone(module.availability)}>{label}</Badge>
                  </div>
                  <h3 className="vj-section-title">{t(module.titleKey, module.id)}</h3>
                  <p>{t(module.descriptionKey, "")}</p>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {hasOrg && hasProductivity ? (
        <section className="vj-card">
          <h2 className="vj-section-title">{t("dashboard.productivity")}</h2>
          <Alert tone="info" title={t("dashboard.productivityScopeTitle")}>
            {t("dashboard.productivityScope")}
          </Alert>
          <ul>
            {taskTotal !== null ? (
              <li>{t("dashboard.tasksCount", undefined, { count: taskTotal })}</li>
            ) : null}
            {calendarUpcoming !== null ? (
              <li>{t("dashboard.appointmentsWeek", undefined, { count: calendarUpcoming })}</li>
            ) : null}
            {deadlineSuggested !== null ? (
              <li>
                {t("dashboard.deadlinesSuggestedCount", undefined, { count: deadlineSuggested })}
              </li>
            ) : null}
            {deadlineConfirmed !== null ? (
              <li>
                {t("dashboard.deadlinesConfirmedCount", undefined, { count: deadlineConfirmed })}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="vj-card">
        <h2 className="vj-section-title">{t("dashboard.accountRecords")}</h2>
        {events.length === 0 ? (
          <p>{t("dashboard.emptyEventsDetail")}</p>
        ) : (
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                {actionLabels[event.action] ?? event.action}
                <span className="vj-meta">
                  {" · "}
                  {new Date(event.occurredAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
