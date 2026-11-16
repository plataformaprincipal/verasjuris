import {
  DEMO_APPOINTMENTS,
  DEMO_CLIENTS,
  DEMO_DOCUMENTS,
  DEMO_FINANCIAL_ROWS,
  DEMO_MARKETPLACE_SERVICES,
  DEMO_MATTERS,
  DEMO_TASKS,
  type DemoMatter,
  getDemoClient,
} from "../demo-data";

/**
 * Sementes fictícias das demonstrações. Reutilizam `demo-data.ts` sempre que
 * possível e acrescentam apenas o que a interatividade exige. Todas são
 * funções (fábricas) para que "Reiniciar" devolva cópias novas e imutáveis.
 */

/** Converte "Data Exemplo 17/12/2026" (ou similar) em "2026-12-17". */
export function exampleDateToIso(text: string, fallback = "2026-12-31"): string {
  const match = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (!match) return fallback;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/* ------------------------------ Processos ------------------------------ */

export const CASE_STATUSES: DemoMatter["status"][] = [
  "Em andamento",
  "Aguardando documentos",
  "Em análise",
  "Concluído",
];

export type CaseUpdate = { id: string; date: string; text: string };

export type DemoCase = {
  id: string;
  title: string;
  area: string;
  clientName: string;
  status: DemoMatter["status"];
  responsible: string;
  updates: CaseUpdate[];
};

export type ProcessosState = { cases: DemoCase[]; selectedId: string | null; query: string };

export function seedProcessos(): ProcessosState {
  const cases: DemoCase[] = DEMO_MATTERS.map((matter, index) => ({
    id: matter.id,
    title: matter.title,
    area: matter.area,
    clientName: getDemoClient(matter.clientId)?.name ?? "Cliente Exemplo",
    status: matter.status,
    responsible: matter.responsible,
    updates: [
      {
        id: `${matter.id}-and-001`,
        date: `2026-11-${String(10 + index).padStart(2, "0")}`,
        text: "Andamento fictício: caso cadastrado na demonstração.",
      },
    ],
  }));
  return { cases, selectedId: cases[0]?.id ?? null, query: "" };
}

/* ------------------------------- Clientes ------------------------------ */

export type ClientNote = { id: string; date: string; text: string };

export type DemoClientRecord = {
  id: string;
  name: string;
  kind: "Pessoa física" | "Pessoa jurídica";
  contact: string;
  linkedCaseIds: string[];
  notes: ClientNote[];
};

export type ClientesState = {
  clients: DemoClientRecord[];
  selectedId: string | null;
  query: string;
};

export function seedClientes(): ClientesState {
  const clients: DemoClientRecord[] = DEMO_CLIENTS.map((client) => ({
    id: client.id,
    name: client.name,
    kind: client.kind,
    contact: client.contact,
    linkedCaseIds: DEMO_MATTERS.filter((m) => m.clientId === client.id).map((m) => m.id),
    notes: [
      {
        id: `${client.id}-nota-001`,
        date: "2026-11-12",
        text: "Atendimento fictício: primeiro contato registrado na demonstração.",
      },
    ],
  }));
  return { clients, selectedId: clients[0]?.id ?? null, query: "" };
}

export function listFakeCaseIds(): { id: string; title: string }[] {
  return DEMO_MATTERS.map((m) => ({ id: m.id, title: m.title }));
}

/* -------------------------------- Agenda ------------------------------- */

export type DemoEvent = { id: string; title: string; date: string; time: string; place: string };

export type AgendaState = { events: DemoEvent[] };

export function seedAgenda(): AgendaState {
  return {
    events: DEMO_APPOINTMENTS.map((a) => ({
      id: a.id,
      title: a.title,
      date: exampleDateToIso(a.date),
      time: a.time,
      place: "Local fictício",
    })),
  };
}

/* -------------------------------- Prazos ------------------------------- */

export type DemoDeadline = {
  id: string;
  title: string;
  matterTitle: string;
  dueDate: string;
  reminderDays: number;
  done: boolean;
};

export type PrazosState = { deadlines: DemoDeadline[]; referenceDate: string };

export function seedPrazos(referenceDate: string): PrazosState {
  const deadlines: DemoDeadline[] = DEMO_MATTERS.map((matter, index) => ({
    id: `prazo-${String(index + 1).padStart(3, "0")}`,
    title: `Prazo fictício ${index + 1}`,
    matterTitle: matter.title,
    dueDate: exampleDateToIso(matter.nextDeadline),
    reminderDays: 3,
    done: false,
  }));
  deadlines.push({
    id: `prazo-${String(deadlines.length + 1).padStart(3, "0")}`,
    title: "Prazo fictício vencido",
    matterTitle: "Processo Demonstrativo 001",
    dueDate: "2026-11-25",
    reminderDays: 2,
    done: false,
  });
  return { deadlines, referenceDate };
}

/* -------------------------------- Tarefas ------------------------------ */

export const TASK_COLUMNS = ["Pendente", "Em andamento", "Concluída"] as const;
export type TaskStatus = (typeof TASK_COLUMNS)[number];

export type DemoTaskCard = {
  id: string;
  title: string;
  responsible: string;
  due: string;
  status: TaskStatus;
};

export type TarefasState = { tasks: DemoTaskCard[] };

export function seedTarefas(): TarefasState {
  return {
    tasks: DEMO_TASKS.map((t) => ({
      id: t.id,
      title: t.title,
      responsible: t.responsible,
      due: exampleDateToIso(t.due),
      status: t.status,
    })),
  };
}

/* ------------------------------ Documentos ----------------------------- */

export type DocVersion = { version: number; date: string; note: string };

export type DemoDoc = {
  id: string;
  name: string;
  category: string;
  folder: string;
  versions: DocVersion[];
  preview: string;
};

export type DocumentosState = {
  docs: DemoDoc[];
  folder: string;
  category: string;
  query: string;
  selectedId: string | null;
};

export const DOC_FOLDERS = ["Todas as pastas", "Processo 001", "Processo 002", "Processo 004"];
export const DOC_CATEGORIES = ["Todas as categorias", "Procuração", "Comprovante", "Contrato"];

const PREVIEW_BY_TYPE: Record<string, string> = {
  Procuração:
    "TEXTO FICTÍCIO — PROCURAÇÃO (modelo ilustrativo)\n\nOutorgante: Cliente Exemplo 001.\nOutorgado: Profissional Exemplo A.\nPoderes: representação em processo fictício.\n\nEste conteúdo não é um documento real.",
  Comprovante:
    "TEXTO FICTÍCIO — COMPROVANTE (modelo ilustrativo)\n\nReferência: documento de exemplo anexado ao processo 002.\nObservação: nenhum arquivo foi enviado nesta demonstração.",
  Contrato:
    "TEXTO FICTÍCIO — CONTRATO (modelo ilustrativo)\n\nPartes: Empresa Exemplo 003 e Profissional Exemplo C.\nObjeto: serviço fictício de acompanhamento administrativo.\n\nEste conteúdo não tem validade jurídica.",
};

function folderFor(matterId: string): string {
  if (matterId === "processo-001") return "Processo 001";
  if (matterId === "processo-002") return "Processo 002";
  return "Processo 004";
}

export function seedDocumentos(): DocumentosState {
  const docs: DemoDoc[] = DEMO_DOCUMENTS.map((d) => ({
    id: d.id,
    name: d.name,
    category: d.type,
    folder: folderFor(d.matterId),
    versions: [
      { version: 1, date: "2026-12-01", note: "Versão inicial fictícia" },
      { version: 2, date: "2026-12-05", note: "Revisão fictícia" },
    ],
    preview: PREVIEW_BY_TYPE[d.type] ?? "TEXTO FICTÍCIO — documento de exemplo.",
  }));
  return {
    docs,
    folder: DOC_FOLDERS[0] ?? "",
    category: DOC_CATEGORIES[0] ?? "",
    query: "",
    selectedId: docs[0]?.id ?? null,
  };
}

/* ------------------------------- Contratos ----------------------------- */

export type ContractVariable = { key: string; label: string; placeholder: string };

export type ContractTemplate = {
  id: string;
  name: string;
  variables: ContractVariable[];
  body: string;
};

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "honorarios",
    name: "Modelo genérico — prestação de serviços (exemplo)",
    variables: [
      { key: "contratante", label: "Contratante", placeholder: "Cliente Exemplo 001" },
      { key: "contratado", label: "Contratado", placeholder: "Profissional Exemplo A" },
      { key: "objeto", label: "Objeto", placeholder: "acompanhamento de caso fictício" },
      { key: "data", label: "Data", placeholder: "01/12/2026" },
    ],
    body:
      "MODELO ILUSTRATIVO — NÃO É ACONSELHAMENTO JURÍDICO\n\n" +
      "Contratante: {{contratante}}\nContratado: {{contratado}}\n\n" +
      "Cláusula 1ª — O objeto deste modelo é: {{objeto}}.\n" +
      "Cláusula 2ª — As condições financeiras devem ser definidas pelas partes.\n" +
      "Cláusula 3ª — Este texto exige revisão por profissional habilitado antes de qualquer uso.\n\n" +
      "Data: {{data}}\n",
  },
  {
    id: "confidencialidade",
    name: "Modelo genérico — confidencialidade (exemplo)",
    variables: [
      { key: "parteA", label: "Parte reveladora", placeholder: "Empresa Exemplo 003" },
      { key: "parteB", label: "Parte receptora", placeholder: "Empresa Exemplo 004" },
      { key: "prazo", label: "Vigência (texto livre)", placeholder: "a definir entre as partes" },
    ],
    body:
      "MODELO ILUSTRATIVO — NÃO É ACONSELHAMENTO JURÍDICO\n\n" +
      "Parte reveladora: {{parteA}}\nParte receptora: {{parteB}}\n\n" +
      "Cláusula 1ª — A parte receptora mantém sigilo sobre as informações recebidas.\n" +
      "Cláusula 2ª — Vigência: {{prazo}}.\n" +
      "Cláusula 3ª — Este texto exige revisão por profissional habilitado antes de qualquer uso.\n",
  },
  {
    id: "procuracao",
    name: "Modelo genérico — procuração simples (exemplo)",
    variables: [
      { key: "outorgante", label: "Outorgante", placeholder: "Cliente Exemplo 002" },
      { key: "outorgado", label: "Outorgado", placeholder: "Profissional Exemplo B" },
      { key: "poderes", label: "Poderes", placeholder: "representação em processo fictício" },
    ],
    body:
      "MODELO ILUSTRATIVO — NÃO É ACONSELHAMENTO JURÍDICO\n\n" +
      "Outorgante: {{outorgante}}\nOutorgado: {{outorgado}}\n\n" +
      "Poderes: {{poderes}}.\n\n" +
      "Este texto exige revisão por profissional habilitado antes de qualquer uso.\n",
  },
];

