"use client";

import { Breadcrumb, PageHeader } from "@verasjuris/ui";
import { JurisOneApp } from "../../../components/juris-one-app";
import { JurisOneCommerceOffers } from "../../../components/juris-one-commerce-offers";

export default function JurisOneAppPage() {
  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "App", href: "/app" }, { label: "Juris One" }]} />
      <PageHeader
        title="Juris One"
        description="Hub autenticado de chat e Work com créditos. Sem provedor de IA configurado, as respostas usam FAQ e orientação honesta."
      />
      <JurisOneApp />
      <JurisOneCommerceOffers />
    </div>
  );
}
