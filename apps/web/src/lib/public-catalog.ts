export type Availability = "available" | "in_test" | "in_development" | "planned";

export type CatalogCategory =
  | "gestao_juridica"
  | "inteligencia_artificial"
  | "previdenciario"
  | "documentos"
  | "marketplace"
  | "atendimento"
  | "financeiro"
  | "empresarial"
  | "integracoes"
  | "automacao";

export type CatalogFeature = {
  slug: string;
  category: CatalogCategory;
  name: string;
  summary: string;
  problem: string;
  capabilities: string[];
  audience: string[];
  benefits: string[];
  limitations: string[];
  availability: Availability;
  demoView?: string;
  requiresAuthFor: string[];
};

export const CATEGORY_META: Record<
  CatalogCategory,
  { label: string; description: string; order: number }
> = {
  gestao_juridica: {
    label: "Gestão jurídica",
    description: "Processos, casos, prazos, agenda e tarefas em um só lugar.",
    order: 1,
  },
  atendimento: {
    label: "Atendimento",
    description: "Clientes, contatos, atendimentos e acompanhamento de oportunidades.",
    order: 2,
  },
  documentos: {
    label: "Documentos",
    description: "Arquivos, dossiês, contratos e modelos organizados por caso.",
    order: 3,
  },
  previdenciario: {
    label: "Previdenciário",
    description: "Apoio ao cálculo e à organização de casos previdenciários.",
    order: 4,
  },
  marketplace: {
    label: "Marketplace jurídico",
    description: "Encontre profissionais e serviços jurídicos com transparência.",
    order: 5,
  },
  financeiro: {
    label: "Financeiro",
    description: "Honorários, cobranças e assinaturas.",
    order: 6,
  },
  empresarial: {
    label: "Organizações e equipes",
    description: "Estrutura, perfis de acesso e permissões para escritórios e empresas.",
    order: 7,
  },
  automacao: {
    label: "Automação",
    description: "Fluxos de trabalho e lembretes para reduzir tarefas repetitivas.",
    order: 8,
  },
  inteligencia_artificial: {
    label: "Inteligência artificial",
    description: "Apoio assistido por IA, sempre com revisão profissional.",
    order: 9,
  },
  integracoes: {
    label: "Integrações",
    description: "Conexões com serviços externos, conforme a disponibilidade de cada uma.",
    order: 10,
  },
};

export const AVAILABILITY_META: Record<Availability, { label: string; description: string }> = {
  available: {
    label: "Disponível",
    description: "Disponível na plataforma, com operação manual pelo usuário.",
  },
  in_test: {
    label: "Em testes",
    description: "Em fase de testes controlados. Ainda não é uma operação aberta ao público.",
  },
  in_development: {
    label: "Em desenvolvimento",
    description: "Em construção. Ainda não está disponível para uso.",
  },
  planned: {
    label: "Planejado",
    description: "Previsto para o futuro, sem data definida.",
  },
};

const AUTH_CREATE = "Criar e salvar informações";
const AUTH_EDIT = "Editar e acompanhar";