export function renderContract(
  template: ContractTemplate,
  values: Record<string, string>,
): string {
  return template.body.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const v = values[key]?.trim();
    return v ? v : `[${key}]`;
  });
}

/* --------------------------------- CRM --------------------------------- */

export const CRM_STAGES = ["Novo contato", "Qualificação", "Proposta", "Concluído"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];
export const CRM_SOURCES = ["Indicação", "Site", "Evento", "Marketplace"] as const;

export type DemoOpportunity = {
  id: string;
  name: string;
  source: string;
  stage: CrmStage;
  note: string;
};

export type CrmState = { items: DemoOpportunity[]; stageFilter: string; sourceFilter: string };

export function seedCrm(): CrmState {
  const stages: CrmStage[] = ["Novo contato", "Qualificação", "Proposta", "Novo contato"];
  const sources = ["Site", "Indicação", "Evento", "Marketplace"];
  return {
    items: DEMO_CLIENTS.map((c, i) => ({
      id: `oportunidade-${String(i + 1).padStart(3, "0")}`,
      name: `Potencial ${c.name}`,
      source: sources[i % sources.length] ?? "Site",
      stage: stages[i % stages.length] ?? "Novo contato",
      note: "Oportunidade fictícia para demonstração.",
    })),
    stageFilter: "todas",
    sourceFilter: "todas",
  };
}

