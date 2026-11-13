export const DEMO_BANNER = "Ambiente demonstrativo — informações fictícias.";

export const DEMO_ORGANIZATION = "Organização Demonstração VerasJuris";

export const DEMO_VIEWS = [
  "painel",
  "clientes",
  "processos",
  "documentos",
  "tarefas",
  "agenda",
  "financeiro",
  "marketplace",
] as const;

export type DemoView = (typeof DEMO_VIEWS)[number];

export const DEMO_VIEW_LABELS: Record<DemoView, string> = {
  painel: "Painel",
  clientes: "Clientes",
  processos: "Processos",
  documentos: "Documentos",
  tarefas: "Prazos e tarefas",
  agenda: "Agenda",
  financeiro: "Financeiro",
  marketplace: "Marketplace",
};

export type DemoClient = {
  id: string;
  name: string;
  kind: "Pessoa física" | "Pessoa jurídica";
  contact: string;
  activeMatters: number;
};

export type DemoMatter = {
  id: string;
  title: string;
  area: string;
  clientId: string;
  status: "Em andamento" | "Aguardando documentos" | "Em análise" | "Concluído";
  responsible: string;
  nextDeadline: string;
};

export type DemoDocument = {
  id: string;
  name: string;
  type: string;
  matterId: string;
  updatedAt: string;
};

export type DemoTask = {
  id: string;
  title: string;
  matterId: string;
  responsible: string;
  due: string;
  status: "Pendente" | "Em andamento" | "Concluída";
};

export type DemoAppointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  matterId?: string;
};

export type DemoFinancialRow = {
  id: string;
  description: string;
  clientId: string;
  amount: string;
  due: string;
  status: "A vencer" | "Paga" | "Em atraso";
};

export type DemoMarketplaceService = {
  id: string;
  title: string;
  provider: string;
  area: string;
  description: string;
  priceNote: string;
};

export const DEMO_CLIENTS: DemoClient[] = [
  {
    id: "cliente-001",
    name: "Cliente Exemplo 001",
    kind: "Pessoa física",
    contact: "contato.exemplo001@exemplo.invalid",
    activeMatters: 2,
  },
  {
    id: "cliente-002",
    name: "Cliente Exemplo 002",
    kind: "Pessoa física",
    contact: "contato.exemplo002@exemplo.invalid",
    activeMatters: 1,
  },
  {
    id: "cliente-003",
    name: "Empresa Exemplo 003",
    kind: "Pessoa jurídica",
    contact: "contato.exemplo003@exemplo.invalid",
    activeMatters: 1,
  },
];

export const DEMO_MATTERS: DemoMatter[] = [
  {
    id: "processo-001",
    title: "Processo Demonstrativo 001",
    area: "Cível",
    clientId: "cliente-001",
    status: "Em andamento",
    responsible: "Profissional Exemplo A",
    nextDeadline: "Prazo Exemplo 15/12/2026",
  },
  {
    id: "processo-002",
    title: "Processo Demonstrativo 002",
    area: "Previdenciário",
    clientId: "cliente-002",
    status: "Aguardando documentos",
    responsible: "Profissional Exemplo B",
    nextDeadline: "Prazo Exemplo 20/12/2026",
  },
  {
    id: "processo-003",
    title: "Processo Demonstrativo 003",
    area: "Trabalhista",
    clientId: "cliente-001",
    status: "Em análise",
    responsible: "Profissional Exemplo A",
    nextDeadline: "Prazo Exemplo 10/01/2027",
  },
  {
    id: "processo-004",
    title: "Procedimento Administrativo Demonstrativo 004",
    area: "Administrativo",
    clientId: "cliente-003",
    status: "Em andamento",
    responsible: "Profissional Exemplo C",
    nextDeadline: "Prazo Exemplo 18/01/2027",
  },
];

export const DEMO_DOCUMENTS: DemoDocument[] = [
  {
    id: "documento-001",
    name: "Documento Exemplo 001 — Procuração",
    type: "Procuração",
    matterId: "processo-001",
    updatedAt: "Data Exemplo 01/12/2026",
  },
  {
    id: "documento-002",
    name: "Documento Exemplo 002 — Comprovante",
    type: "Comprovante",
    matterId: "processo-002",
    updatedAt: "Data Exemplo 03/12/2026",
  },
  {
    id: "documento-003",
    name: "Documento Exemplo 003 — Contrato",
    type: "Contrato",
    matterId: "processo-004",
    updatedAt: "Data Exemplo 05/12/2026",
  },
];

