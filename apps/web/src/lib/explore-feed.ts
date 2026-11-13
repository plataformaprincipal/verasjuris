/** Conteúdo demonstrativo do feed público — nunca misturar com publicações reais. */

export const FEED_DEMO_BANNER =
  "Feed demonstrativo — publicações fictícias para apresentar a experiência. Não são perfis reais.";

export type FeedDemoPost = {
  id: string;
  author: string;
  persona: string;
  verifiedLabel?: string;
  publishedAt: string;
  body: string;
  topic: string;
};

export const FEED_DEMO_POSTS: FeedDemoPost[] = [
  {
    id: "post-demo-001",
    author: "Perfil Demonstrativo A",
    persona: "Advogado (exemplo)",
    verifiedLabel: "Verificação demonstrativa",
    publishedAt: "Há 2 horas (exemplo)",
    body: "Compartilhamento educativo fictício sobre organização de prazos e rotina de escritório. Conteúdo meramente ilustrativo.",
    topic: "Produtividade",
  },
  {
    id: "post-demo-002",
    author: "Organização Demonstração VerasJuris",
    persona: "Escritório (exemplo)",
    publishedAt: "Ontem (exemplo)",
    body: "Atualização institucional fictícia sobre boas práticas de documentação. Nenhum caso real é citado.",
    topic: "Gestão",
  },
  {
    id: "post-demo-003",
    author: "Parceiro Exemplo C",
    persona: "Parceiro (exemplo)",
    publishedAt: "Há 3 dias (exemplo)",
    body: "Nota demonstrativa sobre serviços de apoio operacional. Não constitui oferta comercial real.",
    topic: "Serviços",
  },
];

export const FEED_TOPICS = ["Produtividade", "Gestão", "Serviços", "Educação", "Tecnologia"] as const;
