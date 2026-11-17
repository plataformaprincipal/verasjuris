import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = path.join(root, "src/lib/i18n/messages");
const locales = ["pt-BR", "en-US", "es-ES"];

const categories = {
  gestao_juridica: {
    "pt-BR": {
      label: "Gestão jurídica",
      description: "Processos, casos, prazos, agenda e tarefas em um só lugar.",
    },
    "en-US": {
      label: "Legal management",
      description: "Cases, matters, deadlines, calendar, and tasks in one place.",
    },
    "es-ES": {
      label: "Gestión jurídica",
      description: "Procesos, casos, plazos, agenda y tareas en un solo lugar.",
    },
  },
  atendimento: {
    "pt-BR": {
      label: "Atendimento",
      description: "Clientes, contatos, atendimentos e acompanhamento de oportunidades.",
    },
    "en-US": {
      label: "Client service",
      description: "Clients, contacts, intakes, and opportunity follow-up.",
    },
    "es-ES": {
      label: "Atención",
      description: "Clientes, contactos, atenciones y seguimiento de oportunidades.",
    },
  },
  documentos: {
    "pt-BR": {
      label: "Documentos",
      description: "Arquivos, dossiês, contratos e modelos organizados por caso.",
    },
    "en-US": {
      label: "Documents",
      description: "Files, dossiers, contracts, and templates organized by matter.",
    },
    "es-ES": {
      label: "Documentos",
      description: "Archivos, dosieres, contratos y modelos organizados por caso.",
    },
  },
  previdenciario: {
    "pt-BR": {
      label: "Previdenciário",
      description: "Apoio ao cálculo e à organização de casos previdenciários.",
    },
    "en-US": {
      label: "Social security",
      description: "Support for calculating and organizing social-security cases.",
    },
    "es-ES": {
      label: "Previsional",
      description: "Apoyo al cálculo y a la organización de casos previsionales.",
    },
  },
  marketplace: {
    "pt-BR": {
      label: "Marketplace jurídico",
      description: "Encontre profissionais e serviços jurídicos com transparência.",
    },
    "en-US": {
      label: "Legal marketplace",
      description: "Find legal professionals and services with transparency.",
    },
    "es-ES": {
      label: "Marketplace jurídico",
      description: "Encuentre profesionales y servicios jurídicos con transparencia.",
    },
  },
  financeiro: {
    "pt-BR": { label: "Financeiro", description: "Honorários, cobranças e assinaturas." },
    "en-US": { label: "Billing", description: "Fees, collections, and subscriptions." },
    "es-ES": { label: "Financiero", description: "Honorarios, cobros y suscripciones." },
  },
  empresarial: {
    "pt-BR": {
      label: "Organizações e equipes",
      description: "Estrutura, perfis de acesso e permissões para escritórios e empresas.",
    },
    "en-US": {
      label: "Organizations and teams",
      description: "Structure, access profiles, and permissions for firms and companies.",
    },
    "es-ES": {
      label: "Organizaciones y equipos",
      description: "Estructura, perfiles de acceso y permisos para despachos y empresas.",
    },
  },
  automacao: {
    "pt-BR": {
      label: "Automação",
      description: "Fluxos de trabalho e lembretes para reduzir tarefas repetitivas.",
    },
    "en-US": {
      label: "Automation",
      description: "Workflows and reminders to reduce repetitive tasks.",
    },
    "es-ES": {
      label: "Automatización",
      description: "Flujos de trabajo y recordatorios para reducir tareas repetitivas.",
    },
  },
  inteligencia_artificial: {
    "pt-BR": {
      label: "Inteligência artificial",
      description: "Apoio assistido por IA, sempre com revisão profissional.",
    },
    "en-US": {
      label: "Artificial intelligence",
      description: "AI-assisted support, always with professional review.",
    },
    "es-ES": {
      label: "Inteligencia artificial",
      description: "Apoyo asistido por IA, siempre con revisión profesional.",
    },
  },
  integracoes: {
    "pt-BR": {
      label: "Integrações",
      description: "Conexões com serviços externos, conforme a disponibilidade de cada uma.",
    },
    "en-US": {
      label: "Integrations",
      description: "Connections to external services, subject to each one's availability.",
    },
    "es-ES": {
      label: "Integraciones",
      description: "Conexiones con servicios externos, según la disponibilidad de cada una.",
    },
  },
};

const availabilityDesc = {
  available: {
    "pt-BR": "Disponível na plataforma, com operação manual pelo usuário.",
    "en-US": "Available on the platform, with manual operation by the user.",
    "es-ES": "Disponible en la plataforma, con operación manual por el usuario.",
  },
  in_test: {
    "pt-BR": "Em fase de testes controlados. Ainda não é uma operação aberta ao público.",
    "en-US": "In controlled testing. Not yet an open public operation.",
    "es-ES": "En fase de pruebas controladas. Aún no es una operación abierta al público.",
  },
  in_development: {
    "pt-BR": "Em construção. Ainda não está disponível para uso.",
    "en-US": "Under construction. Not yet available for use.",
    "es-ES": "En construcción. Aún no está disponible para uso.",
  },
  planned: {
    "pt-BR": "Previsto para o futuro, sem data definida.",
    "en-US": "Planned for the future, with no set date.",
    "es-ES": "Previsto para el futuro, sin fecha definida.",
  },
};

