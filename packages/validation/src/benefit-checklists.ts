import { z } from "zod";

/**
 * Checklists de benefícios (Documento Mestre, p. 16): triagem por requisito com
 * "pontuação responsável" — estados verificáveis, nunca "chance de ganhar".
 *
 * Os requisitos resumem a regra geral; regras de transição, direito adquirido e
 * situações especiais ficam como "sujeito a análise profissional".
 */

export const CHECKLIST_ITEM_STATUSES = [
  "comprovado",
  "parcialmente_comprovado",
  "pendente",
  "contraditorio",
  "nao_identificado",
  "sujeito_analise_profissional",
] as const;

export type ChecklistItemStatus = (typeof CHECKLIST_ITEM_STATUSES)[number];

export const CHECKLIST_STATUS_LABEL: Record<ChecklistItemStatus, string> = {
  comprovado: "Comprovado",
  parcialmente_comprovado: "Parcialmente comprovado",
  pendente: "Pendente",
  contraditorio: "Contraditório",
  nao_identificado: "Não identificado",
  sujeito_analise_profissional: "Sujeito a análise profissional",
};

export type BenefitRequirement = {
  key: string;
  label: string;
  basis: string;
  evidence: string[];
};

export type BenefitChecklistDefinition = {
  key: string;
  name: string;
  priority: 1 | 2 | 3;
  summary: string;
  requirements: BenefitRequirement[];
};

const QUALIDADE_SEGURADO: BenefitRequirement = {
  key: "qualidade_segurado",
  label: "Qualidade de segurado na data do fato gerador",
  basis: "Lei 8.213/1991, art. 15 (períodos de graça).",
  evidence: ["CNIS", "CTPS", "Guias de recolhimento"],
};