/* ------------------------------- Financeiro ---------------------------- */

export type CashEntry = {
  id: string;
  description: string;
  type: "receita" | "despesa";
  amount: number;
  date: string;
};

export type FinanceiroState = { entries: CashEntry[] };

export function seedFinanceiro(): FinanceiroState {
  const entries: CashEntry[] = DEMO_FINANCIAL_ROWS.map((row, i) => ({
    id: row.id,
    description: row.description,
    type: "receita",
    amount: [1500, 1500, 900][i] ?? 1000,
    date: exampleDateToIso(row.due),
  }));
  entries.push({
    id: "financeiro-004",
    description: "Despesa fictícia — custas de exemplo",
    type: "despesa",
    amount: 320,
    date: "2026-12-02",
  });
  return { entries };
}

/* ------------------------------- Relatórios ---------------------------- */

export type BarDatum = { label: string; value: number };
export type BarGroup = { id: string; title: string; bars: BarDatum[] };
export type RelatoriosState = { groups: BarGroup[] };

function countBy<T>(items: readonly T[], key: (item: T) => string): BarDatum[] {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

export function seedRelatorios(): RelatoriosState {
  return {
    groups: [
      { id: "processos-area", title: "Processos por área", bars: countBy(DEMO_MATTERS, (m) => m.area) },
      { id: "tarefas-situacao", title: "Tarefas por situação", bars: countBy(DEMO_TASKS, (t) => t.status) },
      {
        id: "atendimentos-mes",
        title: "Atendimentos por mês (fictício)",
        bars: [
          { label: "Set", value: 4 },
          { label: "Out", value: 6 },
          { label: "Nov", value: 5 },
        ],
      },
    ],
  };
}

/* ------------------------------- Automação ----------------------------- */

export const NODE_TYPES = ["gatilho", "condição", "ação"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export type FlowNode = { id: string; type: NodeType; label: string };

export type AutomacaoState = { nodes: FlowNode[]; log: string[] };

export function seedAutomacao(): AutomacaoState {
  return {
    nodes: [
      { id: "no-001", type: "gatilho", label: "Novo prazo cadastrado" },
      { id: "no-002", type: "condição", label: "Vencimento em até 3 dias" },
      { id: "no-003", type: "ação", label: "Criar lembrete interno (simulado)" },
    ],
    log: [],
  };
}

/* ------------------------------ Marketplace ---------------------------- */

export type DemoService = {
  id: string;
  title: string;
  provider: string;
  area: string;
  description: string;
};

export const ORDER_STEPS = [
  "Pedido registrado",
  "Profissional avaliando",
  "Em andamento",
  "Entregue",
] as const;

export type DemoOrder = { id: string; serviceTitle: string; step: number };

export type MarketplaceState = {
  services: DemoService[];
  area: string;
  query: string;
  cart: string[];
  orders: DemoOrder[];
};

export function seedMarketplace(): MarketplaceState {
  return {
    services: DEMO_MARKETPLACE_SERVICES.map((s) => ({
      id: s.id,
      title: s.title,
      provider: s.provider,
      area: s.area,
      description: s.description,
    })),
    area: "todas",
    query: "",
    cart: [],
    orders: [],
  };
}

/* ----------------------------------- IA -------------------------------- */

export type IaScenario = {
  id: string;
  label: string;
  input: string;
  output: string;
  caution: string;
};

export const IA_SCENARIOS: IaScenario[] = [
  {
    id: "assistente",
    label: "Dúvida de uso da plataforma",
    input: "Como organizo os prazos de um processo fictício?",
    output:
      "Resposta preparada: cadastre o processo, abra a aba de prazos, informe a data de vencimento e o responsável. A lista mostrará primeiro o que vence antes.",
    caution: "O assistente real ainda está em desenvolvimento e não presta consultoria jurídica.",
  },
  {
    id: "analise",
    label: "Resumo de documento fictício",
    input: "Documento de exemplo: contrato fictício de 3 páginas entre Empresa Exemplo 003 e Profissional Exemplo C.",
    output:
      "Resumo preparado: o texto fictício descreve objeto, prazo e obrigações gerais. Pontos de atenção de exemplo: cláusula de vigência sem prazo definido; ausência de foro. Conferir tudo no documento original.",
    caution: "A análise real de documentos está em desenvolvimento e exigirá revisão do profissional.",
  },
  {
    id: "peticao",
    label: "Estrutura de peça (exemplo)",
    input: "Preciso de uma estrutura para petição inicial em caso cível fictício.",
    output:
      "Sugestão preparada de estrutura: 1) Endereçamento; 2) Qualificação das partes; 3) Fatos; 4) Fundamentos; 5) Pedidos; 6) Valor da causa e provas. Fatos, fundamentos e citações devem ser conferidos pelo advogado.",
    caution: "O apoio real à elaboração de peças está em desenvolvimento; não protocola nada em tribunais.",
  },
];

/* ------------------------------- Integrações --------------------------- */

export type IntegrationStep = { label: string; detail: string };
export type IntegrationError = { id: string; label: string; message: string; action: string };

export type IntegrationScenario = {
  id: string;
  name: string;
  availability: string;
  steps: IntegrationStep[];
  errors: IntegrationError[];
};

export const INTEGRATION_SCENARIOS: IntegrationScenario[] = [
  {
    id: "tribunais",
    name: "Tribunais",
    availability: "Planejado — não está disponível e não há prazo definido.",
    steps: [
      { label: "Escolher tribunal", detail: "Lista ilustrativa; nenhuma consulta é feita." },
      { label: "Autorizar acesso", detail: "Etapa prevista; nenhuma credencial é solicitada aqui." },
      { label: "Vincular processo", detail: "Mostraria o vínculo com o processo cadastrado." },
      { label: "Receber andamentos", detail: "Prévia: hoje os andamentos são digitados manualmente." },
    ],
    errors: [
      {
        id: "indisponivel",
        label: "Sistema do tribunal indisponível",
        message: "O sistema do tribunal não respondeu. Nenhum andamento foi atualizado.",
        action: "Tentar novamente depois ou registrar o andamento manualmente.",
      },
      {
        id: "acesso",
        label: "Acesso não autorizado",
        message: "A autorização de acesso não foi concedida.",
        action: "Revisar a autorização junto ao tribunal.",
      },
    ],
  },
  {
    id: "asaas",
    name: "Pagamentos (Asaas)",
    availability: "Em testes controlados — não está aberto para pagamentos reais.",
    steps: [
      { label: "Escolher provedor", detail: "Provedor de pagamentos Asaas, em testes." },
      { label: "Informar chave de acesso", detail: "Prévia: nenhuma chave é pedida ou guardada aqui." },
      { label: "Criar cobrança de teste", detail: "Mostra o fluxo; nenhuma cobrança é emitida." },
      { label: "Receber situação do pagamento", detail: "Ilustra o retorno da situação na plataforma." },
    ],
    errors: [
      {
        id: "chave",
        label: "Chave inválida",
        message: "A chave informada foi recusada pelo provedor.",
        action: "Conferir a chave no painel do provedor.",
      },
      {
        id: "teste",
        label: "Fora do grupo de testes",
        message: "Sua conta ainda não participa dos testes de cobrança.",
        action: "Acompanhar a disponibilidade no catálogo.",
      },
    ],
  },
  {
    id: "email",
    name: "E-mail",
    availability: "Em desenvolvimento — não está disponível.",
    steps: [
      { label: "Escolher provedor de e-mail", detail: "Lista ilustrativa." },
      { label: "Autorizar leitura", detail: "Prévia; nenhuma caixa é acessada." },
      { label: "Vincular mensagem a um caso", detail: "Mostraria o histórico do caso." },
    ],
    errors: [
      {
        id: "expirado",
        label: "Autorização expirada",
        message: "A autorização da caixa de e-mail expirou.",
        action: "Autorizar novamente.",
      },
    ],
  },
  {
    id: "agenda",
    name: "Agendas externas",
    availability: "Em desenvolvimento — não está disponível.",
    steps: [
      { label: "Escolher calendário", detail: "Lista ilustrativa." },
      { label: "Autorizar sincronização", detail: "Prévia; nenhum calendário é acessado." },
      { label: "Sincronizar compromissos", detail: "Mostraria compromissos em uma só visão." },
    ],
    errors: [
      {
        id: "conflito",
        label: "Conflito de horário",
        message: "Dois compromissos ocupam o mesmo horário nas agendas.",
        action: "Remarcar um dos compromissos.",
      },
    ],
  },
  {
    id: "ia",
    name: "Provedores de IA",
    availability: "Em desenvolvimento — os recursos assistidos não estão abertos ao uso.",
    steps: [
      { label: "Escolher provedor", detail: "Lista ilustrativa." },
      { label: "Configurar acesso", detail: "Prévia; nenhuma chave é pedida aqui." },
      { label: "Habilitar recursos assistidos", detail: "Depende de provedor configurado e contratado." },
    ],
    errors: [
      {
        id: "sem-provedor",
        label: "Provedor não configurado",
        message: "Nenhum provedor de IA está configurado; os recursos assistidos ficam indisponíveis.",
        action: "Configurar um provedor quando houver disponibilidade.",
      },
    ],
  },
  {
    id: "inss",
    name: "Protocolo junto ao INSS",
    availability: "Planejado — não está disponível e não há prazo definido.",
    steps: [
      { label: "Preparar requerimento", detail: "Hoje, feito fora da plataforma." },
      { label: "Autorizar canal oficial", detail: "Previsto, dependente de viabilidade técnica." },
      { label: "Protocolar", detail: "Previsto; a plataforma não protocola hoje." },
    ],
    errors: [
      {
        id: "nao-disponivel",
        label: "Recurso não disponível",
        message: "O protocolo integrado ainda não existe. Nada foi enviado.",
        action: "Fazer o protocolo diretamente nos canais oficiais.",
      },
    ],
  },
];

export function getIntegrationScenario(id: string | undefined): IntegrationScenario {
  return (
    INTEGRATION_SCENARIOS.find((s) => s.id === id) ??
    (INTEGRATION_SCENARIOS[0] as IntegrationScenario)
  );
}
