import type { DemoKind, ToolDemoConfig } from "./types";

const LOCAL = "Os dados existem apenas nesta página e são perdidos ao recarregar ou reiniciar.";
const NO_ADVICE = "Conteúdo ilustrativo; não constitui aconselhamento jurídico.";

/** Configuração de cada demonstração. A classificação aqui é a primária do tipo. */
export const DEMO_CONFIGS: Record<DemoKind, ToolDemoConfig> = {
  processos: {
    id: "demo-processos",
    kind: "processos",
    title: "Processos e casos",
    classification: "A",
    limitations: [
      LOCAL,
      "Os andamentos são digitados por você; não há consulta a tribunais.",
      "Números e partes são fictícios.",
    ],
    maxItems: 12,
    seedVersion: 1,
  },
  clientes: {
    id: "demo-clientes",
    kind: "clientes",
    title: "Clientes e atendimentos",
    classification: "A",
    limitations: [
      LOCAL,
      "Não use dados pessoais reais: nada é armazenado, mas esta é uma demonstração.",
      "Nenhuma mensagem é enviada a clientes.",
    ],
    maxItems: 12,
    seedVersion: 1,
  },
  agenda: {
    id: "demo-agenda",
    kind: "agenda",
    title: "Agenda",
    classification: "A",
    limitations: [
      LOCAL,
      "Não há sincronização com agendas externas.",
      "Os horários não geram avisos reais.",
    ],
    maxItems: 20,
    seedVersion: 1,
  },
  prazos: {
    id: "demo-prazos",
    kind: "prazos",
    title: "Prazos",
    classification: "A",
    limitations: [
      LOCAL,
      "As datas são informadas manualmente: não há cálculo processual oficial nem contagem em dias úteis.",
      "A confirmação de qualquer prazo é responsabilidade do profissional.",
    ],
    maxItems: 20,
    seedVersion: 1,
  },
  tarefas: {
    id: "demo-tarefas",
    kind: "tarefas",
    title: "Tarefas",
    classification: "A",
    limitations: [LOCAL, "Não há atribuição real a usuários nem notificações."],
    maxItems: 24,
    seedVersion: 1,
  },
  documentos: {
    id: "demo-documentos",
    kind: "documentos",
    title: "Documentos",
    classification: "B",
    limitations: [
      LOCAL,
      "Nenhum arquivo é enviado: os textos de pré-visualização são exemplos fictícios.",
      "Versões são registros ilustrativos, sem armazenamento de arquivo.",
    ],
    maxItems: 20,
    seedVersion: 1,
  },
  contratos: {
    id: "demo-contratos",
    kind: "contratos",
    title: "Contratos e modelos",
    classification: "A",
    limitations: [
      LOCAL,
      NO_ADVICE,
      "Os modelos são genéricos e exigem revisão por profissional habilitado.",
      "Não há assinatura eletrônica nesta demonstração.",
    ],
    maxItems: 10,
    seedVersion: 1,
  },
  crm: {
    id: "demo-crm",
    kind: "crm",
    title: "Funil de oportunidades",
    classification: "A",
    limitations: [LOCAL, "Contatos e oportunidades são fictícios; nenhum contato é feito."],
    maxItems: 20,
    seedVersion: 1,
  },
  financeiro: {
    id: "demo-financeiro",
    kind: "financeiro",
    title: "Honorários e fluxo de caixa",
    classification: "A",
    limitations: [
      LOCAL,
      "Valores são fictícios e ilustrativos; nenhuma cobrança, pagamento ou emissão é realizado.",
      "Não substitui orientação contábil ou tributária.",
    ],
    maxItems: 20,
    seedVersion: 1,
  },
  relatorios: {
    id: "demo-relatorios",
    kind: "relatorios",
    title: "Relatórios",
    classification: "B",
    limitations: [
      LOCAL,
      "Os gráficos usam contagens da semente fictícia somadas ao que você adiciona aqui.",
    ],
    maxItems: 30,
    seedVersion: 1,
  },
  automacao: {
    id: "demo-automacao",
    kind: "automacao",
    title: "Fluxos de trabalho",
    classification: "B",
    limitations: [
      LOCAL,
      "A execução apenas simula etapas em um registro local; nenhum e-mail, mensagem ou aviso é enviado.",
    ],
    maxItems: 10,
    seedVersion: 1,
  },
  previdenciario: {
    id: "demo-previdenciario",
    kind: "previdenciario",
    title: "Simulação previdenciária ilustrativa",
    classification: "B",
    limitations: [
      LOCAL,
      "Cálculo meramente ilustrativo, com premissas simplificadas: não é o cálculo oficial do INSS.",
      "Não consulta CNIS nem qualquer base oficial.",
      NO_ADVICE,
    ],
    maxItems: 10,
    seedVersion: 1,
  },
  marketplace: {
    id: "demo-marketplace",
    kind: "marketplace",
    title: "Marketplace jurídico",
    classification: "B",
    limitations: [
      LOCAL,
      "Serviços, profissionais e pedidos são fictícios; não há pagamento nem contratação real.",
    ],
    maxItems: 10,
    seedVersion: 1,
  },
  ia: {
    id: "demo-ia",
    kind: "ia",
    title: "Apoio assistido por IA (prévia guiada)",
    classification: "C",
    limitations: [
      "Respostas preparadas, não é análise de IA em tempo real.",
      "Nenhum texto digitado é enviado a provedores de IA.",
      "O recurso real ainda está em desenvolvimento e exigirá revisão profissional.",
    ],
    maxItems: 6,
    seedVersion: 1,
  },
  integracoes: {
    id: "demo-integracoes",
    kind: "integracoes",
    title: "Integrações (prévia guiada)",
    classification: "C",
    limitations: [
      "Fluxo ilustrativo: nenhuma conexão real é aberta e nenhuma credencial é solicitada.",
      "Os estados de erro mostram o que o usuário poderá encontrar; nada está ativo.",
      "A disponibilidade real de cada integração consta no catálogo.",
    ],
    maxItems: 5,
    seedVersion: 1,
  },
};

export function getDemoConfig(kind: DemoKind): ToolDemoConfig {
  return DEMO_CONFIGS[kind];
}