export const PUBLIC_CATALOG: CatalogFeature[] = [
  {
    slug: "processos-judiciais",
    category: "gestao_juridica",
    name: "Processos judiciais",
    summary:
      "Cadastre e acompanhe seus processos judiciais com partes, andamentos registrados e prazos.",
    problem:
      "Informações de processos espalhadas em planilhas, e-mails e anotações dificultam o controle da carteira.",
    capabilities: [
      "Cadastro de processos com número, vara, partes e área do direito",
      "Registro manual de andamentos e observações",
      "Vínculo com clientes, prazos, tarefas e documentos",
      "Busca e filtros por situação, responsável e área",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: [
      "Visão única da carteira de processos",
      "Menos retrabalho na organização de informações",
      "Histórico centralizado por processo",
    ],
    limitations: [
      "Os andamentos são registrados manualmente pelo usuário",
      "Não há consulta automática aos tribunais",
    ],
    availability: "available",
    demoView: "processos",
    requiresAuthFor: ["Cadastrar processo", "Registrar andamento"],
  },
  {
    slug: "processos-administrativos",
    category: "gestao_juridica",
    name: "Processos administrativos",
    summary:
      "Organize requerimentos e procedimentos administrativos junto a órgãos públicos e entidades.",
    problem:
      "Procedimentos administrativos têm etapas e prazos próprios que raramente cabem em controles pensados só para processos judiciais.",
    capabilities: [
      "Cadastro de procedimentos com órgão, número de protocolo e situação",
      "Registro manual de etapas, exigências e respostas",
      "Controle de prazos e documentos de cada procedimento",
    ],
    audience: ["Advogados", "Escritórios", "Empresas"],
    benefits: [
      "Acompanhamento organizado de exigências e respostas",
      "Documentos e prazos no mesmo lugar do procedimento",
    ],
    limitations: [
      "O protocolo junto a órgãos públicos é feito fora da plataforma",
      "Não há integração automática com sistemas de órgãos públicos",
    ],
    availability: "available",
    demoView: "processos",
    requiresAuthFor: ["Cadastrar procedimento administrativo"],
  },
  {
    slug: "casos",
    category: "gestao_juridica",
    name: "Casos",
    summary:
      "Reúna em um caso tudo o que envolve um mesmo assunto: cliente, documentos, prazos, tarefas e conversas.",
    problem:
      "Um mesmo assunto costuma envolver vários processos e documentos, e a visão completa se perde.",
    capabilities: [
      "Caso como pasta central com cliente, equipe e histórico",
      "Vínculo de processos, documentos, prazos e tarefas ao caso",
      "Linha do tempo com os registros feitos pela equipe",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: [
      "Contexto completo ao abrir um caso",
      "Passagem de trabalho entre colegas sem perda de informação",
    ],
    limitations: ["Os registros do caso dependem do preenchimento pela equipe"],
    availability: "available",
    demoView: "processos",
    requiresAuthFor: [AUTH_CREATE, AUTH_EDIT],
  },
  {
    slug: "prazos",
    category: "gestao_juridica",
    name: "Prazos",
    summary: "Controle de prazos com responsável, data de vencimento e situação.",
    problem: "Perder um prazo é um dos maiores riscos da rotina jurídica.",
    capabilities: [
      "Cadastro de prazos vinculados a processos e casos",
      "Responsável, data de vencimento e situação",
      "Lista ordenada por proximidade do vencimento",
      "Lembretes dentro da plataforma",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: [
      "Visão clara do que vence primeiro",
      "Responsabilidade definida para cada prazo",
    ],
    limitations: [
      "Os prazos são informados pelo usuário; a plataforma não os calcula a partir de publicações",
      "A conferência da contagem é sempre responsabilidade do profissional",
    ],
    availability: "available",
    demoView: "tarefas",
    requiresAuthFor: ["Cadastrar prazo", "Receber lembretes"],
  },
  {
    slug: "agenda",
    category: "gestao_juridica",
    name: "Agenda",
    summary: "Compromissos, audiências e reuniões organizados em um calendário compartilhado.",
    problem: "Compromissos em agendas separadas geram conflitos de horário e esquecimentos.",
    capabilities: [
      "Calendário de compromissos, audiências e reuniões",
      "Vínculo de compromissos a casos e clientes",
      "Visualização por dia, semana e mês",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Agenda da equipe em um só lugar", "Compromissos ligados ao contexto do caso"],
    limitations: ["A sincronização com agendas externas ainda está em desenvolvimento"],
    availability: "available",
    demoView: "agenda",
    requiresAuthFor: ["Criar compromisso"],
  },
  {
    slug: "tarefas",
    category: "gestao_juridica",
    name: "Tarefas",
    summary: "Distribua e acompanhe tarefas da equipe, com responsável, data e situação.",
    problem: "Sem controle de tarefas, o trabalho depende de recados e memória.",
    capabilities: [
      "Tarefas com responsável, data e situação",
      "Vínculo a casos, processos e clientes",
      "Filtros por pessoa, situação e data",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Divisão clara do trabalho", "Acompanhamento do andamento sem reuniões extras"],
    limitations: ["Tarefas são criadas e atualizadas manualmente pela equipe"],
    availability: "available",
    demoView: "tarefas",
    requiresAuthFor: ["Criar tarefa", "Atribuir responsável"],
  },
  {
    slug: "relatorios",
    category: "gestao_juridica",
    name: "Relatórios",
    summary: "Resumos da carteira e da atividade da equipe a partir das informações cadastradas.",
    problem: "Sem dados organizados, é difícil saber como está a carga de trabalho e a carteira.",
    capabilities: [
      "Resumo de casos, prazos e tarefas por situação",
      "Visão por responsável e por área",
      "Painel de acompanhamento com os dados cadastrados",
    ],
    audience: ["Escritórios", "Departamentos jurídicos", "Empresas"],
    benefits: ["Decisões de gestão com base nos dados da própria equipe"],
    limitations: [
      "Os números refletem apenas o que foi cadastrado na plataforma",
      "Relatórios avançados e exportações podem variar conforme o plano",
    ],
    availability: "available",
    demoView: "painel",
    requiresAuthFor: ["Ver relatórios da organização"],
  },
  {
    slug: "clientes",
    category: "atendimento",
    name: "Clientes",
    summary: "Cadastro de clientes com dados de contato, casos vinculados e histórico de atendimento.",
    problem: "Dados de clientes espalhados dificultam o atendimento e a continuidade do trabalho.",
    capabilities: [
      "Cadastro de pessoas físicas e jurídicas",
      "Casos, documentos e atendimentos vinculados ao cliente",
      "Histórico de contatos",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Relacionamento com o cliente mais organizado", "Histórico acessível à equipe"],
    limitations: [
      "O tratamento de dados pessoais segue as regras da organização e a legislação aplicável",
    ],
    availability: "available",
    demoView: "clientes",
    requiresAuthFor: ["Cadastrar cliente"],
  },
  {
    slug: "contatos",
    category: "atendimento",
    name: "Contatos",
    summary: "Agenda de contatos de partes, peritos, testemunhas, parceiros e demais envolvidos.",
    problem: "Telefones e e-mails de pessoas envolvidas nos casos ficam perdidos em conversas.",
    capabilities: [
      "Cadastro de contatos com função em cada caso",
      "Vínculo a casos e processos",
      "Busca rápida por nome ou organização",
    ],
    audience: ["Advogados", "Escritórios", "Empresas"],
    benefits: ["Informações de contato à mão quando necessário"],
    limitations: ["Contatos são cadastrados manualmente"],
    availability: "available",
    demoView: "clientes",
    requiresAuthFor: ["Cadastrar contato"],
  },
  {
    slug: "atendimentos",
    category: "atendimento",
    name: "Atendimentos",
    summary: "Registre atendimentos, retornos e combinados feitos com clientes.",
    problem: "O que foi combinado com o cliente se perde quando não fica registrado.",
    capabilities: [
      "Registro de atendimentos com data, assunto e responsável",
      "Retornos pendentes e próximos passos",
      "Vínculo ao cliente e ao caso",
    ],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Histórico de relacionamento confiável", "Menos esquecimento de retornos"],
    limitations: ["Os registros são feitos manualmente pela equipe"],
    availability: "available",
    demoView: "clientes",
    requiresAuthFor: ["Registrar atendimento"],
  },
  {
    slug: "potenciais-clientes",
    category: "atendimento",
    name: "Potenciais clientes e oportunidades",
    summary: "Acompanhe contatos de potenciais clientes desde o primeiro atendimento até a contratação.",
    problem: "Sem acompanhamento, oportunidades de atendimento são esquecidas.",
    capabilities: [
      "Cadastro de potenciais clientes e origem do contato",
      "Acompanhamento de oportunidades por etapas",
      "Conversão do potencial cliente em cliente",
    ],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Visão de quantos contatos estão em andamento", "Retorno no tempo certo"],
    limitations: ["Não substitui a análise profissional de cada caso e de cada contratação"],
    availability: "available",
    demoView: "clientes",
    requiresAuthFor: ["Cadastrar potencial cliente", "Mover oportunidade de etapa"],
  },
  {
    slug: "atendimento-online",
    category: "atendimento",
    name: "Atendimento online",
    summary: "Receba solicitações de pessoas que buscam orientação jurídica, com triagem organizada.",
    problem:
      "Pessoas e empresas têm dificuldade de saber como iniciar o contato com um profissional.",
    capabilities: [
      "Formulário de solicitação com triagem inicial",
      "Encaminhamento a profissionais cadastrados",
      "Acompanhamento da solicitação pelo solicitante",
    ],
    audience: ["Clientes", "Advogados", "Escritórios"],
    benefits: ["Primeiro contato mais claro", "Informações iniciais já organizadas para o profissional"],
    limitations: [
      "A plataforma não presta consultoria jurídica",
      "A relação profissional é estabelecida diretamente com o advogado ou escritório",
    ],
    availability: "available",
    requiresAuthFor: ["Enviar solicitação", "Acompanhar solicitação"],
  },
  {
    slug: "portal-cliente",
    category: "atendimento",
    name: "Portal do cliente",
    summary: "Área em que o cliente acompanha informações que o escritório decidir compartilhar.",
    problem: "Clientes ligam ou escrevem repetidas vezes para saber o que está acontecendo.",
    capabilities: [
      "Acesso próprio para o cliente",
      "Compartilhamento seletivo de documentos e informações",
      "Canal organizado de comunicação",
    ],
    audience: ["Clientes", "Escritórios"],
    benefits: ["Transparência com o cliente", "Menos interrupções com pedidos de atualização"],
    limitations: ["O escritório controla o que é compartilhado em cada caso"],
    availability: "available",
    requiresAuthFor: ["Acessar o portal"],
  },
  {
    slug: "documentos",
    category: "documentos",
    name: "Documentos",
    summary: "Envie e organize arquivos por caso, com pastas, tipos e histórico.",
    problem: "Arquivos em e-mails e pastas locais são difíceis de achar e de compartilhar com segurança.",
    capabilities: [
      "Envio de arquivos vinculados a casos, processos e clientes",
      "Classificação por tipo de documento",
      "Busca por nome e informações cadastradas",
      "Controle de quem pode visualizar",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Documentos sempre ligados ao caso certo", "Acesso controlado por permissões"],
    limitations: [
      "Tipos e tamanhos de arquivo aceitos podem ter limites",
      "A leitura automática do conteúdo depende de recursos ainda em desenvolvimento",
    ],
    availability: "available",
    demoView: "documentos",
    requiresAuthFor: ["Enviar arquivo", "Compartilhar documento"],
  },
  {
    slug: "dossies",
    category: "documentos",
    name: "Dossiês",
    summary: "Monte conjuntos organizados de documentos e informações sobre um caso ou assunto.",
    problem: "Reunir tudo o que é necessário para uma reunião, análise ou entrega consome tempo.",
    capabilities: [
      "Seleção de documentos e informações de um caso",
      "Ordenação e agrupamento por tema",
      "Registro de observações da equipe",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Material organizado para análise e apresentação"],
    limitations: ["A montagem do dossiê é feita pela equipe, a partir dos documentos cadastrados"],
    availability: "available",
    demoView: "documentos",
    requiresAuthFor: ["Criar dossiê"],
  },
  {
    slug: "contratos",
    category: "documentos",
    name: "Contratos",
    summary: "Organize contratos, vigências e obrigações, com modelos para apoiar a elaboração.",
    problem: "Vencimentos e obrigações contratuais passam despercebidos sem um controle central.",
    capabilities: [
      "Cadastro de contratos com partes, vigência e valores",
      "Alertas de vencimento dentro da plataforma",
      "Modelos de documentos para consulta e adaptação",
    ],
    audience: ["Empresas", "Departamentos jurídicos", "Escritórios"],
    benefits: ["Visão dos contratos em vigor", "Menos risco de perder vencimentos"],
    limitations: [
      "Modelos são pontos de partida e exigem revisão profissional",
      "A plataforma não substitui a análise jurídica do contrato",
    ],
    availability: "available",
    demoView: "documentos",
    requiresAuthFor: ["Cadastrar contrato", "Usar modelo"],
  },
  {
    slug: "calculo-previdenciario",
    category: "previdenciario",
    name: "Cálculo previdenciário",
    summary: "Apoio ao cálculo de tempo de contribuição e valores em casos previdenciários.",
    problem: "Cálculos previdenciários feitos à mão são lentos e sujeitos a erro.",
    capabilities: [
      "Entrada de períodos e valores de contribuição",
      "Simulação de tempo e de valores",
      "Registro do cálculo vinculado ao caso",
    ],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Estimativas mais rápidas para análise do caso"],
    limitations: [
      "Resultados são estimativas e exigem conferência do profissional",
      "Não substituem os cálculos oficiais do INSS",
    ],
    availability: "available",
    requiresAuthFor: ["Salvar cálculo no caso"],
  },
  {
    slug: "protocolo-inss",
    category: "previdenciario",
    name: "Protocolo junto ao INSS",
    summary: "Envio de requerimentos diretamente aos canais oficiais do INSS.",
    problem: "O protocolo exige acessar canais oficiais separadamente da gestão do caso.",
    capabilities: ["Previsto: protocolo integrado aos canais oficiais, quando houver viabilidade"],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Menos trocas entre sistemas, quando estiver disponível"],
    limitations: [
      "Não está disponível",
      "Não há prazo definido",
      "Depende de condições técnicas e de autorização dos órgãos responsáveis",
    ],
    availability: "planned",
    requiresAuthFor: [],
  },
  {
    slug: "marketplace-juridico",
    category: "marketplace",
    name: "Marketplace jurídico",
    summary: "Encontre profissionais e serviços jurídicos e veja como cada um funciona antes de contratar.",
    problem: "Não é simples comparar profissionais e entender o que cada serviço inclui.",
    capabilities: [
      "Catálogo de profissionais e serviços",
      "Descrição do que está incluído e do que não está",
      "Solicitação de contato ou de proposta",
    ],
    audience: ["Clientes", "Empresas", "Advogados"],
    benefits: ["Comparação mais transparente", "Primeiro contato organizado"],
    limitations: [
      "A navegação pelo catálogo é pública; solicitar contato exige conta",
      "A contratação e a prestação do serviço ocorrem diretamente com o profissional",
      "A plataforma não garante resultado de nenhum serviço jurídico",
    ],
    availability: "available",
    demoView: "marketplace",
    requiresAuthFor: ["Solicitar contato", "Solicitar proposta", "Contratar serviço"],
  },
  {
    slug: "perfil-profissional",
    category: "marketplace",
    name: "Perfil profissional",
    summary: "Apresente sua atuação, áreas e serviços no marketplace.",
    problem: "Profissionais precisam de um espaço próprio para se apresentar com clareza.",
    capabilities: [
      "Perfil com áreas de atuação e descrição dos serviços",
      "Informação do número de inscrição profissional",
      "Gestão dos serviços oferecidos",
    ],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Apresentação profissional organizada"],
    limitations: [
      "A exibição de perfis segue as regras de publicidade da advocacia",
      "A confirmação de inscrição profissional depende de verificação",
    ],
    availability: "available",
    demoView: "marketplace",
    requiresAuthFor: ["Criar perfil profissional", "Publicar serviço"],
  },
  {
    slug: "honorarios",
    category: "financeiro",
    name: "Honorários",
    summary: "Registre honorários, parcelas e vencimentos de cada cliente e caso.",
    problem: "Controlar o que foi combinado, cobrado e recebido costuma ser trabalhoso.",
    capabilities: [
      "Registro de honorários contratados e parcelas",
      "Situação de cada parcela: a vencer, paga ou em atraso",
      "Vínculo a clientes e casos",
    ],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Visão do que está a receber e do que está em atraso"],
    limitations: [
      "Os registros são manuais",
      "A baixa de valores recebidos fora da plataforma é feita pelo usuário",
    ],
    availability: "available",
    demoView: "financeiro",
    requiresAuthFor: ["Registrar honorários"],
  },
  {
    slug: "cobrancas-asaas",
    category: "financeiro",
    name: "Cobranças e assinaturas pelo Asaas",
    summary: "Emissão de cobranças e assinaturas por meio do provedor de pagamentos Asaas.",
    problem: "Emitir e conciliar cobranças em sistemas separados gera trabalho manual.",
    capabilities: [
      "Em testes: criação de cobranças e assinaturas pelo provedor",
      "Em testes: atualização da situação do pagamento na plataforma",
    ],
    audience: ["Advogados", "Escritórios", "Clientes"],
    benefits: ["Menos conciliação manual, quando estiver liberado"],
    limitations: [
      "Em fase de testes controlados",
      "Não está aberto para pagamentos reais de forma geral",
      "Condições, valores e meios de pagamento podem mudar até a liberação",
    ],
    availability: "in_test",
    demoView: "financeiro",
    requiresAuthFor: ["Participar dos testes de cobrança"],
  },
  {
    slug: "organizacoes",
    category: "empresarial",
    name: "Organizações",
    summary: "Crie a organização do seu escritório ou departamento e mantenha os dados separados dos demais.",
    problem: "Cada escritório ou empresa precisa de um espaço próprio, com seus dados protegidos.",
    capabilities: [
      "Criação e configuração da organização",
      "Convite de pessoas para participar",
      "Dados de cada organização isolados das demais",
    ],
    audience: ["Escritórios", "Empresas", "Departamentos jurídicos"],
    benefits: ["Estrutura própria para a rotina da equipe"],
    limitations: ["O acesso depende dos perfis e permissões definidos pela organização"],
    availability: "available",
    demoView: "painel",
    requiresAuthFor: ["Criar organização", "Convidar pessoas"],
  },
  {
    slug: "equipes",
    category: "empresarial",
    name: "Equipes",
    summary: "Organize pessoas em equipes por área, carteira ou projeto.",
    problem: "Escritórios e departamentos precisam dividir responsabilidades de forma clara.",
    capabilities: [
      "Criação de equipes dentro da organização",
      "Atribuição de casos, tarefas e prazos à equipe ou à pessoa",
      "Visão do trabalho por equipe",
    ],
    audience: ["Escritórios", "Departamentos jurídicos"],
    benefits: ["Divisão de trabalho clara e acompanhável"],
    limitations: ["A estrutura de equipes é definida e mantida manualmente"],
    availability: "available",
    demoView: "painel",
    requiresAuthFor: ["Criar equipe"],
  },
  {
    slug: "permissoes",
    category: "empresarial",
    name: "Perfis de acesso e permissões",
    summary: "Defina quem pode ver e fazer o quê dentro da organização.",
    problem: "Informações sensíveis não devem estar abertas a todos da equipe.",
    capabilities: [
      "Perfis de acesso por função",
      "Controle de visualização e edição de informações",
      "Registro de ações importantes para conferência",
    ],
    audience: ["Escritórios", "Empresas", "Departamentos jurídicos"],
    benefits: ["Acesso proporcional à função de cada pessoa"],
    limitations: ["Cabe à organização revisar periodicamente quem tem acesso a quê"],
    availability: "available",
    requiresAuthFor: ["Gerenciar permissões"],
  },
  {
    slug: "fluxos-trabalho",
    category: "automacao",
    name: "Fluxos de trabalho",
    summary: "Modelos de etapas para padronizar rotinas repetidas da equipe.",
    problem: "Rotinas repetidas feitas de maneiras diferentes geram falhas e retrabalho.",
    capabilities: [
      "Modelos de etapas para rotinas comuns",
      "Atribuição de responsáveis a cada etapa",
      "Acompanhamento do andamento da rotina",
    ],
    audience: ["Escritórios", "Departamentos jurídicos", "Empresas"],
    benefits: ["Padronização do trabalho", "Visibilidade do que está pendente"],
    limitations: [
      "As etapas são conduzidas pela equipe; não há execução automática de atos jurídicos",
    ],
    availability: "available",
    demoView: "tarefas",
    requiresAuthFor: ["Criar fluxo de trabalho"],
  },
  {
    slug: "lembretes",
    category: "automacao",
    name: "Lembretes e avisos",
    summary: "Avisos de prazos, tarefas e compromissos para quem precisa agir.",
    problem: "Sem avisos, prazos e tarefas dependem da lembrança de cada pessoa.",
    capabilities: [
      "Avisos de itens próximos do vencimento",
      "Notificações dentro da plataforma",
      "Preferências de aviso por pessoa",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Menos itens esquecidos"],
    limitations: [
      "Avisos não substituem o controle do profissional sobre seus prazos",
      "A entrega por canais externos pode variar conforme a configuração",
    ],
    availability: "available",
    demoView: "tarefas",
    requiresAuthFor: ["Configurar avisos"],
  },
  {
    slug: "assistente-ia",
    category: "inteligencia_artificial",
    name: "Assistente de IA",
    summary: "Apoio por inteligência artificial para dúvidas de uso e organização do trabalho.",
    problem: "Encontrar informações e entender como usar a plataforma exige tempo.",
    capabilities: [
      "Em desenvolvimento: respostas sobre o uso da plataforma",
      "Em desenvolvimento: apoio à organização de informações do caso",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Apoio ao trabalho, sempre com revisão de um profissional"],
    limitations: [
      "Em desenvolvimento e dependente de provedor de IA configurado",
      "Não está disponível para uso aberto",
      "Não presta consultoria jurídica e pode errar",
      "Todo conteúdo gerado exige revisão profissional",
    ],
    availability: "in_development",
    requiresAuthFor: ["Usar o assistente"],
  },
  {
    slug: "analise-documentos",
    category: "inteligencia_artificial",
    name: "Leitura e análise de documentos",
    summary: "Apoio à leitura de documentos e à extração de informações, com revisão humana.",
    problem: "Ler e resumir grandes volumes de documentos consome horas de trabalho.",
    capabilities: [
      "Em desenvolvimento: leitura de documentos digitalizados",
      "Em desenvolvimento: resumo e indicação de pontos de atenção",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Primeira leitura mais rápida, a ser conferida pelo profissional"],
    limitations: [
      "Em desenvolvimento e dependente de provedor de IA",
      "Não está disponível para uso aberto",
      "Resultados podem conter erros e não substituem a leitura do profissional",
    ],
    availability: "in_development",
    requiresAuthFor: ["Analisar documento"],
  },
  {
    slug: "peticoes-assistidas",
    category: "inteligencia_artificial",
    name: "Apoio à elaboração de peças",
    summary: "Sugestões de estrutura e redação para peças, sempre sujeitas à revisão do advogado.",
    problem: "A primeira versão de uma peça consome tempo que poderia ir para a estratégia.",
    capabilities: [
      "Em desenvolvimento: sugestão de estrutura de peças",
      "Em desenvolvimento: apoio à redação a partir de informações do caso",
    ],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Ponto de partida para a redação, a ser revisado pelo advogado"],
    limitations: [
      "Em desenvolvimento e dependente de provedor de IA",
      "Não está disponível para uso aberto",
      "Não protocola peças em tribunais",
      "O conteúdo exige conferência de fatos, fundamentos e citações",
    ],
    availability: "in_development",
    requiresAuthFor: ["Elaborar peça com apoio assistido"],
  },
  {
    slug: "integracao-tribunais",
    category: "integracoes",
    name: "Integração com tribunais",
    summary: "Consulta de andamentos e protocolo eletrônico diretamente nos sistemas dos tribunais.",
    problem: "Acompanhar andamentos exige acessar vários sistemas separadamente.",
    capabilities: [
      "Previsto: consulta automática de andamentos",
      "Previsto: protocolo eletrônico integrado",
    ],
    audience: ["Advogados", "Escritórios", "Departamentos jurídicos"],
    benefits: ["Menos trabalho manual de acompanhamento, quando estiver disponível"],
    limitations: [
      "Não está disponível",
      "Não há prazo definido",
      "Hoje a plataforma não realiza protocolo nem consulta automática em tribunais",
    ],
    availability: "planned",
    requiresAuthFor: [],
  },
  {
    slug: "integracao-pagamentos",
    category: "integracoes",
    name: "Integração de pagamentos",
    summary: "Conexão com o provedor de pagamentos Asaas para cobranças e assinaturas.",
    problem: "Receber pagamentos exige conciliação manual entre sistemas.",
    capabilities: [
      "Em testes: conexão com o provedor de pagamentos",
      "Em testes: retorno da situação do pagamento",
    ],
    audience: ["Escritórios", "Advogados"],
    benefits: ["Menos conciliação manual, quando estiver liberado"],
    limitations: [
      "Em fase de testes controlados",
      "Não está aberto para pagamentos reais de forma geral",
    ],
    availability: "in_test",
    requiresAuthFor: ["Participar dos testes"],
  },
  {
    slug: "integracao-email",
    category: "integracoes",
    name: "Integração com e-mail",
    summary: "Conexão com caixas de e-mail para vincular mensagens a casos.",
    problem: "Mensagens importantes ficam fora do histórico do caso.",
    capabilities: ["Em desenvolvimento: vínculo de mensagens a casos e clientes"],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Histórico do caso mais completo, quando estiver disponível"],
    limitations: ["Em desenvolvimento", "Não está disponível para uso", "Sem previsão de data"],
    availability: "in_development",
    requiresAuthFor: [],
  },
  {
    slug: "integracao-agenda",
    category: "integracoes",
    name: "Integração com agendas externas",
    summary: "Sincronização de compromissos com calendários de uso pessoal ou corporativo.",
    problem: "Manter duas agendas atualizadas gera conflitos e esquecimentos.",
    capabilities: ["Em desenvolvimento: sincronização de compromissos com agendas externas"],
    audience: ["Advogados", "Escritórios"],
    benefits: ["Compromissos atualizados em um só lugar, quando estiver disponível"],
    limitations: ["Em desenvolvimento", "Não está disponível para uso", "Sem previsão de data"],
    availability: "in_development",
    requiresAuthFor: [],
  },
  {
    slug: "integracao-ia",
    category: "integracoes",
    name: "Integração com provedores de IA",
    summary: "Conexão com provedores de inteligência artificial para os recursos assistidos.",
    problem: "Os recursos assistidos dependem de um provedor de IA configurado e contratado.",
    capabilities: ["Em desenvolvimento: conexão com provedores de IA"],
    audience: ["Escritórios", "Departamentos jurídicos"],
    benefits: ["Base para os recursos assistidos, quando estiverem disponíveis"],
    limitations: [
      "Em desenvolvimento",
      "Os recursos dependem de provedor configurado e não estão abertos ao uso",
    ],
    availability: "in_development",
    requiresAuthFor: [],
  },
];

export function getFeature(slug: string): CatalogFeature | undefined {
  return PUBLIC_CATALOG.find((feature) => feature.slug === slug);
}

export function listByCategory(category: CatalogCategory): CatalogFeature[] {
  return PUBLIC_CATALOG.filter((feature) => feature.category === category);
}

export function listCategories(): CatalogCategory[] {
  return (Object.keys(CATEGORY_META) as CatalogCategory[]).sort(
    (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order,
  );
}

export function listByAvailability(availability: Availability): CatalogFeature[] {
  return PUBLIC_CATALOG.filter((feature) => feature.availability === availability);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchFeatures(query: string): CatalogFeature[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...PUBLIC_CATALOG];
  return PUBLIC_CATALOG.filter((feature) => {
    const haystack = normalize(
      [
        feature.slug.replaceAll("-", " "),
        feature.name,
        feature.summary,
        feature.problem,
        CATEGORY_META[feature.category].label,
        ...feature.capabilities,
        ...feature.audience,
        ...feature.benefits,
      ].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
