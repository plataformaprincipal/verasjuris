/**
 * Catálogo de órgãos, portais e procedimentos administrativos (protocolo
 * manual orientado — Documento Mestre, p. 16).
 *
 * Cada procedimento diz onde protocolar, o passo a passo, os documentos e os
 * prazos legais conhecidos. Prazo sem fonte conferida não entra com número:
 * fica como "conferir na notificação". O protocolo só é registrado com
 * comprovante anexado; nada é enviado ao órgão pela plataforma.
 */

export type DeadlineRule = {
  key: string;
  label: string;
  /** Quem precisa agir: o escritório/cliente ou o órgão (acompanhamento). */
  actor: "party" | "agency";
  days: number | null;
  counting: "calendar_days" | "business_days" | "event";
  /** Termo inicial em linguagem simples. */
  startsFrom: string;
  basis: string;
};

export type AdministrativeProcedure = {
  key: string;
  agencyCode: string;
  name: string;
  summary: string;
  portalName: string;
  portalUrl: string;
  steps: string[];
  documents: string[];
  deadlines: DeadlineRule[];
  /** Benefício previdenciário com checklist próprio, quando houver. */
  benefitKeys?: string[];
};

export type AdministrativeAgency = {
  code: string;
  name: string;
  acronym: string;
  bodyType: "federal" | "state" | "municipal" | "autarchy" | "council" | "regulatory" | "other";
  jurisdiction: "federal" | "state" | "municipal";
  stateCode: string | null;
  portalName: string;
  portalUrl: string;
};

export const ADMINISTRATIVE_AGENCIES: AdministrativeAgency[] = [
  {
    code: "INSS",
    name: "Instituto Nacional do Seguro Social",
    acronym: "INSS",
    bodyType: "autarchy",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "Meu INSS",
    portalUrl: "https://meu.inss.gov.br",
  },
  {
    code: "RFB",
    name: "Receita Federal do Brasil",
    acronym: "RFB",
    bodyType: "federal",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "e-CAC",
    portalUrl: "https://cav.receita.fazenda.gov.br",
  },
  {
    code: "PGFN",
    name: "Procuradoria-Geral da Fazenda Nacional",
    acronym: "PGFN",
    bodyType: "federal",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "Regularize",
    portalUrl: "https://www.regularize.pgfn.gov.br",
  },
  {
    code: "INPI",
    name: "Instituto Nacional da Propriedade Industrial",
    acronym: "INPI",
    bodyType: "autarchy",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
  },
  {
    code: "CGU-FALABR",
    name: "Controladoria-Geral da União — Fala.BR",
    acronym: "Fala.BR",
    bodyType: "federal",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "Fala.BR",
    portalUrl: "https://falabr.cgu.gov.br",
  },
  {
    code: "SENACON",
    name: "Secretaria Nacional do Consumidor — Consumidor.gov.br",
    acronym: "Consumidor.gov.br",
    bodyType: "federal",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "Consumidor.gov.br",
    portalUrl: "https://www.consumidor.gov.br",
  },
  {
    code: "SEI-FEDERAL",
    name: "Sistema Eletrônico de Informações — órgãos federais",
    acronym: "SEI",
    bodyType: "federal",
    jurisdiction: "federal",
    stateCode: null,
    portalName: "SEI — peticionamento eletrônico do órgão",
    portalUrl: "https://www.gov.br/economia/pt-br/assuntos/processo-eletronico-nacional",
  },
  {
    code: "PROCON-PB",
    name: "Procon da Paraíba",
    acronym: "Procon-PB",
    bodyType: "state",
    jurisdiction: "state",
    stateCode: "PB",
    portalName: "Procon-PB",
    portalUrl: "https://procon.pb.gov.br",
  },
  {
    code: "PROCON-SP",
    name: "Fundação de Proteção e Defesa do Consumidor — São Paulo",
    acronym: "Procon-SP",
    bodyType: "state",
    jurisdiction: "state",
    stateCode: "SP",
    portalName: "Procon-SP",
    portalUrl: "https://www.procon.sp.gov.br",
  },
  {
    code: "DETRAN-PB",
    name: "Departamento Estadual de Trânsito da Paraíba",
    acronym: "Detran-PB",
    bodyType: "state",
    jurisdiction: "state",
    stateCode: "PB",
    portalName: "Detran-PB",
    portalUrl: "https://detran.pb.gov.br",
  },
];

