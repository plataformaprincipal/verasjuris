import { ButtonLink, PageHeader } from "@verasjuris/ui";

export default function AdminSecurityPage() {
  return (
    <div className="vj-stack">
      <PageHeader
        title="Segurança administrativa"
        description="MFA obrigatório para staff, rate limiting e auditoria. Use as ferramentas de conta para configurar TOTP."
      />
      <ButtonLink href="/app/configuracoes">Configurações da conta / MFA</ButtonLink>
      <ButtonLink href="/admin/integracoes">Saúde das integrações</ButtonLink>
      <p className="vj-hint">
        Códigos técnicos permanecem nos logs. A interface exibe mensagens compreensíveis.
      </p>
    </div>
  );
}
