"use client";

import { EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import {
  fetchPlatformDashboard,
  isApiFailure,
  platformAdminErrorMessage,
  type PlatformDashboard,
} from "../../../lib/platform-admin";

function MetricCard({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="vj-card vj-admin-metric">
      <p className="vj-meta">{label}</p>
      <p className="vj-admin-metric-value">{value == null ? "—" : value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformDashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchPlatformDashboard();
      if (cancelled) return;
      if (isApiFailure(res)) {
        setError(platformAdminErrorMessage(res));
        setData(null);
      } else {
        setData(res);
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <PageHeader
        title="Dashboard operacional"
        description="Indicadores reais da plataforma. Valores ausentes aparecem vazios — sem dados fictícios."
      />
      {loading ? <LoadingState label="Carregando indicadores…" /> : null}
      {error ? <ErrorState title="Não foi possível carregar">{error}</ErrorState> : null}
      {data ? (
        <>
          <p className="vj-meta">
            Período do dia desde {new Date(data.period.dayStart).toLocaleString("pt-BR")} · mês
            desde {new Date(data.period.monthStart).toLocaleString("pt-BR")} · atualizado{" "}
            {new Date(data.period.generatedAt).toLocaleString("pt-BR")}
          </p>
          <div className="vj-admin-metrics">
            <MetricCard label="Usuários cadastrados" value={data.metrics.usersRegistered} />
            <MetricCard label="Usuários ativos" value={data.metrics.usersActive} />
            <MetricCard label="Organizações" value={data.metrics.organizations} />
            <MetricCard label="Novos cadastros (hoje)" value={data.metrics.newRegistrationsToday} />
            <MetricCard label="Novos cadastros (mês)" value={data.metrics.newRegistrationsMonth} />
            <MetricCard label="Sessões ativas" value={data.metrics.activeSessions} />
            <MetricCard label="Equipe administrativa" value={data.metrics.platformStaffActive} />
            <MetricCard
              label="Créditos Work (saldo total)"
              value={data.metrics.workCreditsBalanceTotal}
            />
            <MetricCard
              label="IA — gasto estimado no mês (micros)"
              value={data.metrics.aiEstimatedSpendMonthMicros}
            />
            <MetricCard label="Assinaturas" value={data.metrics.subscriptions} />
            <MetricCard
              label="Receita confirmada (centavos)"
              value={data.metrics.confirmedRevenueCents}
            />
            <MetricCard label="Pagamentos pendentes" value={data.metrics.pendingPayments} />
            <MetricCard label="Cancelamentos" value={data.metrics.cancellations} />
            <MetricCard label="Reembolsos" value={data.metrics.refunds} />
            <MetricCard label="Chamados abertos" value={data.metrics.supportTicketsOpen} />
            <MetricCard label="Denúncias sociais abertas" value={data.metrics.socialReportsOpen} />
          </div>
          {data.notes.map((note) => (
            <p key={note} className="vj-hint">
              {note}
            </p>
          ))}
        </>
      ) : null}
      {!loading && !error && !data ? (
        <EmptyState title="Sem dados">Nenhum indicador disponível no momento.</EmptyState>
      ) : null}
    </div>
  );
}
