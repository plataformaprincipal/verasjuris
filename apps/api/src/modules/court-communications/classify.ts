/**
 * Classificação determinística de comunicações do DJEN.
 *
 * Sugere a providência e um prazo de referência a partir de regras gerais do CPC e
 * da CLT. É sempre uma sugestão: a contagem definitiva depende do ato, do rito, de
 * prazos em dobro (Fazenda, Defensoria, litisconsortes com procuradores distintos
 * em autos físicos) e de feriados locais. O advogado confirma antes de valer.
 */

export type CommunicationCategory =
  | "citacao"
  | "sentenca"
  | "acordao"
  | "decisao_interlocutoria"
  | "embargos_declaracao"
  | "audiencia"
  | "cumprimento_sentenca"
  | "replica"
  | "pauta_julgamento"
  | "despacho"
  | "intimacao";

export type Classification = {
  category: CommunicationCategory;
  label: string;
  suggestedAction: string;
  /** Dias úteis; null quando não há prazo a contar (ex.: audiência). */
  suggestedDays: number | null;
  basis: string;
  /** Prazo citado no próprio texto (prevalece sobre a regra geral). */
  explicitDays: number | null;
};

const NUMBER_WORDS: Record<string, number> = {
  um: 1,
  dois: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
};

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "prazo de 15 (quinze) dias", "no prazo de cinco dias úteis", "em 10 dias". */
export function extractExplicitDays(text: string): number | null {
  const t = fold(text);
  const numeric = /prazo\s+(?:legal\s+)?de\s+(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?dias/.exec(t);
  if (numeric) return Number(numeric[1]);
  const worded = /prazo\s+(?:legal\s+)?de\s+([a-z]+)\s+dias/.exec(t);
  if (worded && NUMBER_WORDS[worded[1]!]) return NUMBER_WORDS[worded[1]!]!;
  const inDays = /\bem\s+(\d{1,3})\s*(?:\([a-z\s]+\)\s*)?dias(?:\s+uteis)?/.exec(t);
  if (inDays) return Number(inDays[1]);
  return null;
}

function isLabor(tribunal: string | null): boolean {
  return Boolean(tribunal && /^TRT\d+$|^TST$/.test(tribunal.toUpperCase()));
}

export function classifyCommunication(input: {
  text: string;
  communicationType?: string | null;
  documentType?: string | null;
  tribunal?: string | null;
}): Classification {
  const t = fold(`${input.documentType ?? ""} ${input.communicationType ?? ""} ${input.text}`);
  const labor = isLabor(input.tribunal ?? null);
  const explicitDays = extractExplicitDays(input.text);

  const make = (
    category: CommunicationCategory,
    label: string,
    suggestedAction: string,
    days: number | null,
    basis: string,
  ): Classification => ({
    category,
    label,
    suggestedAction,
    suggestedDays: explicitDays ?? days,
    basis: explicitDays
      ? `Prazo de ${explicitDays} dias citado no texto da comunicação. Regra geral: ${basis}`
      : basis,
    explicitDays,
  });

  if (/embargos de declaracao/.test(t) && /(opor|interpor|prazo|intime)/.test(t)) {
    return make(
      "embargos_declaracao",
      "Embargos de declaração",
      "Avaliar contrarrazões ou oposição de embargos de declaração.",
      5,
      labor ? "CLT, art. 897-A: 5 dias." : "CPC, art. 1.023: 5 dias úteis.",
    );
  }
  if (/\bcite-se\b|\bcitacao\b|\bcitado\b|\bcitada\b/.test(t)) {
    return make(
      "citacao",
      "Citação",
      labor
        ? "Conferir data da audiência e preparar defesa."
        : "Preparar contestação e conferir a data de audiência de conciliação, se designada.",
      labor ? null : 15,
      labor
        ? "Na Justiça do Trabalho a defesa é apresentada em audiência (CLT, art. 847)."
        : "CPC, art. 335: 15 dias úteis para contestar.",
    );
  }
  if (
    /\baudiencia\b/.test(t) &&
    /(designad|redesignad|pauta|fica marcada|realizar-se-a|dia \d)/.test(t)
  ) {
    return make(
      "audiencia",
      "Audiência",
      "Confirmar data, horário e formato da audiência e lançar na agenda.",
      null,
      "Audiência designada: não há prazo a contar, apenas a data do ato.",
    );
  }
  if (/pauta de julgamento|incluido em pauta|sessao de julgamento/.test(t)) {
    return make(
      "pauta_julgamento",
      "Inclusão em pauta",
      "Avaliar sustentação oral e memoriais antes da sessão.",
      null,
      "Inclusão em pauta: confirmar a data da sessão e o prazo para pedir sustentação oral no regimento do tribunal.",
    );
  }
  if (/\bacordao\b|\bacordam\b/.test(t)) {
    return make(
      "acordao",
      "Acórdão",
      labor
        ? "Avaliar recurso de revista ou embargos de declaração."
        : "Avaliar recurso especial/extraordinário ou embargos de declaração.",
      labor ? 8 : 15,
      labor
        ? "CLT, art. 896 e Lei 5.584/1970, art. 6º: 8 dias."
        : "CPC, art. 1.003, §5º: 15 dias úteis para recursos especial e extraordinário.",
    );
  }
  if (/\bsentenca\b|julgo (im)?procedente|julgo parcialmente|extingo o processo|homologo/.test(t)) {
    return make(
      "sentenca",
      "Sentença",
      labor
        ? "Avaliar recurso ordinário ou embargos de declaração."
        : "Avaliar apelação ou embargos de declaração.",
      labor ? 8 : 15,
      labor
        ? "CLT, art. 895: 8 dias para recurso ordinário."
        : "CPC, art. 1.003, §5º: 15 dias úteis para apelação.",
    );
  }
  if (/cumprimento de sentenca|pagar o debito|art\.? 523|pagamento voluntario/.test(t)) {
    return make(
      "cumprimento_sentenca",
      "Cumprimento de sentença",
      "Orientar pagamento voluntário ou preparar impugnação.",
      15,
      "CPC, arts. 523 e 525: 15 dias úteis para pagar; a impugnação corre em seguida.",
    );
  }
  if (/replica|impugnacao a contestacao|manifestar(-se)? sobre a contestacao/.test(t)) {
    return make(
      "replica",
      "Réplica",
      "Preparar réplica à contestação.",
      15,
      "CPC, arts. 350 e 351: 15 dias úteis.",
    );
  }
  if (/tutela|liminar|decisao interlocutoria|defiro|indefiro/.test(t)) {
    return make(
      "decisao_interlocutoria",
      "Decisão interlocutória",
      labor
        ? "Avaliar cumprimento da decisão; na Justiça do Trabalho a interlocutória em regra não é recorrível de imediato."
        : "Avaliar agravo de instrumento (se a hipótese do art. 1.015 se aplicar) e cumprimento da decisão.",
      labor ? null : 15,
      labor
        ? "CLT, art. 893, §1º: irrecorribilidade imediata das interlocutórias, com exceções."
        : "CPC, arts. 1.015 e 1.003, §5º: 15 dias úteis para agravo de instrumento.",
    );
  }
  if (/\bdespacho\b|cumpra-se|ciencia as partes|vista as partes/.test(t)) {
    return make(
      "despacho",
      "Despacho",
      "Ler o despacho e verificar se há providência a cumprir.",
      5,
      "CPC, art. 218, §3º: 5 dias quando não houver prazo fixado.",
    );
  }
  return make(
    "intimacao",
    "Intimação",
    "Ler a íntegra e definir a providência.",
    5,
    labor
      ? "Na falta de prazo fixado, conferir a regra aplicável (CLT, art. 775)."
      : "CPC, art. 218, §3º: 5 dias quando não houver prazo fixado.",
  );
}
