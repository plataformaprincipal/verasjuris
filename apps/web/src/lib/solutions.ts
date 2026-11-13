export type SolutionSlug =
  | "advogados"
  | "escritorios"
  | "empresas"
  | "departamentos-juridicos"
  | "clientes";

export type Solution = {
  slug: SolutionSlug;
  title: string;
  summary: string;
  problems: string[];
  features: string[];
  cta: { label: string; href: string };
};

export const SOLUTIONS: Solution[] = [
  {
    slug: "advogados",
    title: "Para advogados",
    summary:
      "Organize processos, prazos, clientes e documentos em um só lugar, mantendo o controle da sua atuação.",
    problems: [
      "Informações de casos espalhadas entre planilhas, e-mails e mensagens",
      "Risco de perder prazos por falta de controle centralizado",
      "Pouco tempo para organizar documentos e retornar a clientes",
    ],
    features: [
      "processos-judiciais",
      "prazos",
      "agenda",
      "clientes",
      "documentos",
      "honorarios",
      "calculo-previdenciario",
      "perfil-profissional",
    ],
    cta: { label: "Criar conta", href: "/cadastro" },
  },
  {
    slug: "escritorios",
    title: "Para escritórios",
    summary:
      "Estruture a equipe, divida o trabalho e acompanhe a carteira do escritório com perfis de acesso definidos.",
    problems: [
      "Dificuldade de dividir tarefas e acompanhar o que cada pessoa faz",
      "Falta de padrão nas rotinas entre os integrantes da equipe",
      "Informações sensíveis acessíveis a quem não precisa delas",
    ],
    features: [
      "organizacoes",
      "equipes",
      "permissoes",
      "casos",
      "tarefas",
      "fluxos-trabalho",
      "atendimentos",
      "potenciais-clientes",
      "relatorios",
      "portal-cliente",
    ],
    cta: { label: "Criar conta", href: "/cadastro" },
  },
  {
    slug: "empresas",
    title: "Para empresas",
    summary:
      "Acompanhe contratos, procedimentos e contatos com profissionais jurídicos de forma organizada.",
    problems: [
      "Contratos e vencimentos sem controle central",
      "Dificuldade de encontrar e comparar profissionais para demandas pontuais",
      "Pouca visibilidade sobre assuntos jurídicos em andamento",
    ],
    features: [
      "contratos",
      "processos-administrativos",
      "documentos",
      "marketplace-juridico",
      "atendimento-online",
      "relatorios",
    ],
    cta: { label: "Explorar o marketplace", href: "/marketplace-juridico" },
  },
  {
    slug: "departamentos-juridicos",
    title: "Para departamentos jurídicos",
    summary:
      "Centralize casos, contratos, prazos e equipe do departamento, com permissões e relatórios.",
    problems: [
      "Demandas internas sem fila nem responsável definido",
      "Prazos e contratos controlados em ferramentas diferentes",
      "Dificuldade de prestar contas do volume de trabalho",
    ],
    features: [
      "casos",
      "processos-judiciais",
      "processos-administrativos",
      "contratos",
      "prazos",
      "equipes",
      "permissoes",
      "fluxos-trabalho",
      "relatorios",
    ],
    cta: { label: "Criar conta", href: "/cadastro" },
  },
  {
    slug: "clientes",
    title: "Para clientes",
    summary:
      "Encontre profissionais, envie sua solicitação e acompanhe as informações que seu advogado compartilhar.",
    problems: [
      "Não saber por onde começar ao precisar de orientação jurídica",
      "Dificuldade de comparar profissionais e entender o que cada serviço inclui",
      "Falta de acompanhamento sobre o andamento do seu caso",
    ],
    features: ["marketplace-juridico", "atendimento-online", "portal-cliente"],
    cta: { label: "Ver o marketplace jurídico", href: "/marketplace-juridico" },
  },
];

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS.find((solution) => solution.slug === slug);
}
