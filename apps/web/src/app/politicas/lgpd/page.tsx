import type { Metadata } from "next";
import { PolicyPage } from "../../../components/legal/policy-page";
import { COMPANY, privacyChannel } from "../../../lib/legal/company";

export const metadata: Metadata = {
  title: "LGPD e direitos do titular — VerasJuris",
  description: "Como exercer seus direitos previstos na Lei Geral de Proteção de Dados.",
};

export default function LgpdPage() {
  return (
    <PolicyPage
      title="LGPD e direitos do titular"
      description="Como pedir acesso, correção, exclusão e outros direitos sobre seus dados pessoais."
    >
      <h2>1. Seus direitos</h2>
      <p>
        Conforme o art. 18 da Lei 13.709/2018, você pode pedir confirmação do tratamento, acesso,
        correção, anonimização, portabilidade, eliminação de dados tratados com consentimento,
        informação sobre compartilhamento e revogação do consentimento.
      </p>
      <h2>2. Como exercer</h2>
      <p>
        Envie o pedido para {privacyChannel()}, a partir do e-mail cadastrado. Podemos pedir
        confirmação de identidade. Respondemos em até 15 dias.
      </p>
      {COMPANY.dpoName ? <p>Encarregado de dados: {COMPANY.dpoName}.</p> : null}
      <h2>3. Dados de clientes de advogados</h2>
      <p>
        Quando um escritório usa o VerasJuris para tratar dados de seus clientes, o escritório é o
        controlador desses dados e o VerasJuris atua como operador. Pedidos sobre esses dados devem
        ser feitos ao escritório responsável.
      </p>
      <h2>4. Detalhes completos</h2>
      <p>
        Finalidades, bases legais, retenção e provedores estão na{" "}
        <a href="/politica-de-privacidade">Política de Privacidade</a>. Você também pode contatar a
        ANPD.
      </p>
    </PolicyPage>
  );
}