const GOV_BR_LOGIN = "Entrar com a conta gov.br do cliente ou do representante cadastrado.";
const SAVE_RECEIPT =
  "Baixar o comprovante de protocolo (PDF) e anexá-lo aqui junto com o número do protocolo.";

export const ADMINISTRATIVE_PROCEDURES: AdministrativeProcedure[] = [
  // ------------------------------------------------------------------ INSS
  {
    key: "inss.requerimento_beneficio",
    agencyCode: "INSS",
    name: "Requerimento de benefício",
    summary: "Pedido inicial de benefício previdenciário ou assistencial no Meu INSS.",
    portalName: "Meu INSS",
    portalUrl: "https://meu.inss.gov.br",
    steps: [
      GOV_BR_LOGIN,
      "Em “Novo pedido”, buscar o serviço do benefício e conferir os requisitos na tela.",
      "Preencher os dados e anexar os documentos do checklist do benefício.",
      "Se atuar como procurador, anexar procuração e termo de representação.",
      SAVE_RECEIPT,
    ],
    documents: [
      "Documento de identificação com foto e CPF do requerente",
      "Procuração e termo de representação (se houver representante)",
      "Documentos específicos do checklist do benefício",
    ],
    deadlines: [
      {
        key: "followup",
        label: "Acompanhar andamento no Meu INSS",
        actor: "agency",
        days: 30,
        counting: "calendar_days",
        startsFrom: "data do protocolo",
        basis: "Rotina interna de acompanhamento; não é prazo legal.",
      },
    ],
    benefitKeys: [
      "bpc_idoso",
      "bpc_deficiencia",
      "auxilio_incapacidade_temporaria",
      "auxilio_acidente",
      "salario_maternidade",
      "pensao_morte",
      "aposentadoria_idade_urbana",
      "aposentadoria_idade_rural",
      "aposentadoria_especial",
    ],
  },
  {
    key: "inss.cumprimento_exigencia",
    agencyCode: "INSS",
    name: "Cumprimento de exigência",
    summary: "Resposta à carta de exigência do INSS no mesmo requerimento.",
    portalName: "Meu INSS",
    portalUrl: "https://meu.inss.gov.br",
    steps: [
      GOV_BR_LOGIN,
      "Em “Consultar pedidos”, abrir o requerimento com status “Exigência”.",
      "Ler a carta de exigência e anexar exatamente o que foi pedido.",
      "Se não houver mais documentos, declarar isso por escrito para o INSS decidir o mérito.",
      SAVE_RECEIPT,
    ],
    documents: ["Documentos pedidos na carta de exigência"],
    deadlines: [
      {
        key: "exigencia",
        label: "Cumprir a exigência",
        actor: "party",
        days: 30,
        counting: "calendar_days",
        startsFrom: "ciência da carta de exigência",
        basis:
          "IN PRES/INSS 128/2022, art. 566 (mínimo de 30 dias). Vale o prazo escrito na carta. Sem resposta, o pedido pode ser encerrado sem análise do mérito (Decreto 3.048/1999, art. 176).",
      },
    ],
  },
  {
    key: "inss.recurso_ordinario",
    agencyCode: "INSS",
    name: "Recurso ordinário à Junta de Recursos (CRPS)",
    summary: "Recurso contra indeferimento ou decisão desfavorável do INSS.",
    portalName: "Meu INSS",
    portalUrl: "https://meu.inss.gov.br",
    steps: [
      GOV_BR_LOGIN,
      "Em “Novo pedido”, buscar “Recurso” e escolher o recurso ordinário.",
      "Informar o número do benefício ou do requerimento indeferido.",
      "Anexar as razões do recurso e as provas novas.",
      SAVE_RECEIPT,
    ],
    documents: ["Razões do recurso", "Decisão recorrida", "Provas novas, se houver"],
    deadlines: [
      {
        key: "recurso",
        label: "Interpor recurso ordinário",
        actor: "party",
        days: 30,
        counting: "calendar_days",
        startsFrom: "ciência da decisão",
        basis: "IN PRES/INSS 128/2022 (art. 580). Confirme a data de ciência no Meu INSS.",
      },
    ],
  },
  // ------------------------------------------------------------------ RFB
  {
    key: "rfb.impugnacao",
    agencyCode: "RFB",
    name: "Impugnação de lançamento",
    summary: "Defesa contra auto de infração ou notificação de lançamento.",
    portalName: "e-CAC",
    portalUrl: "https://cav.receita.fazenda.gov.br",
    steps: [
      "Entrar no e-CAC com gov.br ou certificado digital do contribuinte ou procurador.",
      "Em “Processos Digitais (e-Processo)”, solicitar juntada de documento ao processo do lançamento.",
      "Anexar a impugnação assinada e os documentos que a fundamentam.",
      SAVE_RECEIPT,
    ],
    documents: ["Impugnação assinada", "Auto de infração", "Provas documentais", "Procuração"],
    deadlines: [
      {
        key: "impugnacao",
        label: "Apresentar impugnação",
        actor: "party",
        days: 20,
        counting: "business_days",
        startsFrom: "intimação da exigência",
        basis: "Decreto 70.235/1972, art. 15: 20 dias úteis.",
      },
    ],
  },
  {
    key: "rfb.recurso_voluntario",
    agencyCode: "RFB",
    name: "Recurso voluntário ao CARF",
    summary: "Recurso contra decisão de primeira instância (DRJ).",
    portalName: "e-CAC",
    portalUrl: "https://cav.receita.fazenda.gov.br",
    steps: [
      "Entrar no e-CAC e abrir o processo no e-Processo.",
      "Solicitar juntada do recurso voluntário ao mesmo processo.",
      SAVE_RECEIPT,
    ],
    documents: ["Recurso voluntário assinado", "Acórdão da DRJ", "Procuração"],
    deadlines: [
      {
        key: "recurso_voluntario",
        label: "Interpor recurso voluntário",
        actor: "party",
        days: 20,
        counting: "business_days",
        startsFrom: "ciência da decisão de primeira instância",
        basis: "Decreto 70.235/1972, art. 33: 20 dias úteis.",
      },
    ],
  },
  // ------------------------------------------------------------------ PGFN
  {
    key: "pgfn.regularize",
    agencyCode: "PGFN",
    name: "Pedido no Regularize (revisão, transação ou parcelamento)",
    summary: "Requerimentos sobre dívida ativa da União.",
    portalName: "Regularize",
    portalUrl: "https://www.regularize.pgfn.gov.br",
    steps: [
      "Entrar no Regularize com gov.br do devedor ou procurador habilitado.",
      "Escolher o serviço (revisão de dívida inscrita, transação, parcelamento ou negociação).",
      "Preencher e anexar os documentos pedidos pelo serviço.",
      SAVE_RECEIPT,
    ],
    documents: ["Inscrições em dívida ativa", "Documentos do serviço escolhido", "Procuração"],
    deadlines: [
      {
        key: "notificacao",
        label: "Prazo informado na notificação da PGFN",
        actor: "party",
        days: null,
        counting: "event",
        startsFrom: "notificação",
        basis: "Prazo varia conforme o serviço e o edital: conferir na notificação.",
      },
    ],
  },
  // ------------------------------------------------------------------ INPI
  {
    key: "inpi.oposicao",
    agencyCode: "INPI",
    name: "Oposição a pedido de marca",
    summary: "Oposição de terceiro contra pedido publicado na RPI.",
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
    steps: [
      "Entrar no sistema de peticionamento do INPI com o login do e-INPI.",
      "Emitir e pagar a GRU do serviço de oposição.",
      "Peticionar a oposição informando o número do processo e anexando as razões.",
      SAVE_RECEIPT,
    ],
    documents: ["Razões da oposição", "GRU paga", "Procuração"],
    deadlines: [
      {
        key: "oposicao",
        label: "Apresentar oposição",
        actor: "party",
        days: 60,
        counting: "calendar_days",
        startsFrom: "publicação do pedido na RPI",
        basis: "Lei 9.279/1996, art. 158; prazos contínuos (art. 221).",
      },
    ],
  },
  {
    key: "inpi.manifestacao_oposicao",
    agencyCode: "INPI",
    name: "Manifestação sobre oposição",
    summary: "Resposta do depositante à oposição recebida.",
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
    steps: [
      "Emitir e pagar a GRU de manifestação.",
      "Peticionar a manifestação no processo da marca.",
      SAVE_RECEIPT,
    ],
    documents: ["Manifestação", "GRU paga", "Procuração"],
    deadlines: [
      {
        key: "manifestacao",
        label: "Manifestar-se sobre a oposição",
        actor: "party",
        days: 60,
        counting: "calendar_days",
        startsFrom: "publicação da notificação de oposição na RPI",
        basis: "Lei 9.279/1996, art. 158, §1º; prazos contínuos (art. 221).",
      },
    ],
  },
  {
    key: "inpi.cumprimento_exigencia",
    agencyCode: "INPI",
    name: "Cumprimento de exigência de mérito",
    summary: "Resposta a exigência formulada no exame do pedido.",
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
    steps: ["Peticionar o cumprimento da exigência no processo.", SAVE_RECEIPT],
    documents: ["Resposta à exigência", "Documentos pedidos"],
    deadlines: [
      {
        key: "exigencia",
        label: "Cumprir a exigência",
        actor: "party",
        days: 60,
        counting: "calendar_days",
        startsFrom: "publicação da exigência na RPI",
        basis:
          "Lei 9.279/1996, art. 159; sem resposta, o pedido é arquivado definitivamente (art. 159, §1º).",
      },
    ],
  },
  {
    key: "inpi.pagamento_concessao",
    agencyCode: "INPI",
    name: "Pagamento da concessão e do primeiro decênio",
    summary: "Retribuição devida após o deferimento do pedido.",
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
    steps: [
      "Emitir a GRU de concessão e pagar.",
      "Guardar o comprovante de pagamento.",
      SAVE_RECEIPT,
    ],
    documents: ["GRU paga"],
    deadlines: [
      {
        key: "ordinario",
        label: "Pagar no prazo ordinário",
        actor: "party",
        days: 60,
        counting: "calendar_days",
        startsFrom: "publicação do deferimento na RPI",
        basis:
          "Lei 9.279/1996, art. 162; depois disso, mais 30 dias com retribuição específica (art. 162, parágrafo único).",
      },
    ],
  },
  {
    key: "inpi.recurso",
    agencyCode: "INPI",
    name: "Recurso administrativo",
    summary: "Recurso contra indeferimento e demais decisões recorríveis.",
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
    steps: ["Emitir e pagar a GRU de recurso.", "Peticionar o recurso no processo.", SAVE_RECEIPT],
    documents: ["Razões do recurso", "GRU paga", "Procuração"],
    deadlines: [
      {
        key: "recurso",
        label: "Interpor recurso",
        actor: "party",
        days: 60,
        counting: "calendar_days",
        startsFrom: "publicação da decisão na RPI",
        basis:
          "Lei 9.279/1996, art. 212. Não cabe recurso contra arquivamento definitivo nem contra deferimento (art. 212, §2º).",
      },
    ],
  },
  {
    key: "inpi.prorrogacao",
    agencyCode: "INPI",
    name: "Prorrogação do registro de marca",
    summary: "Renovação do registro por mais 10 anos.",
    portalName: "Peticionamento eletrônico do INPI",
    portalUrl: "https://www.gov.br/inpi/pt-br/servicos/marcas",
    steps: ["Emitir e pagar a GRU de prorrogação.", "Peticionar a prorrogação.", SAVE_RECEIPT],
    documents: ["GRU paga"],
    deadlines: [
      {
        key: "prorrogacao",
        label: "Pedir a prorrogação no último ano de vigência",
        actor: "party",
        days: null,
        counting: "event",
        startsFrom: "último ano de vigência do registro",
        basis:
          "Lei 9.279/1996, art. 133: no último ano de vigência ou nos 6 meses seguintes, com retribuição adicional.",
      },
    ],
  },
  // ------------------------------------------------------------------ LAI
  {
    key: "lai.pedido",
    agencyCode: "CGU-FALABR",
    name: "Pedido de acesso à informação",
    summary: "Pedido com base na Lei de Acesso à Informação a órgão federal.",
    portalName: "Fala.BR",
    portalUrl: "https://falabr.cgu.gov.br",
    steps: [
      "Entrar no Fala.BR com gov.br.",
      "Escolher “Acesso à informação”, o órgão e descrever o pedido.",
      SAVE_RECEIPT,
    ],
    documents: ["Texto do pedido"],
    deadlines: [
      {
        key: "resposta",
        label: "Resposta do órgão",
        actor: "agency",
        days: 20,
        counting: "calendar_days",
        startsFrom: "registro do pedido",
        basis:
          "Lei 12.527/2011, art. 11, §§1º e 2º: 20 dias, prorrogáveis por 10 com justificativa.",
      },
    ],
  },
  {
    key: "lai.recurso",
    agencyCode: "CGU-FALABR",
    name: "Recurso em pedido de acesso à informação",
    summary: "Recurso contra negativa total ou parcial de acesso.",
    portalName: "Fala.BR",
    portalUrl: "https://falabr.cgu.gov.br",
    steps: ["Abrir o pedido no Fala.BR e registrar o recurso.", SAVE_RECEIPT],
    documents: ["Razões do recurso"],
    deadlines: [
      {
        key: "recurso",
        label: "Recorrer",
        actor: "party",
        days: 10,
        counting: "calendar_days",
        startsFrom: "ciência da decisão",
        basis: "Lei 12.527/2011, art. 15.",
      },
    ],
  },
  // ------------------------------------------------------------ Consumidor
  {
    key: "consumidor_gov.reclamacao",
    agencyCode: "SENACON",
    name: "Reclamação no Consumidor.gov.br",
    summary: "Reclamação contra empresa participante da plataforma.",
    portalName: "Consumidor.gov.br",
    portalUrl: "https://www.consumidor.gov.br",
    steps: [
      "Entrar com gov.br do consumidor.",
      "Conferir se a empresa participa da plataforma e registrar a reclamação.",
      SAVE_RECEIPT,
    ],
    documents: [
      "Nota fiscal ou contrato",
      "Protocolos de atendimento anteriores",
      "Provas do problema",
    ],
    deadlines: [
      {
        key: "resposta_empresa",
        label: "Resposta da empresa",
        actor: "agency",
        days: 10,
        counting: "calendar_days",
        startsFrom: "registro da reclamação",
        basis:
          "Regra da plataforma: a empresa tem até 10 dias para responder; depois, o consumidor tem 20 dias para avaliar.",
      },
    ],
  },
  {
    key: "procon.reclamacao",
    agencyCode: "PROCON-PB",
    name: "Reclamação no Procon",
    summary: "Reclamação administrativa no Procon estadual ou municipal.",
    portalName: "Procon",
    portalUrl: "https://procon.pb.gov.br",
    steps: [
      "Verificar o canal de atendimento do Procon competente (estadual ou municipal).",
      "Registrar a reclamação com os documentos.",
      SAVE_RECEIPT,
    ],
    documents: ["Documento do consumidor", "Nota fiscal ou contrato", "Provas do problema"],
    deadlines: [
      {
        key: "notificacao",
        label: "Prazo informado pelo Procon",
        actor: "agency",
        days: null,
        counting: "event",
        startsFrom: "notificação do Procon",
        basis: "Prazos variam por Procon: conferir na notificação.",
      },
    ],
  },
  // ------------------------------------------------------------------ SEI
  {
    key: "sei.peticionamento",
    agencyCode: "SEI-FEDERAL",
    name: "Peticionamento eletrônico no SEI",
    summary: "Requerimento ou juntada em processo de órgão que usa o SEI.",
    portalName: "SEI do órgão",
    portalUrl: "https://www.gov.br/economia/pt-br/assuntos/processo-eletronico-nacional",
    steps: [
      "Cadastrar-se como usuário externo no SEI do órgão (exige liberação pelo órgão).",
      "Usar “Peticionamento” para processo novo ou intercorrente.",
      "Anexar os documentos e assinar eletronicamente.",
      SAVE_RECEIPT,
    ],
    documents: ["Requerimento", "Documentos do pedido", "Procuração"],
    deadlines: [
      {
        key: "notificacao",
        label: "Prazo informado no ofício",
        actor: "party",
        days: null,
        counting: "event",
        startsFrom: "intimação",
        basis: "Cada órgão fixa prazos próprios; na falta, conferir a Lei 9.784/1999.",
      },
    ],
  },
  // ------------------------------------------------------------------ Detran
  {
    key: "detran.recurso_infracao",
    agencyCode: "DETRAN-PB",
    name: "Defesa ou recurso de infração de trânsito",
    summary: "Defesa da autuação ou recurso à JARI.",
    portalName: "Detran-PB",
    portalUrl: "https://detran.pb.gov.br",
    steps: [
      "Conferir na notificação o órgão autuador (Detran, município ou PRF).",
      "Protocolar a defesa ou o recurso pelo canal indicado na notificação.",
      SAVE_RECEIPT,
    ],
    documents: ["Notificação", "CNH e CRLV", "Provas", "Procuração"],
    deadlines: [
      {
        key: "notificacao",
        label: "Prazo indicado na notificação",
        actor: "party",
        days: null,
        counting: "event",
        startsFrom: "recebimento da notificação",
        basis: "O prazo consta da notificação de autuação ou de penalidade.",
      },
    ],
  },
];

export function getProcedure(key: string): AdministrativeProcedure | undefined {
  return ADMINISTRATIVE_PROCEDURES.find((p) => p.key === key);
}

export function proceduresForAgency(agencyCode: string): AdministrativeProcedure[] {
  return ADMINISTRATIVE_PROCEDURES.filter((p) => p.agencyCode === agencyCode);
}
