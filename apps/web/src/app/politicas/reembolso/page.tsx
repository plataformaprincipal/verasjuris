import type { Metadata } from "next";
import { PolicyPage } from "../../../components/legal/policy-page";
import { supportChannel } from "../../../lib/legal/company";

export const metadata: Metadata = {
  title: "Política de Cancelamento e Reembolso — VerasJuris",
  description: "Como cancelar planos, desistir da contratação e pedir reembolso no VerasJuris.",
};

export default function RefundPolicyPage() {
  return (
    <PolicyPage
      title="Política de Cancelamento e Reembolso"
      description="Regras para cancelar assinaturas, exercer o direito de arrependimento e solicitar reembolso."
    >
      <h2>1. Cancelamento de assinatura</h2>
      <p>
        Você pode cancelar seu plano a qualquer momento. O cancelamento vale ao fim do período já
        pago: o acesso aos recursos do plano continua até o encerramento do ciclo e não há nova
        cobrança. Cancelar não apaga seus dados; as regras de retenção e exportação estão na
        Política de Privacidade.
      </p>
      <h2>2. Direito de arrependimento (7 dias)</h2>
      <p>
        Nas contratações feitas pela internet por consumidores, você pode desistir em até 7 dias
        corridos contados da contratação ou da primeira cobrança, com devolução integral dos valores
        pagos, conforme o art. 49 do Código de Defesa do Consumidor. A devolução é feita pelo mesmo
        meio de pagamento, em prazo compatível com o do emissor ou do processador.
      </p>
      <h2>3. Pacotes de créditos de IA</h2>
      <p>
        Créditos consumidos não são reembolsáveis. O saldo não utilizado pode ser reembolsado em até
        12 meses da compra, proporcionalmente ao que não foi usado, mediante solicitação.
      </p>
      <h2>4. Serviços sob proposta</h2>
      <p>
        Serviços contratados por proposta seguem os marcos de pagamento descritos na própria
        proposta (sinal e entrega). Valores de marcos ainda não entregues podem ser reembolsados na
        forma prevista na proposta aceita; marcos já entregues não são reembolsáveis, salvo falha
        comprovada na prestação.
      </p>
      <h2>5. Cobrança indevida e contestação</h2>
      <p>
        Em caso de cobrança em duplicidade ou não reconhecida, o valor é estornado após a análise.
        Pedimos que nos procure antes de abrir contestação junto ao emissor do cartão, para
        resolvermos mais rápido.
      </p>
      <h2>6. Como solicitar</h2>
      <p>
        Peça o cancelamento ou o reembolso por {supportChannel()}, informando o e-mail da conta e a
        data da cobrança. Respondemos em até 5 dias úteis.
      </p>
      <h2>7. Notas fiscais</h2>
      <p>
        Em caso de reembolso, o documento fiscal correspondente, quando emitido, será cancelado ou
        ajustado conforme a legislação aplicável.
      </p>
    </PolicyPage>
  );
}
