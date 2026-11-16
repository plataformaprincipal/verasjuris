"use client";

import { LoadingState } from "@verasjuris/ui";
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DemoKind } from "../../lib/tool-demos/types";

const DemoProcessos = dynamic(
  () => import("./demo-gestao").then((m) => m.DemoProcessos),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoClientes = dynamic(
  () => import("./demo-gestao").then((m) => m.DemoClientes),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoAgenda = dynamic(
  () => import("./demo-gestao").then((m) => m.DemoAgenda),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoPrazos = dynamic(
  () => import("./demo-gestao").then((m) => m.DemoPrazos),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoTarefas = dynamic(
  () => import("./demo-gestao").then((m) => m.DemoTarefas),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoDocumentos = dynamic(
  () => import("./demo-ops").then((m) => m.DemoDocumentos),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoContratos = dynamic(
  () => import("./demo-ops").then((m) => m.DemoContratos),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoCrm = dynamic(
  () => import("./demo-ops").then((m) => m.DemoCrm),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoFinanceiro = dynamic(
  () => import("./demo-ops").then((m) => m.DemoFinanceiro),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoRelatorios = dynamic(
  () => import("./demo-ops").then((m) => m.DemoRelatorios),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoAutomacao = dynamic(
  () => import("./demo-ops").then((m) => m.DemoAutomacao),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoPrevidenciario = dynamic(
  () => import("./demo-guided").then((m) => m.DemoPrevidenciario),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoMarketplace = dynamic(
  () => import("./demo-guided").then((m) => m.DemoMarketplace),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoIa = dynamic(
  () => import("./demo-guided").then((m) => m.DemoIa),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);
const DemoIntegracoes = dynamic(
  () => import("./demo-guided").then((m) => m.DemoIntegracoes),
  { loading: () => <LoadingState label="Carregando demonstração…" />, ssr: false },
);

const BY_KIND: Record<DemoKind, ComponentType> = {
  processos: DemoProcessos,
  clientes: DemoClientes,
  agenda: DemoAgenda,
  prazos: DemoPrazos,
  tarefas: DemoTarefas,
  documentos: DemoDocumentos,
  contratos: DemoContratos,
  crm: DemoCrm,
  financeiro: DemoFinanceiro,
  relatorios: DemoRelatorios,
  automacao: DemoAutomacao,
  previdenciario: DemoPrevidenciario,
  marketplace: DemoMarketplace,
  ia: DemoIa,
  integracoes: DemoIntegracoes,
};

export function ToolDemoPanel({ kind }: { kind: DemoKind }) {
  const Panel = BY_KIND[kind];
  return <Panel />;
}
