"use client";

import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { SectionTabs } from "../../../components/ai-ui";
import {
  MARKETPLACE_PUBLIC_TABS,
  translateMarketplaceTabs,
} from "../../../components/marketplace-ui";
import { useLocale } from "../../../components/locale-provider";

export default function MarketplaceServicesBrowsePage() {
  const { t } = useLocale();
  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Serviços" }]} />
      <PageHeader
        title="Catálogo de serviços"
        description="Explore categorias e perfis profissionais com serviços ativos publicados."
      />
      <SectionTabs
        label={t("common.sections")}
        items={translateMarketplaceTabs(t, MARKETPLACE_PUBLIC_TABS)}
        current=""
      />
      <p className="vj-meta">
        Use a busca de <a href="/marketplace/profissionais">profissionais</a> para filtrar por
        categoria, UF, preço e verificação OAB.
      </p>
    </div>
  );
}
