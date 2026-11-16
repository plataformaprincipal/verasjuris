import type { LegalDocument } from "./types";

const ENTIDADE = "[IDENTIFICAÇÃO SOCIETÁRIA PENDENTE]";
const CANAL_PRIVACIDADE = "[CANAL DE PRIVACIDADE/ENCARREGADO PENDENTE DE CONFIRMAÇÃO]";

export const privacyPolicy: LegalDocument = {
  id: "privacy-policy",
  slug: "politica-de-privacidade",
  href: "/politica-de-privacidade",
  title: "Política de Privacidade e Proteção de Dados Pessoais VerasJuris",
  shortTitle: "Política de Privacidade",
  summary:
    "Como a VerasJuris trata dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018): categorias de dados, finalidades, bases legais, papéis de controlador e operador, compartilhamento, provedores e integrações, inteligência artificial, pagamentos, cookies, transferências internacionais, segurança, retenção, direitos dos titulares e incidentes. Documento em minuta, pendente de revisão jurídica.",
  category: "Privacidade e proteção de dados",
  version: "2026-11-16",
  publishedAt: "2026-11-16",
  effectiveAt: "2026-11-16",
  status: "draft",
  readingMinutes: 16,
  related: ["terms-of-use", "terms-of-service"],
  pendingItems: [
    "Identificação societária do controlador (razão social, CNPJ, endereço e representante legal) — [IDENTIFICAÇÃO SOCIETÁRIA PENDENTE].",
    "Nome e canal oficial do Encarregado pelo Tratamento de Dados Pessoais (DPO) — [CANAL DE PRIVACIDADE/ENCARREGADO PENDENTE DE CONFIRMAÇÃO].",
    "Lista definitiva de provedores de infraestrutura, pagamento, comunicação, armazenamento e inteligência artificial efetivamente ativos, com localização do tratamento.",
    "Prazos de retenção por categoria de dados, a serem validados juridicamente.",
    "Mecanismos de transferência internacional aplicáveis aos provedores efetivamente contratados.",
    "Relatório de impacto, registro das operações de tratamento e demais artefatos de governança de dados.",
    "Validação final do texto por advogado(a) habilitado(a) antes da mudança de status para PUBLISHED.",
  ],
  sections: [
    {
      id: "introducao-e-controlador",
      number: "1",
      title: "Introdução e identificação do controlador",
      intro:
        "Este documento encontra-se em versão de minuta (DRAFT), pendente de revisão jurídica e de validação institucional. Informações sobre provedores e canais serão confirmadas antes da publicação definitiva.",
      clauses: [
        {
          id: "1-1-compromisso",
          number: "1.1",
          title: "Compromisso com a privacidade",
          paragraphs: [
            "Esta Política descreve como a VerasJuris coleta, utiliza, compartilha, armazena e protege dados pessoais de usuários, profissionais, visitantes e demais titulares, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD) e demais normas aplicáveis.",
          ],
        },
        {
          id: "1-2-controlador",
          number: "1.2",
          title: "Controlador",
          paragraphs: [
            `O controlador dos dados pessoais tratados para a operação da Plataforma é ${ENTIDADE}. Os dados de qualificação (razão social, CNPJ, endereço) serão inseridos após validação institucional.`,
          ],
          callout:
            "Pendência: identificação societária do controlador ainda não confirmada. Nenhum dado societário foi presumido.",
        },
        {
          id: "1-3-encarregado",
          number: "1.3",
          title: "Encarregado (DPO) e canal de privacidade",
          paragraphs: [
            `Solicitações, dúvidas e requerimentos relacionados a dados pessoais devem ser dirigidos ao canal ${CANAL_PRIVACIDADE}. O nome e os dados de contato do Encarregado serão divulgados nesta Política após sua designação e validação.`,
          ],
        },
        {
          id: "1-4-documentos-relacionados",
          number: "1.4",
          title: "Documentos relacionados",
          paragraphs: [
            "Esta Política deve ser lida em conjunto com os Termos de Uso, os Termos de Serviço, a Política de Cookies e demais políticas específicas publicadas na Plataforma.",
          ],
        },
      ],
    },
    {
      id: "definicoes",
      number: "2",
      title: "Definições",
      clauses: [
        {
          id: "2-1-termos-lgpd",
          number: "2.1",
          title: "Termos da LGPD",
          paragraphs: ["Para os fins desta Política, consideram-se:"],
          bullets: [
            "Dado pessoal: informação relacionada a pessoa natural identificada ou identificável;",
            "Dado pessoal sensível: dado sobre origem racial ou étnica, convicção religiosa, opinião política, filiação sindical, dado referente à saúde ou à vida sexual, dado genético ou biométrico, quando vinculado a uma pessoa natural;",
            "Titular: pessoa natural a quem se referem os dados pessoais;",
            "Controlador: pessoa a quem competem as decisões referentes ao tratamento de dados pessoais;",
            "Operador: pessoa que realiza o tratamento de dados pessoais em nome do controlador;",
            "Encarregado: pessoa indicada para atuar como canal de comunicação entre controlador, titulares e a Autoridade Nacional de Proteção de Dados (ANPD);",
            "Tratamento: toda operação realizada com dados pessoais, como coleta, uso, armazenamento, compartilhamento e eliminação;",
            "Anonimização: utilização de meios técnicos pelos quais um dado perde a possibilidade de associação a um indivíduo.",
          ],
        },
      ],
    },
    {
      id: "categorias-de-dados",
      number: "3",
      title: "Categorias de dados pessoais tratados",
      clauses: [
        {
          id: "3-1-dados-cadastrais",
          number: "3.1",
          title: "Dados cadastrais e de conta",
          paragraphs: [
            "Podem ser tratados dados de identificação e contato informados no cadastro, como nome, nome de exibição, e-mail, telefone, CPF ou CNPJ, endereço, data de nascimento (quando exigida), credenciais de acesso (armazenadas de forma protegida), preferências de idioma e acessibilidade, e registros de aceite dos documentos legais, com a versão aceita.",
          ],
        },
        {
          id: "3-2-dados-profissionais",
          number: "3.2",
          title: "Dados profissionais",
          paragraphs: [
            "Para perfis profissionais, podem ser tratados dados como número de inscrição em órgão de classe (por exemplo, OAB), seccional, áreas de atuação, descrição profissional, localização, escritório vinculado, informações de verificação e histórico de avaliações e propostas no marketplace.",
          ],
        },
        {
          id: "3-3-documentos-juridicos",
          number: "3.3",
          title: "Documentos e informações jurídicas",
          paragraphs: [
            "O Usuário pode inserir na Plataforma documentos, peças, contratos, dados de processos, prazos, andamentos, anotações e comunicações, que podem conter dados pessoais de partes, clientes, testemunhas e terceiros. Esse conteúdo é inserido sob responsabilidade do Usuário.",
          ],
        },
        {
          id: "3-4-clientes-do-escritorio",
          number: "3.4",
          title: "Dados de clientes do escritório",
          paragraphs: [
            "No uso de módulos de relacionamento (CRM), atendimento, financeiro e gestão de casos, o Usuário pode inserir dados de seus próprios clientes, como identificação, contato, informações financeiras e informações do caso. Nesses casos, a VerasJuris atua, em regra, como operadora, conforme a seção de papéis.",
          ],
        },
        {
          id: "3-5-dados-sensiveis",
          number: "3.5",
          title: "Dados sensíveis, quando aplicável",
          paragraphs: [
            "Documentos e processos podem conter, eventualmente, dados pessoais sensíveis (como saúde, em demandas previdenciárias, trabalhistas ou de outras áreas). A VerasJuris não solicita dados sensíveis para o cadastro geral. Quando o Usuário os inserir, é responsável por possuir base legal adequada para o tratamento e por adotar minimização sempre que possível.",
          ],
        },
        {
          id: "3-6-dados-de-pagamento",
          number: "3.6",
          title: "Dados financeiros e de pagamento",
          paragraphs: [
            "Podem ser tratados dados de cobrança, histórico de transações e identificadores de pagamento. Dados completos de cartão, quando houver cobrança, são tratados pelo processador de pagamento, e a VerasJuris não armazena dados completos de cartão, salvo se expressamente informado.",
          ],
        },
        {
          id: "3-7-dados-tecnicos",
          number: "3.7",
          title: "Dados técnicos e de uso",
          paragraphs: [
            "São coletados automaticamente dados como endereço IP, identificadores de dispositivo, tipo de navegador, data e hora de acesso, páginas visitadas, eventos de uso, logs de segurança e informações de erros, conforme a Política de Cookies.",
          ],
        },
        {
          id: "3-8-comunicacoes",
          number: "3.8",
          title: "Comunicações e atendimento",
          paragraphs: [
            "Mensagens enviadas ao suporte, formulários, interações no marketplace e registros de atendimento podem ser armazenados para prestação do serviço, segurança e comprovação.",
          ],
        },
      ],
    },
    {
      id: "finalidades-e-bases-legais",
      number: "4",
      title: "Finalidades e bases legais",
      clauses: [
        {
          id: "4-1-finalidades",
          number: "4.1",
          title: "Finalidades do tratamento",
          paragraphs: ["Os dados pessoais são tratados para as seguintes finalidades:"],
          bullets: [
            "Criar e administrar contas, autenticar usuários e prestar os serviços contratados;",
            "Verificar a identidade e a inscrição profissional, quando aplicável;",
            "Viabilizar as ferramentas de gestão jurídica, documentos, CRM, financeiro e demais módulos;",
            "Operar o marketplace e a conexão entre usuários e profissionais;",
            "Processar cobranças e emitir comprovantes, quando houver cobrança ativa;",
            "Prestar suporte, comunicar atualizações e avisos operacionais;",
            "Garantir a segurança, prevenir fraudes e registrar incidentes;",
            "Cumprir obrigações legais e regulatórias e exercer direitos em processos;",
            "Aprimorar a Plataforma, mediante análise de uso, preferencialmente com dados agregados ou anonimizados;",
            "Prestar funcionalidades de inteligência artificial solicitadas pelo Usuário.",
          ],
        },
        {
          id: "4-2-bases-legais",
          number: "4.2",
          title: "Bases legais",
          paragraphs: [
            "O tratamento fundamenta-se, conforme a finalidade, nas hipóteses do art. 7º da LGPD e, para dados sensíveis, no art. 11, entre as quais:",
          ],
          bullets: [
            "Execução de contrato ou de procedimentos preliminares a pedido do titular (prestação dos serviços);",
            "Cumprimento de obrigação legal ou regulatória;",
            "Exercício regular de direitos em processo judicial, administrativo ou arbitral;",
            "Legítimo interesse, observados a finalidade legítima, a necessidade e as expectativas do titular (segurança, prevenção a fraudes, melhoria do serviço);",
            "Consentimento, nos casos em que for exigido (por exemplo, certos cookies não essenciais e comunicações opcionais), revogável a qualquer tempo;",
            "Proteção do crédito e prevenção à fraude, quando aplicável.",
          ],
          callout:
            "O mapeamento definitivo de bases legais por operação de tratamento será validado pela revisão jurídica e pelo Encarregado antes da publicação.",
        },
      ],
    },
    {
      id: "papeis-controlador-operador",
      number: "5",
      title: "Papéis: controlador e operador",
      clauses: [
        {
          id: "5-1-verasjuris-controladora",
          number: "5.1",
          title: "VerasJuris como controladora",
          paragraphs: [
            "A VerasJuris atua como controladora dos dados necessários à gestão de contas, autenticação, verificação de perfis, cobrança, segurança, suporte, comunicação institucional e melhoria da Plataforma.",
          ],
        },
        {
          id: "5-2-verasjuris-operadora",
          number: "5.2",
          title: "VerasJuris como operadora",
          paragraphs: [
            "Em relação aos dados de clientes do escritório, partes e terceiros inseridos pelo Usuário em módulos de gestão, a VerasJuris atua, em regra, como operadora, tratando os dados conforme as instruções lícitas do Usuário, que atua como controlador (ou operador, conforme o caso) e é responsável pela base legal, pela transparência perante seus clientes e pelo atendimento a seus titulares.",
          ],
        },
        {
          id: "5-3-usuario-controlador",
          number: "5.3",
          title: "Responsabilidades do Usuário",
          paragraphs: [
            "O Usuário que insere dados de terceiros declara possuir base legal e autorização adequada, deve informar seus clientes sobre o uso de ferramentas tecnológicas quando exigido, e deve observar os deveres de sigilo profissional aplicáveis à sua atividade.",
          ],
        },
        {
          id: "5-4-contrato-de-operacao",
          number: "5.4",
          title: "Instrumentos complementares",
          paragraphs: [
            "Quando necessário, poderão ser formalizados instrumentos específicos (como acordo de tratamento de dados) para detalhar as responsabilidades de controlador e operador. Tais instrumentos, se existirem, serão disponibilizados mediante solicitação.",
          ],
        },
      ],
    },
    {
      id: "compartilhamento",
      number: "6",
      title: "Compartilhamento de dados",
      clauses: [
        {
          id: "6-1-hipoteses",
          number: "6.1",
          title: "Hipóteses de compartilhamento",
          paragraphs: ["Os dados poderão ser compartilhados, na medida necessária, com:"],
          bullets: [
            "Provedores de infraestrutura, hospedagem, banco de dados e armazenamento;",
            "Provedores de e-mail, comunicação e notificações;",
            "Processadores de pagamento e instituições financeiras, quando houver cobrança;",
            "Provedores de inteligência artificial, quando o Usuário utilizar tais recursos;",
            "Profissionais ou usuários do marketplace, quando o titular optar por divulgar dados ou enviar solicitações e propostas;",
            "Autoridades públicas, mediante obrigação legal, ordem judicial ou requisição regular;",
            "Assessores jurídicos, auditores e consultores, sob dever de confidencialidade;",
            "Terceiros envolvidos em reorganização societária, mediante salvaguardas adequadas.",
          ],
        },
        {
          id: "6-2-sem-venda-de-dados",
          number: "6.2",
          title: "Não comercialização de dados",
          paragraphs: [
            "A VerasJuris não vende dados pessoais de seus usuários. Qualquer mudança nessa diretriz dependerá de base legal adequada, de comunicação prévia e, quando exigido, de consentimento.",
          ],
        },
        {
          id: "6-3-exigencias-contratuais",
          number: "6.3",
          title: "Exigências para terceiros",
          paragraphs: [
            "Sempre que possível, os terceiros que tratem dados em nome da VerasJuris são submetidos a obrigações contratuais de confidencialidade, segurança e uso restrito às finalidades definidas.",
          ],
        },
      ],
    },
    {
      id: "provedores-e-integracoes",
      number: "7",
      title: "Provedores de infraestrutura e integrações",
      clauses: [
        {
          id: "7-1-provedores",
          number: "7.1",
          title: "Provedores e integrações",
          paragraphs: [
            "A Plataforma pode utilizar provedores de nuvem, banco de dados, armazenamento de arquivos, envio de e-mails, mensageria, pagamentos, verificação de profissionais, consulta a fontes públicas e inteligência artificial. A relação de provedores e a localização do tratamento serão detalhadas após confirmação institucional.",
          ],
        },
        {
          id: "7-2-integracoes-nao-configuradas",
          number: "7.2",
          title: "Integrações não configuradas",
          paragraphs: [
            "Diversas integrações podem estar não configuradas, em demonstração ou inativas. Enquanto uma integração não estiver ativa, os dados correspondentes não são enviados ao respectivo provedor. A menção a determinada categoria de provedor nesta Política não significa que ele esteja ativo.",
          ],
          callout:
            "Antes da publicação, a lista de provedores ativos deve ser conferida e esta seção atualizada com a relação definitiva.",
        },
        {
          id: "7-3-fontes-oficiais",
          number: "7.3",
          title: "Fontes públicas e sistemas oficiais",
          paragraphs: [
            "Consultas a sistemas oficiais ou fontes públicas, quando disponíveis e autorizadas pelo Usuário, podem envolver o envio de identificadores (como número de processo ou de inscrição profissional) e o recebimento de informações públicas, sujeitos aos termos de cada fonte.",
          ],
        },
      ],
    },
    {
      id: "inteligencia-artificial",
      number: "8",
      title: "Tratamento de dados em recursos de inteligência artificial",
      clauses: [
        {
          id: "8-1-funcionamento",
          number: "8.1",
          title: "Funcionamento e dados enviados",
          paragraphs: [
            "Ao utilizar recursos de inteligência artificial, textos, documentos e informações fornecidos pelo Usuário podem ser processados por modelos operados por provedores terceiros, quando configurados, para gerar respostas, resumos ou minutas. O Usuário deve avaliar a necessidade de inserir dados pessoais ou sigilosos.",
          ],
        },
        {
          id: "8-2-cautelas",
          number: "8.2",
          title: "Cautelas e limitações",
          paragraphs: [
            "Os resultados podem conter erros e devem ser revisados por profissional habilitado. A VerasJuris recomenda a minimização e a anonimização de dados antes do uso de recursos de inteligência artificial, em especial para dados sensíveis e informações protegidas por sigilo profissional.",
          ],
        },
        {
          id: "8-3-decisoes-automatizadas",
          number: "8.3",
          title: "Decisões automatizadas",
          paragraphs: [
            "Os recursos de inteligência artificial são oferecidos como apoio e não substituem a decisão humana. O titular poderá solicitar a revisão de decisões tomadas unicamente com base em tratamento automatizado que afetem seus interesses, nos termos do art. 20 da LGPD, e informações sobre os critérios utilizados, observados os segredos comercial e industrial.",
          ],
        },
        {
          id: "8-4-treinamento",
          number: "8.4",
          title: "Uso de conteúdo para treinamento de modelos",
          paragraphs: [
            "A política de uso de conteúdo do Usuário para treinamento ou aprimoramento de modelos depende dos provedores efetivamente contratados e das configurações adotadas, e será detalhada e confirmada antes da publicação definitiva desta Política. Nenhuma garantia sobre esse ponto é prestada nesta minuta.",
          ],
        },
      ],
    },
    {
      id: "pagamentos",
      number: "9",
      title: "Pagamentos",
      clauses: [
        {
          id: "9-1-processamento",
          number: "9.1",
          title: "Processamento de pagamentos",
          paragraphs: [
            "Quando houver cobrança, os pagamentos poderão ser processados por instituições de pagamento terceiras, que atuam como controladoras ou operadoras independentes, conforme o caso, e cujas políticas de privacidade são aplicáveis. A VerasJuris recebe informações necessárias à conciliação, como identificação da transação, status e valor.",
          ],
        },
        {
          id: "9-2-nao-configurado",
          number: "9.2",
          title: "Disponibilidade",
          paragraphs: [
            "Se nenhum processador de pagamento estiver configurado, não haverá envio de dados de pagamento a terceiros pela Plataforma.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      number: "10",
      title: "Cookies e tecnologias semelhantes",
      clauses: [
        {
          id: "10-1-uso-de-cookies",
          number: "10.1",
          title: "Uso de cookies",
          paragraphs: [
            "A Plataforma utiliza cookies e armazenamento local para funcionamento essencial (sessão, segurança, preferências de idioma e acessibilidade) e, quando aplicável, para medição de uso e melhoria. Informações detalhadas, categorias e meios de gerenciar preferências constam da Política de Cookies, disponível em /politicas/cookies.",
          ],
        },
        {
          id: "10-2-gerenciamento",
          number: "10.2",
          title: "Gerenciamento de preferências",
          paragraphs: [
            "O titular pode gerenciar cookies não essenciais pelas configurações da Plataforma, quando disponíveis, e do navegador. A desativação de cookies essenciais pode comprometer o funcionamento de funcionalidades autenticadas.",
          ],
        },
      ],
    },
    {
      id: "transferencia-internacional",
      number: "11",
      title: "Transferência internacional de dados",
      clauses: [
        {
          id: "11-1-possibilidade",
          number: "11.1",
          title: "Possibilidade de transferência",
          paragraphs: [
            "Provedores de infraestrutura, comunicação, pagamento ou inteligência artificial podem estar localizados ou tratar dados fora do Brasil. Nesses casos, a transferência observará as hipóteses do art. 33 da LGPD e a regulamentação da ANPD, mediante mecanismos como cláusulas-padrão contratuais, países com grau adequado de proteção ou outras bases admitidas.",
          ],
        },
        {
          id: "11-2-confirmacao",
          number: "11.2",
          title: "Confirmação pendente",
          paragraphs: [
            "A localização efetiva do tratamento e os mecanismos de transferência aplicáveis dependem dos provedores contratados e serão informados após validação institucional.",
          ],
        },
      ],
    },
    {
      id: "seguranca",
      number: "12",
      title: "Segurança da informação",
      clauses: [
        {
          id: "12-1-praticas",
          number: "12.1",
          title: "Práticas de segurança em alto nível",
          paragraphs: [
            "A VerasJuris adota medidas técnicas e administrativas razoáveis, proporcionais ao risco e ao estado da técnica, voltadas à proteção dos dados pessoais contra acessos não autorizados, perda, alteração ou divulgação indevida. Entre elas:",
          ],
          bullets: [
            "Armazenamento protegido de credenciais, sem guarda de senhas em texto legível;",
            "Controle de acesso e segregação de dados por conta e por organização;",
            "Comunicação protegida por criptografia em trânsito, quando suportada pelo ambiente de execução;",
            "Registro de eventos relevantes para auditoria e investigação de incidentes;",
            "Política de senhas e mecanismos de verificação de e-mail e recuperação de conta;",
            "Princípio do menor privilégio no acesso interno, na medida do possível;",
            "Rotinas de revisão e aprimoramento contínuo das práticas de segurança.",
          ],
        },
        {
          id: "12-2-ausencia-de-certificacoes",
          number: "12.2",
          title: "Certificações e limites",
          paragraphs: [
            "Esta Política não declara a obtenção de certificações de segurança específicas (como ISO 27001 ou SOC 2). Eventuais certificações somente serão divulgadas após obtenção e comprovação. Nenhum sistema é totalmente imune a riscos, e não é possível garantir segurança absoluta.",
          ],
        },
        {
          id: "12-3-responsabilidade-compartilhada",
          number: "12.3",
          title: "Responsabilidade compartilhada",
          paragraphs: [
            "O Usuário colabora com a segurança ao proteger suas credenciais, manter dispositivos atualizados, conceder acessos apenas a pessoas autorizadas e comunicar imediatamente suspeitas de uso indevido.",
          ],
        },
      ],
    },
    {
      id: "retencao-e-eliminacao",
      number: "13",
      title: "Retenção, eliminação e anonimização",
      clauses: [
        {
          id: "13-1-retencao",
          number: "13.1",
          title: "Prazos de retenção",
          paragraphs: [
            "Os dados são mantidos pelo tempo necessário ao cumprimento das finalidades, durante a vigência da relação e, após o encerramento, pelos prazos exigidos por lei ou necessários ao exercício regular de direitos, à prevenção a fraudes e à defesa em processos. Prazos específicos por categoria de dados serão definidos e divulgados após validação jurídica.",
          ],
          callout:
            "Pendência: tabela de prazos de retenção por categoria ainda não validada. Nenhum prazo numérico foi presumido.",
        },
        {
          id: "13-2-eliminacao-e-anonimizacao",
          number: "13.2",
          title: "Eliminação e anonimização",
          paragraphs: [
            "Encerrada a finalidade ou a necessidade de retenção, os dados serão eliminados ou anonimizados, ressalvadas as hipóteses de conservação do art. 16 da LGPD, como cumprimento de obrigação legal, estudo por órgão de pesquisa, transferência a terceiro nos termos da lei e uso exclusivo do controlador com dados anonimizados.",
          ],
        },
        {
          id: "13-3-copias-de-seguranca",
          number: "13.3",
          title: "Cópias de segurança",
          paragraphs: [
            "Dados eliminados podem permanecer temporariamente em cópias de segurança até seu ciclo de sobrescrita, sem uso para outras finalidades.",
          ],
        },
      ],
    },
    {
      id: "direitos-dos-titulares",
      number: "14",
      title: "Direitos dos titulares",
      clauses: [
        {
          id: "14-1-direitos",
          number: "14.1",
          title: "Direitos previstos na LGPD",
          paragraphs: [
            "Nos termos do art. 18 da LGPD, o titular pode solicitar, a qualquer tempo:",
          ],
          bullets: [
            "Confirmação da existência de tratamento;",
            "Acesso aos dados;",
            "Correção de dados incompletos, inexatos ou desatualizados;",
            "Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;",
            "Portabilidade dos dados, nos termos da regulamentação da ANPD;",
            "Eliminação dos dados tratados com consentimento, ressalvadas as hipóteses legais de conservação;",
            "Informação sobre entidades públicas e privadas com as quais houve compartilhamento;",
            "Informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da negativa;",
            "Revogação do consentimento;",
            "Revisão de decisões tomadas unicamente com base em tratamento automatizado;",
            "Oposição ao tratamento realizado com fundamento em hipótese de dispensa de consentimento, em caso de descumprimento da lei.",
          ],
        },
        {
          id: "14-2-canais",
          number: "14.2",
          title: "Canais para exercício dos direitos",
          paragraphs: [
            `Os requerimentos devem ser encaminhados ao canal ${CANAL_PRIVACIDADE}. Os canais definitivos (e-mail do Encarregado, formulário ou área logada) serão divulgados após confirmação institucional.`,
            "Poderão ser solicitadas informações adicionais para confirmar a identidade do requerente, a fim de evitar fraudes e acessos indevidos.",
          ],
        },
        {
          id: "14-3-prazo-e-resposta",
          number: "14.3",
          title: "Prazos e resposta",
          paragraphs: [
            "Os requerimentos serão respondidos nos prazos e na forma previstos na LGPD e na regulamentação da ANPD. Em caso de recusa, o titular será informado das razões, quando cabível.",
          ],
        },
        {
          id: "14-4-dados-de-clientes-do-escritorio",
          number: "14.4",
          title: "Titulares clientes de escritórios",
          paragraphs: [
            "Titulares cujos dados foram inseridos por um Usuário (por exemplo, clientes de um escritório) devem, em regra, dirigir os requerimentos ao próprio escritório ou profissional, que é o controlador desses dados. A VerasJuris, como operadora, auxiliará o controlador conforme suas instruções e a lei.",
          ],
        },
        {
          id: "14-5-anpd",
          number: "14.5",
          title: "Reclamação à ANPD",
          paragraphs: [
            "O titular tem o direito de peticionar à Autoridade Nacional de Proteção de Dados (ANPD) e aos órgãos de defesa do consumidor, sem prejuízo de contato prévio com a VerasJuris.",
          ],
        },
      ],
    },
    {
      id: "incidentes",
      number: "15",
      title: "Incidentes de segurança",
      clauses: [
        {
          id: "15-1-resposta",
          number: "15.1",
          title: "Resposta a incidentes",
          paragraphs: [
            "Na ocorrência de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a VerasJuris adotará medidas para contenção, apuração e mitigação, e comunicará a ANPD e os titulares afetados em prazo razoável, nos termos do art. 48 da LGPD e da regulamentação aplicável.",
          ],
        },
        {
          id: "15-2-comunicacao-do-usuario",
          number: "15.2",
          title: "Cooperação do Usuário",
          paragraphs: [
            `Usuários que identifiquem ou suspeitem de incidente devem comunicar imediatamente o canal ${CANAL_PRIVACIDADE}. Quando a VerasJuris atuar como operadora, informará o controlador (Usuário) sobre incidentes que afetem os dados sob seu controle, para que cumpra seus deveres legais.`,
          ],
        },
      ],
    },
    {
      id: "menores-e-atualizacoes",
      number: "16",
      title: "Crianças e adolescentes, atualizações e lei aplicável",
      clauses: [
        {
          id: "16-1-criancas-e-adolescentes",
          number: "16.1",
          title: "Crianças e adolescentes",
          paragraphs: [
            "A Plataforma não se destina a crianças e adolescentes. Caso dados de menores sejam inseridos por Usuários no contexto de casos jurídicos, o tratamento deverá observar o melhor interesse do menor, conforme o art. 14 da LGPD, sendo o Usuário responsável por sua adequação.",
          ],
        },
        {
          id: "16-2-atualizacoes",
          number: "16.2",
          title: "Atualizações desta Política",
          paragraphs: [
            "Esta Política pode ser atualizada para refletir mudanças legais, técnicas ou operacionais. Alterações relevantes serão comunicadas por meios adequados, com indicação da nova versão e da data de vigência. O histórico de versões e o aceite de cada Usuário são registrados.",
          ],
        },
        {
          id: "16-3-lei-aplicavel",
          number: "16.3",
          title: "Lei aplicável",
          paragraphs: [
            "Esta Política é regida pela legislação brasileira, em especial a Lei nº 13.709/2018 (LGPD), o Marco Civil da Internet (Lei nº 12.965/2014) e, quando aplicável, o Código de Defesa do Consumidor.",
          ],
        },
      ],
    },
  ],
};