export const BENEFIT_CHECKLISTS: BenefitChecklistDefinition[] = [
  {
    key: "bpc_idoso",
    name: "BPC/LOAS — pessoa idosa",
    priority: 1,
    summary: "Benefício assistencial de um salário mínimo à pessoa idosa de baixa renda.",
    requirements: [
      {
        key: "idade",
        label: "65 anos ou mais",
        basis: "Lei 8.742/1993, art. 20, caput.",
        evidence: ["Documento de identidade"],
      },
      {
        key: "renda",
        label: "Renda familiar por pessoa de até 1/4 do salário mínimo",
        basis:
          "Lei 8.742/1993, art. 20, §3º; critérios complementares do art. 20-B podem admitir até 1/2 salário mínimo.",
        evidence: ["Composição do grupo familiar", "Comprovantes de renda de cada membro"],
      },
      {
        key: "cadunico",
        label: "Inscrição atualizada no CadÚnico",
        basis: "Lei 8.742/1993, art. 20, §12.",
        evidence: ["Folha resumo do CadÚnico"],
      },
      {
        key: "nao_acumulacao",
        label: "Não recebe outro benefício da seguridade (salvo exceções legais)",
        basis: "Lei 8.742/1993, art. 20, §4º.",
        evidence: ["Consulta ao CNIS/benefícios"],
      },
    ],
  },
  {
    key: "bpc_deficiencia",
    name: "BPC/LOAS — pessoa com deficiência",
    priority: 1,
    summary: "Benefício assistencial à pessoa com deficiência de baixa renda.",
    requirements: [
      {
        key: "impedimento",
        label: "Impedimento de longo prazo (2 anos ou mais)",
        basis: "Lei 8.742/1993, art. 20, §§2º e 10.",
        evidence: ["Laudos e relatórios médicos", "Exames"],
      },
      {
        key: "avaliacao",
        label: "Avaliação médica e social do INSS",
        basis: "Lei 8.742/1993, art. 20, §6º.",
        evidence: ["Agendamento e resultado das avaliações"],
      },
      {
        key: "renda",
        label: "Renda familiar por pessoa de até 1/4 do salário mínimo",
        basis: "Lei 8.742/1993, art. 20, §3º e art. 20-B.",
        evidence: ["Composição do grupo familiar", "Comprovantes de renda"],
      },
      {
        key: "cadunico",
        label: "Inscrição atualizada no CadÚnico",
        basis: "Lei 8.742/1993, art. 20, §12.",
        evidence: ["Folha resumo do CadÚnico"],
      },
    ],
  },
  {
    key: "auxilio_incapacidade_temporaria",
    name: "Auxílio por incapacidade temporária",
    priority: 1,
    summary: "Benefício por incapacidade para o trabalho por mais de 15 dias.",
    requirements: [
      QUALIDADE_SEGURADO,
      {
        key: "carencia",
        label: "Carência de 12 contribuições (dispensada em acidente e doenças da lista)",
        basis: "Lei 8.213/1991, arts. 25, I, e 26, II.",
        evidence: ["CNIS"],
      },
      {
        key: "incapacidade",
        label: "Incapacidade para o trabalho habitual por mais de 15 dias",
        basis: "Lei 8.213/1991, art. 59; confirmação em perícia.",
        evidence: ["Atestado com CID e prazo de afastamento", "Laudos e exames"],
      },
      {
        key: "data_inicio",
        label: "Data de início da incapacidade posterior à filiação",
        basis: "Lei 8.213/1991, art. 59, §1º.",
        evidence: ["Prontuários com datas"],
      },
    ],
  },
  {
    key: "auxilio_acidente",
    name: "Auxílio-acidente",
    priority: 2,
    summary: "Indenização por sequela que reduz a capacidade para o trabalho habitual.",
    requirements: [
      {
        key: "categoria",
        label: "Segurado empregado, doméstico, avulso ou especial",
        basis: "Lei 8.213/1991, art. 18, §1º.",
        evidence: ["CTPS", "CNIS"],
      },
      {
        key: "sequela",
        label: "Sequela consolidada que reduz a capacidade para o trabalho habitual",
        basis: "Lei 8.213/1991, art. 86.",
        evidence: ["Laudo médico da sequela", "CAT, se acidente do trabalho"],
      },
      QUALIDADE_SEGURADO,
    ],
  },
  {
    key: "salario_maternidade",
    name: "Salário-maternidade",
    priority: 2,
    summary: "Benefício por parto, adoção ou guarda judicial para adoção.",
    requirements: [
      QUALIDADE_SEGURADO,
      {
        key: "fato_gerador",
        label: "Parto, adoção ou guarda para fins de adoção",
        basis: "Lei 8.213/1991, arts. 71 e 71-A.",
        evidence: ["Certidão de nascimento ou termo de guarda/adoção"],
      },
      {
        key: "carencia",
        label: "Carência conforme a categoria da segurada",
        basis:
          "Lei 8.213/1991, arts. 25, III, e 26, VI; o STF afastou a exigência de carência no julgamento das ADIs 2110 e 2111 — confirmar o enquadramento.",
        evidence: ["CNIS"],
      },
    ],
  },
  {
    key: "pensao_morte",
    name: "Pensão por morte",
    priority: 2,
    summary: "Benefício aos dependentes do segurado falecido.",
    requirements: [
      {
        key: "qualidade_instituidor",
        label: "Qualidade de segurado do falecido (ou direito a aposentadoria) na data do óbito",
        basis: "Lei 8.213/1991, arts. 15 e 74.",
        evidence: ["Certidão de óbito", "CNIS do falecido"],
      },
      {
        key: "dependencia",
        label: "Condição de dependente",
        basis: "Lei 8.213/1991, art. 16 (dependência presumida na 1ª classe).",
        evidence: ["Certidão de casamento ou provas de união estável", "Certidões dos filhos"],
      },
      {
        key: "duracao",
        label: "Duração da cota (tempo de contribuição, de união e idade do dependente)",
        basis: "Lei 8.213/1991, art. 77, §2º, V.",
        evidence: ["CNIS", "Provas do início da união"],
      },
    ],
  },
  {
    key: "aposentadoria_idade_urbana",
    name: "Aposentadoria por idade (urbana)",
    priority: 3,
    summary: "Aposentadoria programada por idade e tempo de contribuição.",
    requirements: [
      {
        key: "idade",
        label: "Idade mínima (62 anos mulher, 65 anos homem)",
        basis: "Emenda Constitucional 103/2019, arts. 18 e 19 (verificar regra de transição).",
        evidence: ["Documento de identidade"],
      },
      {
        key: "tempo",
        label: "Tempo de contribuição mínimo (15 anos; 20 anos para homem filiado após a EC 103)",
        basis: "Emenda Constitucional 103/2019, arts. 18 e 19.",
        evidence: ["CNIS", "CTPS", "Carnês"],
      },
      {
        key: "transicao",
        label: "Enquadramento em regra de transição ou direito adquirido",
        basis: "Emenda Constitucional 103/2019, arts. 3º e 18.",
        evidence: ["Histórico contributivo antes de 13/11/2019"],
      },
    ],
  },
  {
    key: "aposentadoria_idade_rural",
    name: "Aposentadoria por idade (rural)",
    priority: 3,
    summary: "Aposentadoria do trabalhador rural e segurado especial.",
    requirements: [
      {
        key: "idade",
        label: "Idade mínima (55 anos mulher, 60 anos homem)",
        basis: "Lei 8.213/1991, art. 48, §1º.",
        evidence: ["Documento de identidade"],
      },
      {
        key: "atividade_rural",
        label: "15 anos de atividade rural, ainda que descontínua",
        basis: "Lei 8.213/1991, arts. 39, I, 48, §2º, e 143.",
        evidence: [
          "Autodeclaração do segurado especial",
          "Documentos contemporâneos da atividade rural",
        ],
      },
      {
        key: "periodo_imediato",
        label: "Atividade rural no período imediatamente anterior ao requerimento ou à idade",
        basis: "Lei 8.213/1991, art. 48, §2º.",
        evidence: ["Provas recentes da atividade rural"],
      },
    ],
  },
  {
    key: "aposentadoria_especial",
    name: "Aposentadoria especial",
    priority: 3,
    summary: "Aposentadoria por exposição a agentes nocivos.",
    requirements: [
      {
        key: "exposicao",
        label: "Exposição efetiva a agentes nocivos por 15, 20 ou 25 anos",
        basis: "Lei 8.213/1991, art. 57; EC 103/2019, art. 19, §1º, I, e art. 21 (transição).",
        evidence: ["PPP", "LTCAT"],
      },
      {
        key: "idade_pontos",
        label: "Idade mínima ou pontuação de transição",
        basis: "Emenda Constitucional 103/2019, arts. 19 e 21.",
        evidence: ["Documento de identidade", "CNIS"],
      },
      {
        key: "carencia",
        label: "Carência de 180 contribuições",
        basis: "Lei 8.213/1991, art. 25, II.",
        evidence: ["CNIS"],
      },
    ],
  },
];

