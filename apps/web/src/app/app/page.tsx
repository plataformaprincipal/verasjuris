import { SESSION_COOKIE } from "@verasjuris/security/constants";
import { ONBOARDING_PERSONA_META } from "@verasjuris/validation";
import { cookies } from "next/headers";
import { DashboardHome } from "../../components/dashboard-home";
import { personaFromAccount } from "../../lib/persona-home";
import { modulesForPersona } from "../../lib/persona-workspace";
import { activeOrganizationId, getSession } from "../../lib/session";
import { actionLabel, apiInternalUrl } from "../../lib/types";

export const dynamic = "force-dynamic";

type AccountEvent = { id: string; occurredAt: string; action: string };

async function fetchJson<T>(path: string, token: string): Promise<T | null> {
  const response = await fetch(`${apiInternalUrl()}${path}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (session.state !== "authenticated") return null;
  const activeId = await activeOrganizationId(session.account);
  const organization =
    session.account.memberships.find((item) => item.organizationId === activeId) ?? null;
  const permissions = new Set(organization?.permissions ?? []);
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  let events: AccountEvent[] = [];
  let taskTotal: number | null = null;
  let calendarUpcoming: number | null = null;
  let deadlineSuggested: number | null = null;
  let deadlineConfirmed: number | null = null;

  if (token) {
    const audit = await fetchJson<{ events: AccountEvent[] }>("/v1/account/audit", token);
    events = audit?.events ?? [];
    if (organization) {
      if (permissions.has("task.read")) {
        const tasks = await fetchJson<{ total: number }>(
          `/v1/organizations/${organization.organizationId}/tasks/overview`,
          token,
        );
        if (tasks) taskTotal = tasks.total;
      }
      if (permissions.has("calendar.read")) {
        const calendar = await fetchJson<{ upcomingWeek: number }>(
          `/v1/organizations/${organization.organizationId}/calendar/overview`,
          token,
        );
        if (calendar) calendarUpcoming = calendar.upcomingWeek;
      }
      if (permissions.has("deadline.read")) {
        const deadlines = await fetchJson<{ suggested: number; confirmed: number }>(
          `/v1/organizations/${organization.organizationId}/deadlines/overview`,
          token,
        );
        if (deadlines) {
          deadlineSuggested = deadlines.suggested;
          deadlineConfirmed = deadlines.confirmed;
        }
      }
    }
  }

  const actionLabels: Record<string, string> = {};
  for (const event of events) {
    actionLabels[event.action] = actionLabel(event.action);
  }

  const persona = personaFromAccount(session.account);
  const personaLabel = persona ? ONBOARDING_PERSONA_META[persona].label : "";
  const modules = modulesForPersona(persona, permissions);

  return (
    <DashboardHome
      organizationName={organization?.organizationName ?? null}
      organizationSlug={organization?.organizationSlug ?? null}
      verificationStatus={session.account.professionalVerificationStatus}
      events={events}
      actionLabels={actionLabels}
      taskTotal={taskTotal}
      calendarUpcoming={calendarUpcoming}
      deadlineSuggested={deadlineSuggested}
      deadlineConfirmed={deadlineConfirmed}
      persona={persona}
      personaLabel={personaLabel}
      displayName={session.account.user.displayName}
      modules={modules}
    />
  );
}
