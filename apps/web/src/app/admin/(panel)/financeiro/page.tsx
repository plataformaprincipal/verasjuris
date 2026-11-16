import { AdminUnavailable } from "../../../../components/admin-unavailable";

export default function AdminFinancePage() {
  return (
    <AdminUnavailable
      title="Financeiro e Asaas"
      description="Central financeira (cobranças, webhooks, estornos) depende de homologação do PSP e permissões específicas. Nenhuma cobrança real é disparada por esta tela."
    />
  );
}
