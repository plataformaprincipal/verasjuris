"use client";

import { Alert, Breadcrumb, EmptyState, PageHeader } from "@verasjuris/ui";
import { CreateOrganizationForm } from "./organization-forms";
import { useLocale } from "./locale-provider";

type AccountEvent = { id: string; occurredAt: string; action: string };

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
}) {
  const { t, locale } = useLocale();
  const hasOrg = Boolean(organizationName);
  const hasProductivity =
    taskTotal !== null || calendarUpcoming !== null || deadlineSuggested !== null;

  const verification =
    verificationStatus === "not_submitted"
      ? t("dashboard.verification.notSubmitted")
      : verificationStatus
        ? t("dashboard.verification.status", undefined, { status: verificationStatus })
        : null;

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: t("dashboard.title") }]} />
      <PageHeader
        eyebrow={hasOrg ? organizationName! : t("dashboard.noOrg")}
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />
      {hasOrg ? (
        <section className="vj-card">
          <h2 className="vj-section-title">{t("dashboard.activeContext")}</h2>
          <p>
            {organizationName}
            {organizationSlug ? (
              <span className="vj-technical"> · {organizationSlug}</span>
            ) : null}
          </p>
          {verification ? <p>{verification}</p> : null}
        </section>
      ) : (
        <EmptyState title={t("dashboard.empty.orgTitle")}>
          {t("dashboard.emptyOrgBody")}
          <CreateOrganizationForm />
        </EmptyState>
      )}
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
                  {" "}
                  · {new Date(event.occurredAt).toLocaleString(locale)} ·{" "}
                </span>
                <span className="vj-technical">{event.action}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
