/**
 * Dados institucionais usados nas páginas de políticas.
 * Preencher quando confirmados (razão social, CNPJ, canais). Campos vazios caem
 * no canal genérico "Central de Ajuda" — nada é inventado.
 */
export const COMPANY = {
  legalName: "" as string,
  cnpj: "" as string,
  supportEmail: "acesseverasjuris@gmail.com" as string,
  privacyEmail: "acesseverasjuris@gmail.com" as string,
  dpoName: "" as string,
  forum: "" as string,
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
