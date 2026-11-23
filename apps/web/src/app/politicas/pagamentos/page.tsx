import type { Metadata } from "next";
import { PolicyPage } from "../../../components/legal/policy-page";

export const metadata: Metadata = {
  title: "Política de Pagamentos — VerasJuris",
  description: "Como funcionam cobranças, meios de pagamento e segurança no VerasJuris.",
};

export default function PaymentsPolicyPage() {
  return (
    <PolicyPage
      title="Política de Pagamentos"
      description="Meios de pagamento, cobrança recorrente, segurança e inadimplência."
    >
      <h2>1. Processador de pagamento</h2>
      <p>
        As cobranças são processadas pelo Asaas. O VerasJuris não armazena número completo de
        cartão: esses dados são tratados diretamente pelo processador.
      </p>
      <h2>2. Meios e valores</h2>
      <p>
        Os meios disponíveis (Pix, boleto e cartão) e os valores são exibidos na página de planos e
        no checkout, em reais, antes da confirmação. Planos anuais têm desconto informado no
        checkout.
      </p>
      <h2>3. Cobrança recorrente</h2>
      <p>
        Assinaturas são renovadas automaticamente ao fim de cada ciclo, até o cancelamento. A data
        de renovação aparece na sua conta.
      </p>
      <h2>4. Inadimplência</h2>
      <p>
        Se uma cobrança falhar, tentamos avisar por e-mail. Persistindo a falha, recursos pagos
        podem ser restringidos até a regularização. Seus dados continuam preservados.
      </p>
      <h2>5. Reembolsos e cancelamento</h2>
      <p>
        Veja a <a href="/politicas/reembolso">Política de Cancelamento e Reembolso</a>.
      </p>
    </PolicyPage>
  );
}