const solutions = {
  advogados: {
    "pt-BR": {
      title: "Para advogados",
      summary:
        "Organize processos, prazos, clientes e documentos em um só lugar, mantendo o controle da sua atuação.",
    },
    "en-US": {
      title: "For lawyers",
      summary:
        "Organize cases, deadlines, clients, and documents in one place while keeping control of your practice.",
    },
    "es-ES": {
      title: "Para abogados",
      summary:
        "Organice procesos, plazos, clientes y documentos en un solo lugar, manteniendo el control de su actuación.",
    },
  },
  escritorios: {
    "pt-BR": {
      title: "Para escritórios",
      summary:
        "Estruture a equipe, divida o trabalho e acompanhe a carteira do escritório com perfis de acesso definidos.",
    },
    "en-US": {
      title: "For law firms",
      summary:
        "Structure the team, divide work, and track the firm's portfolio with defined access profiles.",
    },
    "es-ES": {
      title: "Para despachos",
      summary:
        "Estructure el equipo, divida el trabajo y siga la cartera del despacho con perfiles de acceso definidos.",
    },
  },
  empresas: {
    "pt-BR": {
      title: "Para empresas",
      summary:
        "Acompanhe contratos, procedimentos e contatos com profissionais jurídicos de forma organizada.",
    },
    "en-US": {
      title: "For companies",
      summary:
        "Track contracts, procedures, and contacts with legal professionals in an organized way.",
    },
    "es-ES": {
      title: "Para empresas",
      summary:
        "Siga contratos, procedimientos y contactos con profesionales jurídicos de forma organizada.",
    },
  },
  "departamentos-juridicos": {
    "pt-BR": {
      title: "Para departamentos jurídicos",
      summary:
        "Centralize casos, contratos, prazos e equipe do departamento, com permissões e relatórios.",
    },
    "en-US": {
      title: "For legal departments",
      summary:
        "Centralize matters, contracts, deadlines, and the department team, with permissions and reports.",
    },
    "es-ES": {
      title: "Para departamentos jurídicos",
      summary:
        "Centralice casos, contratos, plazos y el equipo del departamento, con permisos e informes.",
    },
  },
  clientes: {
    "pt-BR": {
      title: "Para clientes",
      summary:
        "Encontre profissionais, envie sua solicitação e acompanhe as informações que seu advogado compartilhar.",
    },
    "en-US": {
      title: "For clients",
      summary:
        "Find professionals, submit your request, and follow the information your lawyer shares.",
    },
    "es-ES": {
      title: "Para clientes",
      summary:
        "Encuentre profesionales, envíe su solicitud y siga la información que su abogado comparta.",
    },
  },
};

