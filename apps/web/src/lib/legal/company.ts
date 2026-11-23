/**
 * Dados institucionais usados nas páginas de políticas.
 * Preencher quando confirmados (razão social, CNPJ, canais). Campos vazios caem
 * no canal genérico "Central de Ajuda" — nada é inventado.
 */
export const COMPANY = {
  legalName: "CAFÉ PLATINE SERVIÇOS E INTEGRAÇÕES LTDA" as string,
  cnpj: "62.898.191/0001-08" as string,
  supportEmail: "acesseverasjuris@gmail.com" as string,
  privacyEmail: "acesseverasjuris@gmail.com" as string,
  dpoName: "" as string,
  forum: "João Pessoa/PB" as string,
};

export const POLICIES_VERSION = "2026-11-23";

export function supportChannel(): string {
  return COMPANY.supportEmail
    ? COMPANY.supportEmail
    : "a Central de Ajuda em /institucional/ajuda ou /institucional/contato";
}

export function privacyChannel(): string {
  return COMPANY.privacyEmail || COMPANY.supportEmail || "/institucional/contato";
}