export function getBenefitChecklist(key: string): BenefitChecklistDefinition | undefined {
  return BENEFIT_CHECKLISTS.find((b) => b.key === key);
}

/** Resumo sem "probabilidade": contagem por estado e pendências. */
export function summarizeChecklist(
  definition: BenefitChecklistDefinition,
  items: Record<string, { status: ChecklistItemStatus }>,
) {
  const counts = Object.fromEntries(CHECKLIST_ITEM_STATUSES.map((s) => [s, 0])) as Record<
    ChecklistItemStatus,
    number
  >;
  for (const req of definition.requirements) {
    counts[items[req.key]?.status ?? "nao_identificado"] += 1;
  }
  const blocking = definition.requirements
    .filter((req) => {
      const status = items[req.key]?.status ?? "nao_identificado";
      return status !== "comprovado";
    })
    .map((req) => req.key);
  return { total: definition.requirements.length, counts, open: blocking };
}

export const createBenefitChecklistSchema = z.object({
  benefitKey: z
    .string()
    .refine((v) => BENEFIT_CHECKLISTS.some((b) => b.key === v), "Benefício não suportado."),
  legalMatterId: z.string().uuid().optional(),
  administrativeProcessId: z.string().uuid().optional(),
  clientLabel: z.string().trim().max(200).optional(),
});

export const updateBenefitChecklistItemSchema = z.object({
  status: z.enum(CHECKLIST_ITEM_STATUSES),
  note: z.string().trim().max(2000).optional(),
  documentId: z.string().uuid().nullable().optional(),
});

export const registerGuidedProtocolSchema = z.object({
  procedureKey: z.string().min(3).max(100),
  protocolNumber: z.string().trim().min(3, "Informe o número do protocolo.").max(120),
  protocolDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD."),
  receiptDocumentId: z.string().uuid("Anexe o comprovante de protocolo."),
  notes: z.string().trim().max(2000).optional(),
});