const demo = {
  "demo.banner": {
    "pt-BR": "Ambiente demonstrativo — informações fictícias.",
    "en-US": "Demo environment — fictional information.",
    "es-ES": "Entorno de demostración — información ficticia.",
  },
  "demo.organization": {
    "pt-BR": "Organização Demonstração VerasJuris",
    "en-US": "VerasJuris Demo Organization",
    "es-ES": "Organización de demostración VerasJuris",
  },
  "demo.previewAria": {
    "pt-BR": "Prévia visual do ambiente VerasJuris",
    "en-US": "Visual preview of the VerasJuris environment",
    "es-ES": "Vista previa visual del entorno VerasJuris",
  },
  "demo.openFull": {
    "pt-BR": "Abrir demonstração interativa",
    "en-US": "Open interactive demo",
    "es-ES": "Abrir demostración interactiva",
  },
  "demo.viewPlaceholder": {
    "pt-BR":
      "Visualização demonstrativa de {view}. Abra a demonstração completa para navegar com mais detalhes.",
    "en-US": "Demo view of {view}. Open the full demo to browse with more detail.",
    "es-ES":
      "Vista demostrativa de {view}. Abra la demostración completa para navegar con más detalle.",
  },
  "demo.view.painel": { "pt-BR": "Painel", "en-US": "Dashboard", "es-ES": "Panel" },
  "demo.view.clientes": { "pt-BR": "Clientes", "en-US": "Clients", "es-ES": "Clientes" },
  "demo.view.processos": { "pt-BR": "Processos", "en-US": "Cases", "es-ES": "Procesos" },
  "demo.view.documentos": { "pt-BR": "Documentos", "en-US": "Documents", "es-ES": "Documentos" },
  "demo.view.tarefas": {
    "pt-BR": "Prazos e tarefas",
    "en-US": "Deadlines and tasks",
    "es-ES": "Plazos y tareas",
  },
  "demo.view.agenda": { "pt-BR": "Agenda", "en-US": "Calendar", "es-ES": "Agenda" },
  "demo.view.financeiro": { "pt-BR": "Financeiro", "en-US": "Billing", "es-ES": "Financiero" },
  "demo.view.marketplace": {
    "pt-BR": "Marketplace",
    "en-US": "Marketplace",
    "es-ES": "Marketplace",
  },
  "demo.marketplace.servico-001.title": {
    "pt-BR": "Serviço Exemplo 001 — Orientação inicial",
    "en-US": "Sample service 001 — Initial guidance",
    "es-ES": "Servicio de ejemplo 001 — Orientación inicial",
  },
  "demo.marketplace.servico-001.description": {
    "pt-BR": "Descrição fictícia de um serviço de análise inicial de documentos.",
    "en-US": "Fictional description of an initial document-review service.",
    "es-ES": "Descripción ficticia de un servicio de análisis inicial de documentos.",
  },
  "demo.marketplace.servico-001.provider": {
    "pt-BR": "Profissional Exemplo A",
    "en-US": "Sample professional A",
    "es-ES": "Profesional de ejemplo A",
  },
  "demo.marketplace.servico-001.area": { "pt-BR": "Cível", "en-US": "Civil", "es-ES": "Civil" },
  "demo.marketplace.servico-002.title": {
    "pt-BR": "Serviço Exemplo 002 — Revisão de contrato",
    "en-US": "Sample service 002 — Contract review",
    "es-ES": "Servicio de ejemplo 002 — Revisión de contrato",
  },
  "demo.marketplace.servico-002.description": {
    "pt-BR": "Descrição fictícia de um serviço de revisão de contrato.",
    "en-US": "Fictional description of a contract-review service.",
    "es-ES": "Descripción ficticia de un servicio de revisión de contrato.",
  },
  "demo.marketplace.servico-002.provider": {
    "pt-BR": "Escritório Exemplo B",
    "en-US": "Sample firm B",
    "es-ES": "Despacho de ejemplo B",
  },
  "demo.marketplace.servico-002.area": {
    "pt-BR": "Empresarial",
    "en-US": "Corporate",
    "es-ES": "Empresarial",
  },
  "demo.marketplace.servico-003.title": {
    "pt-BR": "Serviço Exemplo 003 — Planejamento previdenciário",
    "en-US": "Sample service 003 — Social-security planning",
    "es-ES": "Servicio de ejemplo 003 — Planificación previsional",
  },
  "demo.marketplace.servico-003.description": {
    "pt-BR": "Descrição fictícia de um serviço de organização de informações previdenciárias.",
    "en-US": "Fictional description of a social-security information organization service.",
    "es-ES": "Descripción ficticia de un servicio de organización de información previsional.",
  },
  "demo.marketplace.servico-003.provider": {
    "pt-BR": "Profissional Exemplo C",
    "en-US": "Sample professional C",
    "es-ES": "Profesional de ejemplo C",
  },
  "demo.marketplace.servico-003.area": {
    "pt-BR": "Previdenciário",
    "en-US": "Social security",
    "es-ES": "Previsional",
  },
  "demo.marketplace.priceNote": {
    "pt-BR": "Valor Exemplo — não representa preço real",
    "en-US": "Sample price — does not represent a real fee",
    "es-ES": "Valor de ejemplo — no representa un precio real",
  },
  "explore.feed.banner": {
    "pt-BR": "Feed demonstrativo — conteúdos ilustrativos da comunidade VerasJuris.",
    "en-US": "Demo feed — illustrative VerasJuris community content.",
    "es-ES": "Feed de demostración — contenidos ilustrativos de la comunidad VerasJuris.",
  },
};

/** @type {Record<string, Record<string, {name:string,summary:string,problem:string}>>} */
const features = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/public-feature-i18n.json"), "utf8"),
);

for (const locale of locales) {
  const filePath = path.join(messagesDir, `${locale}.json`);
  const catalog = JSON.parse(fs.readFileSync(filePath, "utf8"));

  for (const [id, byLocale] of Object.entries(categories)) {
    catalog[`catalog.category.${id}.label`] = byLocale[locale].label;
    catalog[`catalog.category.${id}.description`] = byLocale[locale].description;
  }
  for (const [id, byLocale] of Object.entries(availabilityDesc)) {
    catalog[`common.availability.${id}.description`] = byLocale[locale];
  }
  for (const [id, byLocale] of Object.entries(solutions)) {
    catalog[`solution.${id}.title`] = byLocale[locale].title;
    catalog[`solution.${id}.summary`] = byLocale[locale].summary;
  }
  for (const [key, byLocale] of Object.entries(demo)) {
    catalog[key] = byLocale[locale];
  }
  for (const [slug, byLocale] of Object.entries(features)) {
    catalog[`catalog.feature.${slug}.name`] = byLocale[locale].name;
    catalog[`catalog.feature.${slug}.summary`] = byLocale[locale].summary;
    catalog[`catalog.feature.${slug}.problem`] = byLocale[locale].problem;
  }

  const ordered = Object.fromEntries(
    Object.keys(catalog)
      .sort()
      .map((k) => [k, catalog[k]]),
  );
  fs.writeFileSync(filePath, `${JSON.stringify(ordered, null, 2)}\n`);
  console.log(locale, Object.keys(ordered).length);
}
