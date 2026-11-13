import type { Locale } from "./i18n";
import { localFallbackReply, matchFaq, type AssistantMode } from "./assistant";

export const JURIS_ONE_GUEST_LIMIT = 5;

export const JURIS_ONE_OBJECTIVES = [
  {
    id: "orientacao",
    label: "Preciso de orientação inicial",
    hint: "FAQ e caminhos públicos da plataforma.",
  },
  {
    id: "advogado",
    label: "Sou advogado",
    hint: "Ferramentas de gestão e catálogo profissional.",
  },
  {
    id: "escritorio",
    label: "Represento um escritório",
    hint: "Soluções para equipes e operações.",
  },
  {
    id: "empresa",
    label: "Represento uma empresa",
    hint: "Departamentos jurídicos e compliance operacional.",
  },
  {
    id: "documento",
    label: "Quero analisar um documento",
    hint: "Análise real exige conta e permissões — aqui orientamos o caminho.",
  },
  {
    id: "ferramentas",
    label: "Quero conhecer ferramentas",
    hint: "Catálogo público com disponibilidade real.",
  },
  {
    id: "servico",
    label: "Quero encontrar um serviço jurídico",
    hint: "Marketplace público e próximos passos autenticados.",
  },
] as const;

export type JurisOneObjectiveId = (typeof JURIS_ONE_OBJECTIVES)[number]["id"];

export type JurisRedirect = { label: string; href: string };

export function redirectsForObjective(id: JurisOneObjectiveId | null): JurisRedirect[] {
  switch (id) {
    case "servico":
      return [
        { label: "Marketplace jurídico", href: "/marketplace-juridico" },
        { label: "Criar conta", href: "/cadastro" },
      ];
    case "ferramentas":
      return [
        { label: "Catálogo de ferramentas", href: "/ferramentas" },
        { label: "Demonstração", href: "/explorar?view=painel" },
      ];
    case "documento":
      return [
        { label: "Entrar para analisar", href: "/entrar?redirect=%2Fapp" },
        { label: "Ferramentas de documentos", href: "/ferramentas/documentos" },
      ];
    case "advogado":
    case "escritorio":
      return [
        { label: "Ferramentas", href: "/ferramentas" },
        { label: "Soluções para escritórios", href: "/solucoes/escritorios" },
        { label: "Planos", href: "/planos" },
      ];
    case "empresa":
      return [
        { label: "Soluções para empresas", href: "/solucoes/empresas" },
        { label: "Planos", href: "/planos" },
      ];
    case "orientacao":
    default:
      return [
        { label: "Explorar a plataforma", href: "/explorar" },
        { label: "Ferramentas", href: "/ferramentas" },
        { label: "Marketplace", href: "/marketplace-juridico" },
        { label: "Planos", href: "/planos" },
      ];
  }
}

export function modeForObjective(id: JurisOneObjectiveId | null): AssistantMode {
  if (id === "documento" || id === "orientacao") return "legal";
  if (id === "ferramentas") return "product";
  return "support";
}

export function jurisOneReply(
  locale: Locale,
  mode: AssistantMode,
  question: string,
  remaining: number,
): { reply: string; matchedFaq: boolean } {
  const faq = matchFaq(locale, mode, question);
  const base = faq ?? localFallbackReply(locale, mode, question);
  const limitNote =
    remaining <= 1
      ? " Você atingiu o limite da etapa gratuita de orientação nesta sessão. Crie conta, entre ou conheça os planos para continuar com recursos autenticados."
      : remaining <= 2
        ? ` Restam ${remaining - 1} interações na etapa gratuita de orientação desta sessão.`
        : "";
  const honesty =
    " Juris One, nesta etapa pública, responde com FAQ e orientação de navegação — não substitui advogado e não executa ações em dados reais.";
  return { reply: `${base}${honesty}${limitNote}`, matchedFaq: Boolean(faq) };
}

export const JURIS_WORK_STATUS = {
  available: false as const,
  label: "Work",
  detail:
    "O modo Work (tarefas estruturadas com estado, limites e acompanhamento) ainda não está operacional nesta superfície pública. Use o Chat para orientação ou autentique-se nos módulos reais.",
};
