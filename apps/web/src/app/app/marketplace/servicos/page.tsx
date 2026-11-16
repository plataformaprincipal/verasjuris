"use client";

import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { MARKETPLACE_APP_TABS, translateMarketplaceTabs } from "../../../../components/marketplace-ui";
import { hasMarketplacePermission } from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";
import { useLocale } from "../../../../components/locale-provider";

export default function AppMarketplaceServicesPage() {
  const { t } = useLocale();
  const org = useOrgContext();
  const can = hasMarketplacePermission(org.permissions, "service.manage");
  if (org.ready && !can) return <NoPermission>Sem permissão para gerenciar serviços.</NoPermission>;
  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[{ label: "Marketplace", href: "/app/marketplace" }, { label: "Serviços" }]}
      />
      <PageHeader
        title="Meus serviços"
        description="Cadastre serviços ativos quando o perfil marketplace estiver active."
      />
      <SectionTabs label={t("common.sections")} items={translateMarketplaceTabs(t, MARKETPLACE_APP_TABS)} current="" />
      <p className="vj-meta">
        Use a API ou expanda este formulário para CRUD completo de serviços.
      </p>
    </div>
  );
}
