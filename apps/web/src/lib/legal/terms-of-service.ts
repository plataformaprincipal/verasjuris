import type { LegalDocument } from "./types";

const ENTIDADE =
  "CAFÉ PLATINE SERVIÇOS E INTEGRAÇÕES LTDA, CNPJ 62.898.191/0001-08, com sede na Avenida Dom Pedro II, 1138, Centro, João Pessoa/PB, CEP 58.013-420";

export const termsOfService: LegalDocument = {
  id: "terms-of-service",
  slug: "termos-de-servico",
  href: "/termos-de-servico",
  title: "Termos de Serviço do VerasJuris",
  shortTitle: "Termos de Serviço",
  summary:
    "Condições contratuais de prestação dos serviços digitais, planos, cobranças e regras comerciais do VerasJuris.",
  category: "Condições de serviço",
  version: "2026-11-16",
  publishedAt: "2026-11-16",
  effectiveAt: "2026-11-16",
  status: "published",
  readingMinutes: 22,
  related: ["terms-of-use", "privacy-policy"],
  pendingItems: [],
  sections: [
    {
      id: "s1",
      number: "1",
      title: "Identificação, aceitação e instrumentos",
      clauses: [
        {
          id: "s1-c1-1",
          number: "1.1",
          title: "Prestador dos serviços",
          paragraphs: [
            `Estes Termos de Serviço regulam a prestação dos serviços digitais do ecossistema VerasJuris pela entidade responsável (${ENTIDADE}), doravante “VerasJuris”.`,
            "A identificação societária completa será consolidada na versão publicada destes Termos, após validação institucional.",
          ],
        },
        {
          id: "s1-c1-2",
          number: "1.2",
          title: "Aceitação",
          paragraphs: [
            "A utilização de funcionalidades, a adesão a planos e a conclusão do cadastro com aceite afirmativo implicam concordância com estes Termos de Serviço, em conjunto com os Termos de Uso e a ciência da Política de Privacidade.",
          ],
        },
        {
          id: "s1-c1-3",
          number: "1.3",
          title: "Hierarquia documental",
          paragraphs: [
            "Estes Termos complementam os Termos de Uso e a Política de Privacidade. Em matéria de preço, cobrança, ciclo de faturamento ou escopo de plano, prevalecem as condições comerciais expressamente apresentadas no momento da contratação eletrônica, quando existentes e formalmente publicadas.",
            "Propostas, ordens de serviço ou contratos específicos firmados por escrito ou por meio eletrônico válido podem prevalecer sobre estas condições gerais naquilo em que forem incompatíveis, sem prejuízo das regras legais imperativas.",
          ],
        },
      ],
    },
    {
      id: "s2",
      number: "2",
      title: "Serviços oferecidos",
      clauses: [
        {
          id: "s2-c2-1",
          number: "2.1",
          title: "Escopo tecnológico",
          paragraphs: [
            "O VerasJuris presta serviços de tecnologia da informação aplicados ao domínio jurídico, podendo incluir, conforme disponibilidade e permissões: gestão operacional, documentos, comunicações, automações, pesquisa assistida, ferramentas de inteligência artificial, marketplace e demais módulos descritos na interface.",
          ],
        },
        {
          id: "s2-c2-2",
          number: "2.2",
          title: "Funcionalidades gratuitas e pagas",
          paragraphs: [
            "Determinados recursos podem ser oferecidos sem contraprestação, em modo de avaliação ou mediante plano pago. O catálogo efetivamente disponível pode variar por ambiente, organização, persona e estágio de implantação.",
          ],
          callout:
            "Valores, descontos, comissões e prazos comerciais específicos não são definidos neste documento e constarão apenas quando formalmente publicados.",
        },
        {
          id: "s2-c2-3",
          number: "2.3",
          title: "Disponibilidade operacional",
          paragraphs: [
            "A existência de rota, botão ou menção a um módulo não garante que o serviço esteja integralmente operacional. Integrações e provedores externos podem permanecer não configurados, em teste ou indisponíveis.",
          ],
        },
      ],
    },
    {
      id: "s3",
      number: "3",
      title: "Planos, assinaturas e condições comerciais",
      clauses: [
        {
          id: "s3-c3-1",
          number: "3.1",
          title: "Planos e assinaturas",
          paragraphs: [
            "Planos e assinaturas, quando oferecidos, descrevem o conjunto de funcionalidades, limites técnicos e condições de renovação aplicáveis. A descrição vigente no fluxo de contratação ou em página comercial oficial prevalece sobre materiais promocionais genéricos.",
          ],
        },
        {
          id: "s3-c3-2",
          number: "3.2",
          title: "Condições comerciais",
          paragraphs: [
            "Preços, moeda, impostos destacados, vigência promocional e demais condições comerciais serão informados de forma clara no momento da contratação. Este instrumento não cria tabela de preços nem obriga a oferta permanente de determinado plano.",
          ],
        },
        {
          id: "s3-c3-3",
          number: "3.3",
          title: "Alteração de planos",
          paragraphs: [
            "O contratante poderá solicitar upgrade, downgrade ou migração de plano pelos canais disponíveis, observados eventuais ciclos de cobrança já iniciados e as regras apresentadas na interface ou no suporte.",
          ],
        },
      ],
    },
    {
      id: "s4",
      number: "4",
      title: "Contratação eletrônica, cobranças e pagamentos",
      clauses: [
        {
          id: "s4-c4-1",
          number: "4.1",
          title: "Contratação eletrônica",
          paragraphs: [
            "A adesão a serviços pagos, quando habilitada, ocorre por meios eletrônicos, mediante autenticação e manifestação afirmativa do contratante ou de representante com poderes.",
          ],
        },
        {
          id: "s4-c4-2",
          number: "4.2",
          title: "Cobranças recorrentes",
          paragraphs: [
            "Assinaturas podem prever cobrança recorrente (por exemplo, mensal ou anual) processada por prestador de serviços de pagamento (PSP). A periodicidade e a data de renovação constarão das condições do plano contratado.",
          ],
        },
        {
          id: "s4-c4-3",
          number: "4.3",
          title: "Processamento financeiro",
          paragraphs: [
            "O processamento de pagamentos depende de configuração operacional de PSP e meios habilitados. O VerasJuris não afirma, neste documento, a integração ativa com determinado provedor, bandeira ou instituição financeira.",
          ],
        },
        {
          id: "s4-c4-4",
          number: "4.4",
          title: "Documentos de cobrança",
          paragraphs: [
            "Quando aplicável, documentos de cobrança e/ou documentos fiscais serão emitidos com base nos dados cadastrais fornecidos pelo contratante, que se responsabiliza por mantê-los atualizados e corretos.",
          ],
        },
        {
          id: "s4-c4-5",
          number: "4.5",
          title: "Tributos",
          paragraphs: [
            "Cada parte é responsável por suas obrigações tributárias decorrentes da relação contratual, salvo disposição legal em contrário. Destaques de tributos na interface, quando houver, têm natureza informativa e não substituem assessoria fiscal.",
          ],
        },
      ],
    },
    {
      id: "s5",
      number: "5",
      title: "Renovação, cancelamento, arrependimento e reembolsos",
      clauses: [
        {
          id: "s5-c5-1",
          number: "5.1",
          title: "Renovação",
          paragraphs: [
            "Planos com renovação automática renovam-se ao fim do ciclo, salvo cancelamento tempestivo ou indisponibilidade do meio de pagamento, observadas as regras do plano e do PSP.",
          ],
        },
        {
          id: "s5-c5-2",
          number: "5.2",
          title: "Cancelamento",
          paragraphs: [
            "O contratante poderá solicitar cancelamento pelos canais oficiais de atendimento. Os efeitos sobre o ciclo de cobrança em curso e o acesso residual às funcionalidades pagas observarão as condições do plano e a legislação aplicável.",
          ],
        },
        {
          id: "s5-c5-3",
          number: "5.3",
          title: "Direito de arrependimento",
          paragraphs: [
            "Quando a relação for de consumo e a contratação ocorrer fora do estabelecimento comercial, poderá aplicar-se o direito de arrependimento previsto no Código de Defesa do Consumidor, nos prazos e condições legais, sem prejuízo de hipóteses de inviabilidade pelo consumo antecipado de bem digital, quando cabível.",
          ],
        },
        {
          id: "s5-c5-4",
          number: "5.4",
          title: "Reembolsos",
          paragraphs: [
            "Políticas de reembolso, quando existentes, serão descritas no fluxo comercial ou em instrumento específico. Este documento não estabelece percentuais, prazos fixos ou garantias de devolução automática.",
          ],
        },
      ],
    },
    {
      id: "s6",
      number: "6",
      title: "Inadimplência e suspensão contratual",
      clauses: [
        {
          id: "s6-c6-1",
          number: "6.1",
          title: "Inadimplência",
          paragraphs: [
            "O atraso ou a falha no pagamento de valores devidos poderá implicar notificação, restrição de funcionalidades pagas, suspensão contratual ou rescisão, após eventual período de regularização comunicado ao contratante.",
          ],
        },
        {
          id: "s6-c6-2",
          number: "6.2",
          title: "Suspensão",
          paragraphs: [
            "Além da inadimplência, a suspensão poderá ocorrer por risco à segurança, ordem legal, violação dos Termos de Uso ou destes Termos de Serviço, ou manutenção emergencial necessária à integridade da Plataforma.",
          ],
        },
      ],
    },
    {
      id: "s7",
      number: "7",
      title: "Parceiros, marketplace, comissões e contestações",
      clauses: [
        {
          id: "s7-c7-1",
          number: "7.1",
          title: "Serviços de parceiros",
          paragraphs: [
            "Serviços anunciados ou intermediados via marketplace ou parceiros são, em regra, prestados por terceiros sob suas próprias condições, salvo indicação expressa de prestação direta pelo VerasJuris.",
          ],
        },
        {
          id: "s7-c7-2",
          number: "7.2",
          title: "Marketplace jurídico",
          paragraphs: [
            "O marketplace constitui ambiente tecnológico de divulgação e contratação. O VerasJuris não se confunde automaticamente com o prestador final do serviço jurídico anunciado e não garante resultado profissional do terceiro.",
          ],
        },
        {
          id: "s7-c7-3",
          number: "7.3",
          title: "Comissões e repasses",
          paragraphs: [
            "Eventuais comissões, taxas de intermediação ou repasses somente serão devidos se e quando previstos em instrumento comercial específico ou tabela publicada. Nada neste documento cria obrigação de comissão.",
          ],
        },
        {
          id: "s7-c7-4",
          number: "7.4",
          title: "Contestação de cobranças",
          paragraphs: [
            "Contestação de cobranças deverá ser apresentada pelos canais de suporte, com identificação da transação, data aproximada e fundamento. Chargebacks junto ao emissor do meio de pagamento seguirão regras do PSP e da bandeira, quando aplicáveis.",
          ],
        },
      ],
    },
    {
      id: "s8",
      number: "8",
      title: "Suporte, manutenção, continuidade e limitações técnicas",
      clauses: [
        {
          id: "s8-c8-1",
          number: "8.1",
          title: "Suporte e atendimento",
          paragraphs: [
            "O atendimento ocorrerá pelos canais institucionais disponibilizados. Prazos de resposta podem variar conforme o plano, a criticidade e o volume de demandas, sem SLA numérico inventado neste instrumento.",
          ],
        },
        {
          id: "s8-c8-2",
          number: "8.2",
          title: "Manutenção e disponibilidade",
          paragraphs: [
            "O VerasJuris envidará esforços razoáveis para manter a continuidade dos serviços, podendo realizar manutenções programadas ou emergenciais. Indisponibilidades de infraestrutura, rede ou provedores de terceiros podem afetar a operação.",
          ],
        },
        {
          id: "s8-c8-3",
          number: "8.3",
          title: "Continuidade",
          paragraphs: [
            "Em hipóteses de descontinuação de módulo, o VerasJuris buscará comunicar previamente os contratantes afetados, quando razoável e compatível com a urgência técnica ou legal.",
          ],
        },
        {
          id: "s8-c8-4",
          number: "8.4",
          title: "Limitações técnicas",
          paragraphs: [
            "Há limites técnicos de armazenamento, taxa de requisições, uso de inteligência artificial, exportações e integrações. A superação de limites pode implicar throttling, filas, degradação temporária ou necessidade de plano superior, quando oferecido.",
          ],
        },
      ],
    },
    {
      id: "s9",
      number: "9",
      title: "Rescisão, dados após encerramento e conflitos",
      clauses: [
        {
          id: "s9-c9-1",
          number: "9.1",
          title: "Rescisão contratual",
          paragraphs: [
            "O contrato de serviços poderá ser rescindido por qualquer das partes nos casos previstos nestes Termos, no plano contratado ou na legislação, inclusive por violação grave, inadimplemento ou ordem de autoridade competente.",
          ],
        },
        {
          id: "s9-c9-2",
          number: "9.2",
          title: "Tratamento de dados após encerramento",
          paragraphs: [
            "Após o encerramento, o tratamento de dados pessoais e de conteúdos da conta observará a Política de Privacidade, incluindo retenção pelo tempo necessário ao cumprimento de obrigações legais e exclusão ou anonimização quando cabível.",
          ],
        },
        {
          id: "s9-c9-3",
          number: "9.3",
          title: "Solução de conflitos",
          paragraphs: [
            "Buscar-se-á solução amigável pelos canais de atendimento. Persistindo controvérsia, aplicam-se a legislação da República Federativa do Brasil e o foro competente, inclusive regras protetivas do consumidor quando cabíveis.",
          ],
        },
        {
          id: "s9-c9-4",
          number: "9.4",
          title: "Alterações destes Termos",
          paragraphs: [
            "Estes Termos poderão ser atualizados. Versões serão identificadas por número e data de vigência. Aceites anteriores não são substituídos silenciosamente; novo aceite poderá ser exigido quando necessário à continuidade de serviços pagos ou essenciais.",
          ],
        },
      ],
    },
  ],
};
