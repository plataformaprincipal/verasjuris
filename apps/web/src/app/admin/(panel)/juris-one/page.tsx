"use client";

import { ButtonLink, PageHeader } from "@verasjuris/ui";
import { AdminUnavailable } from "../../../../components/admin-unavailable";

export default function AdminJurisOnePage() {
  return (
    <div className="vj-stack">
      <PageHeader
        title="Juris One (administração)"
        description="Status OpenAI, orçamentos e créditos. O painel operacional de IA da organização permanece em /app/ia."
      />
      <ButtonLink href="/app/ia">Abrir painel de IA da organização</ButtonLink>
      <ButtonLink href="/admin/integracoes">Ver saúde OpenAI nas integrações</ButtonLink>
      <AdminUnavailable
        title="Controles globais de suspensão"
        description="Suspensão emergencial global de IA e visão cross-org de custos serão expostas aqui após homologação financeira."
      />
    </div>
  );
}
