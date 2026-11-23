import type { Metadata } from "next";
import { PolicyPage } from "../../../components/legal/policy-page";

export const metadata: Metadata = {
  title: "Política de Cookies — VerasJuris",
  description: "Quais cookies o VerasJuris usa e como controlá-los.",
};

export default function CookiesPolicyPage() {
  return (
    <PolicyPage
      title="Política de Cookies"
      description="Cookies estritamente necessários e como gerenciá-los."
    >
      <h2>1. O que usamos</h2>
      <p>
        Usamos cookies essenciais para manter sua sessão autenticada, proteger contra requisições
        forjadas (CSRF) e lembrar preferências como idioma e tema. Sem eles, o login e as áreas
        protegidas não funcionam.
      </p>
      <h2>2. O que não usamos</h2>
      <p>
        Não usamos cookies de publicidade comportamental nem vendemos dados de navegação. Se
        passarmos a usar cookies de medição ou marketing, pediremos seu consentimento antes.
      </p>
      <h2>3. Como controlar</h2>
      <p>
        Você pode apagar ou bloquear cookies nas configurações do navegador. Bloquear os essenciais
        impede o acesso à conta.
      </p>
      <h2>4. Mais informações</h2>
      <p>
        Veja a <a href="/politica-de-privacidade">Política de Privacidade</a>.
      </p>
    </PolicyPage>
  );
}