export const DEMO_TASKS: DemoTask[] = [
  {
    id: "tarefa-001",
    title: "Tarefa Exemplo 001 — Reunir documentos",
    matterId: "processo-002",
    responsible: "Profissional Exemplo B",
    due: "Data Exemplo 14/12/2026",
    status: "Em andamento",
  },
  {
    id: "tarefa-002",
    title: "Tarefa Exemplo 002 — Revisar minuta",
    matterId: "processo-001",
    responsible: "Profissional Exemplo A",
    due: "Data Exemplo 16/12/2026",
    status: "Pendente",
  },
  {
    id: "tarefa-003",
    title: "Tarefa Exemplo 003 — Contato com o cliente",
    matterId: "processo-003",
    responsible: "Profissional Exemplo A",
    due: "Data Exemplo 02/12/2026",
    status: "Concluída",
  },
];

export const DEMO_APPOINTMENTS: DemoAppointment[] = [
  {
    id: "compromisso-001",
    title: "Compromisso Exemplo 001 — Reunião com cliente",
    date: "Data Exemplo 17/12/2026",
    time: "10:00",
    matterId: "processo-001",
  },
  {
    id: "compromisso-002",
    title: "Compromisso Exemplo 002 — Audiência demonstrativa",
    date: "Data Exemplo 19/12/2026",
    time: "14:30",
    matterId: "processo-003",
  },
  {
    id: "compromisso-003",
    title: "Compromisso Exemplo 003 — Reunião interna",
    date: "Data Exemplo 21/12/2026",
    time: "09:00",
  },
];

export const DEMO_FINANCIAL_ROWS: DemoFinancialRow[] = [
  {
    id: "financeiro-001",
    description: "Honorários Exemplo 001 — parcela 1 de 3",
    clientId: "cliente-001",
    amount: "R$ 0,00 (valor fictício)",
    due: "Data Exemplo 10/12/2026",
    status: "Paga",
  },
  {
    id: "financeiro-002",
    description: "Honorários Exemplo 001 — parcela 2 de 3",
    clientId: "cliente-001",
    amount: "R$ 0,00 (valor fictício)",
    due: "Data Exemplo 10/01/2027",
    status: "A vencer",
  },
  {
    id: "financeiro-003",
    description: "Honorários Exemplo 002 — parcela única",
    clientId: "cliente-003",
    amount: "R$ 0,00 (valor fictício)",
    due: "Data Exemplo 01/11/2026",
    status: "Em atraso",
  },
];

export const DEMO_MARKETPLACE_SERVICES: DemoMarketplaceService[] = [
  {
    id: "servico-001",
    title: "Serviço Exemplo 001 — Orientação inicial",
    provider: "Profissional Exemplo A",
    area: "Cível",
    description: "Descrição fictícia de um serviço de análise inicial de documentos.",
    priceNote: "Valor Exemplo — não representa preço real",
  },
  {
    id: "servico-002",
    title: "Serviço Exemplo 002 — Revisão de contrato",
    provider: "Escritório Exemplo B",
    area: "Empresarial",
    description: "Descrição fictícia de um serviço de revisão de contrato.",
    priceNote: "Valor Exemplo — não representa preço real",
  },
  {
    id: "servico-003",
    title: "Serviço Exemplo 003 — Planejamento previdenciário",
    provider: "Profissional Exemplo C",
    area: "Previdenciário",
    description: "Descrição fictícia de um serviço de organização de informações previdenciárias.",
    priceNote: "Valor Exemplo — não representa preço real",
  },
];

export const DEMO_DATA = {
  organization: DEMO_ORGANIZATION,
  banner: DEMO_BANNER,
  clients: DEMO_CLIENTS,
  matters: DEMO_MATTERS,
  documents: DEMO_DOCUMENTS,
  tasks: DEMO_TASKS,
  appointments: DEMO_APPOINTMENTS,
  financialRows: DEMO_FINANCIAL_ROWS,
  marketplaceServices: DEMO_MARKETPLACE_SERVICES,
} as const;

export function isDemoView(value: string): value is DemoView {
  return (DEMO_VIEWS as readonly string[]).includes(value);
}

export function getDemoClient(id: string): DemoClient | undefined {
  return DEMO_CLIENTS.find((client) => client.id === id);
}

export function getDemoMatter(id: string): DemoMatter | undefined {
  return DEMO_MATTERS.find((matter) => matter.id === id);
}
