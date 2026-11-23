import { nextBusinessDay, nonBusinessReason } from "@verasjuris/notifications";

/**
 * Classifica despachos da RPI de Marcas pelo nome do despacho.
 * Prazos da LPI são contínuos (art. 221) e contam da publicação (art. 226).
 * O vencimento que cai em dia sem expediente é levado ao próximo dia útil,
 * como referência a conferir.
 */

export type InpiSuggestion = {
  procedureKey: string | null;
  suggestedDays: number | null;
  basis: string;
  informative: boolean;
};

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function classifyInpiDispatch(name: string, complement?: string | null): InpiSuggestion {
  const t = fold(`${name} ${complement ?? ""}`);

  if (/notificacao de oposicao|oposicao.*notific/.test(t)) {
    return {
      procedureKey: "inpi.manifestacao_oposicao",
      suggestedDays: 60,
      basis: "Manifestação sobre oposição: 60 dias (LPI, art. 158, §1º).",
      informative: false,
    };
  }
  if (/exigencia/.test(t) && !/cumprimento de exigencia/.test(t)) {
    if (/formal/.test(t)) {
      return {
        procedureKey: "inpi.cumprimento_exigencia",
        suggestedDays: null,
        basis: "Exigência formal: confira o prazo informado no despacho.",
        informative: false,
      };
    }
    return {
      procedureKey: "inpi.cumprimento_exigencia",
      suggestedDays: 60,
      basis: "Exigência de mérito: 60 dias; sem resposta, arquivamento definitivo (LPI, art. 159).",
      informative: false,
    };
  }
  if (/indeferimento/.test(t)) {
    return {
      procedureKey: "inpi.recurso",
      suggestedDays: 60,
      basis: "Recurso contra indeferimento: 60 dias (LPI, art. 212).",
      informative: false,
    };
  }
  if (/deferimento/.test(t)) {
    return {
      procedureKey: "inpi.pagamento_concessao",
      suggestedDays: 60,
      basis: "Pagamento da concessão: 60 dias, mais 30 com retribuição específica (LPI, art. 162).",
      informative: false,
    };
  }
  if (/publicacao de pedido|para oposicao/.test(t)) {
    return {
      procedureKey: null,
      suggestedDays: null,
      basis: "Pedido publicado: terceiros têm 60 dias para oposição (LPI, art. 158). Acompanhar.",
      informative: true,
    };
  }
  if (/concessao de registro/.test(t)) {
    return {
      procedureKey: "inpi.prorrogacao",
      suggestedDays: null,
      basis:
        "Registro concedido por 10 anos; prorrogação no último ano de vigência (LPI, arts. 133).",
      informative: true,
    };
  }
  if (/arquivamento/.test(t)) {
    return {
      procedureKey: null,
      suggestedDays: null,
      basis: "Arquivamento: verificar se é definitivo (sem recurso, LPI, art. 212, §2º).",
      informative: false,
    };
  }
  return {
    procedureKey: null,
    suggestedDays: null,
    basis: "Despacho sem regra de prazo cadastrada: ler o texto e decidir.",
    informative: true,
  };
}

/** Vencimento em dias corridos após a publicação, ajustado para dia de expediente. */
export function inpiDueDate(publishedOn: string, days: number): string {
  const d = new Date(`${publishedOn}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  const raw = d.toISOString().slice(0, 10);
  return nonBusinessReason(raw, "expedient") ? nextBusinessDay(raw, "expedient").date : raw;
}
