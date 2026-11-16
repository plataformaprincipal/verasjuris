import type { LegalDocument } from "./types";

export const termsOfUse: LegalDocument = {
  id: "terms-of-use",
  slug: "termos-de-uso",
  href: "/termos-de-uso",
  title: "Termos de Uso do VerasJuris",
  shortTitle: "Termos de Uso",
  summary:
    "Regras de utilização, direitos e responsabilidades dos usuários do ecossistema VerasJuris.",
  category: "Condições de utilização",
  version: "2026-11-16",
  publishedAt: "2026-11-16",
  effectiveAt: "2026-11-16",
  status: "draft",
  readingMinutes: 18,
  related: ["terms-of-service", "privacy-policy"],
  pendingItems: [
    "Razão social e forma societária da entidade responsável",
    "CNPJ e inscrição estadual/municipal, se aplicável",
    "Endereço da sede e foro eleito",
    "Canal oficial do Encarregado (DPO) / Privacidade",
    "Canais de suporte e atendimento institucional",
    "Condições comerciais definitivas de planos e preços",
    "Comissões/repasses de marketplace, se houver",
    "Lista atualizada de operadores e subprocessadores",
    "Aprovação jurídica para status published",
  ],
  sections: [
    {
      id: "s1",
      number: "1",
      title: "Identificação e aceitação",
      clauses: [
        {
          id: "s1-c1-1",
          number: "1.1",
          title: "Entidade responsável",
          paragraphs: [
            'Estes Termos de Uso regulam o acesso e a utilização da plataforma digital VerasJuris ("Plataforma"), disponibilizada pela entidade responsável pelo ecossistema VerasJuris ("VerasJuris", "nós" ou "Controlador operacional da Plataforma").',
            "A identificação societária completa — razão social, CNPJ, endereço da sede e demais dados registrais — será consolidada no quadro de informações institucionais quando da publicação da versão definitiva destes Termos. Até lá, permanece a marcação: [IDENTIFICAÇÃO SOCIETÁRIA PENDENTE].",
          ],
        },
        {
          id: "s1-c1-2",
          number: "1.2",
          title: "Aceitação",
          paragraphs: [
            "Ao criar conta, acessar ou utilizar a Plataforma, o usuário declara ter lido e compreendido estes Termos de Uso e os Termos de Serviço correlatos, bem como ter tomado ciência da Política de Privacidade.",
            "Caso não concorde com qualquer disposição, deverá abster-se de utilizar a Plataforma.",
          ],
        },
        {
          id: "s1-c1-3",
          number: "1.3",
          title: "Natureza do documento",
          paragraphs: [
            "Estes Termos constituem condições gerais de utilização da Plataforma e não substituem contratos específicos, propostas comerciais, ordens de serviço ou instrumentos firmados com terceiros por meio do marketplace ou de canais oficiais.",
          ],
          callout:
            "Documento em status DRAFT, sujeito a revisão jurídica antes da vigência contratual definitiva.",
        },
      ],
    },
    {
      id: "s2",
      number: "2",
      title: "Objeto e natureza da Plataforma",
      clauses: [
        {
          id: "s2-c2-1",
          number: "2.1",
          title: "Objeto",
          paragraphs: [
            "A Plataforma oferece ambiente digital para gestão, organização, comunicação, pesquisa assistida, automações e serviços correlatos no domínio jurídico, destinados a profissionais, organizações e clientes, conforme funcionalidades disponibilizadas e permissões atribuídas.",
          ],
        },
        {
          id: "s2-c2-2",
          number: "2.2",
          title: "Natureza tecnológica",
          paragraphs: [
            "O VerasJuris atua como prestador de serviços de tecnologia da informação aplicados ao ecossistema jurídico. A Plataforma não constitui escritório de advocacia, não exerce advocacia e não substitui a atuação de profissional devidamente inscrito nos quadros da Ordem dos Advogados do Brasil (OAB), quando a lei exigir.",
          ],
          callout:
            "Nenhuma funcionalidade da Plataforma garante resultado jurídico, êxito processual ou aconselhamento personalizado substitutivo da advocacia.",
        },
        {
          id: "s2-c2-3",
          number: "2.3",
          title: "Escopo variável",
          paragraphs: [
            "Módulos, integrações e provedores externos podem estar indisponíveis, em fase de testes ou marcados como não configurados. A mera existência de rota ou interface não implica disponibilidade operacional completa.",
          ],
        },
      ],
    },
    {
      id: "s3",
      number: "3",
      title: "Definições",
      clauses: [
        {
          id: "s3-c3-1",
          number: "3.1",
          title: "Termos definidos",
          paragraphs: [
            "Para os fins destes Termos, aplicam-se as seguintes definições, sem prejuízo de outras constantes na Política de Privacidade e nos Termos de Serviço:",
          ],
          bullets: [
            "Usuário: pessoa física titular de conta na Plataforma.",
            "Organização: pessoa jurídica ou entidade representada no ambiente multi-tenant da Plataforma.",
            "Conta: credencial de acesso associada a um Usuário.",
            "Conteúdo do Usuário: dados, documentos, textos, arquivos e informações inseridos ou transmitidos pelo Usuário ou por sua Organização.",
            "Marketplace: ambiente de divulgação e intermediação tecnológica de serviços jurídicos e correlatos oferecidos por terceiros.",
            "Ferramentas de IA: recursos de assistência automatizada baseados em modelos de linguagem ou sistemas correlatos.",
            "Profissional verificado: Usuário submetido a fluxo de verificação profissional, quando disponível.",
          ],
        },
      ],
    },
    {
      id: "s4",
      number: "4",
      title: "Elegibilidade e cadastro",
      clauses: [
        {
          id: "s4-c4-1",
          number: "4.1",
          title: "Capacidade",
          paragraphs: [
            "O cadastro é destinado a pessoas com plena capacidade civil. Menores de 18 (dezoito) anos não podem criar conta nesta fase da Plataforma.",
          ],
        },
        {
          id: "s4-c4-2",
          number: "4.2",
          title: "Dados cadastrais",
          paragraphs: [
            "O Usuário deverá fornecer informações verdadeiras, completas e atualizadas, incluindo, quando solicitados, dados de identificação, contato, documentos e informações profissionais ou organizacionais.",
          ],
        },
        {
          id: "s4-c4-3",
          number: "4.3",
          title: "Contas e segurança",
          paragraphs: [
            "O Usuário é responsável pela guarda de suas credenciais, pela confidencialidade da senha e por atividades realizadas sob sua Conta, salvo prova de uso indevido não imputável a si após comunicação tempestiva.",
          ],
        },
        {
          id: "s4-c4-4",
          number: "4.4",
          title: "Organizações e representantes",
          paragraphs: [
            "Quem cadastrar Organização declara possuir poderes para representá-la e vincular seus membros às regras da Plataforma, no limite das permissões atribuídas.",
          ],
        },
      ],
    },
    {
      id: "s5",
      number: "5",
      title: "Perfis profissionais e verificação OAB",
      clauses: [
        {
          id: "s5-c5-1",
          number: "5.1",
          title: "Perfis acumuláveis",
          paragraphs: [
            "A Plataforma pode admitir perfis profissionais e institucionais acumuláveis (por exemplo, advogado, parceiro, colaborador), sem impor tipo exclusivo de usuário.",
          ],
        },
        {
          id: "s5-c5-2",
          number: "5.2",
          title: "Verificação profissional",
          paragraphs: [
            "Fluxos de verificação de inscrição na OAB ou de identidade profissional, quando existentes, dependem de provedores e processos configurados. Enquanto não houver verificação efetiva, o status poderá permanecer pendente ou não submetido, sem autorização para alegar credencial validada pela Plataforma.",
          ],
        },
        {
          id: "s5-c5-3",
          number: "5.3",
          title: "Responsabilidade profissional",
          paragraphs: [
            "A disponibilização de ferramentas não dispensa o cumprimento de deveres ético-disciplinares, conflitos de interesse, sigilo e demais obrigações legais aplicáveis ao exercício profissional.",
          ],
        },
      ],
    },
    {
      id: "s6",
      number: "6",
      title: "Funcionalidades jurídicas e processos",
      clauses: [
        {
          id: "s6-c6-1",
          number: "6.1",
          title: "Gestão de processos e documentos",
          paragraphs: [
            "Recursos de gestão de processos judiciais e administrativos, documentos, prazos, CRM e finanças destinam-se a apoiar a organização da operação do Usuário ou de sua Organização, conforme permissões e módulos ativos.",
          ],
        },
        {
          id: "s6-c6-2",
          number: "6.2",
          title: "Dados de terceiros",
          paragraphs: [
            "Ao inserir dados de clientes, partes, testemunhas ou terceiros, o Usuário declara possuir base legítima para o tratamento e compromete-se a observar a legislação de proteção de dados e o sigilo profissional, quando cabível.",
          ],
        },
      ],
    },
    {
      id: "s7",
      number: "7",
      title: "Inteligência artificial",
      clauses: [
        {
          id: "s7-c7-1",
          number: "7.1",
          title: "Caráter assistivo",
          paragraphs: [
            "As Ferramentas de IA têm natureza assistiva e informativa. Saídas automatizadas podem conter imprecisões, omissões ou interpretações inadequadas ao caso concreto.",
          ],
        },
        {
          id: "s7-c7-2",
          number: "7.2",
          title: "Revisão humana obrigatória",
          paragraphs: [
            "Conteúdos gerados ou sugeridos por IA devem ser revisados por profissional habilitado antes de qualquer uso externo, peticionamento, aconselhamento a cliente ou decisão que afete direitos.",
          ],
          callout:
            "A IA do VerasJuris não substitui advogado habilitado nem constitui parecer jurídico vinculante.",
        },
        {
          id: "s7-c7-3",
          number: "7.3",
          title: "Limitações e provedores",
          paragraphs: [
            "A disponibilidade de modelos, limites de uso e qualidade das respostas dependem de configuração de provedores, autenticação, planos e políticas técnicas vigentes. Provedores podem estar não configurados em determinados ambientes.",
          ],
        },
      ],
    },
    {
      id: "s8",
      number: "8",
      title: "Marketplace e terceiros",
      clauses: [
        {
          id: "s8-c8-1",
          number: "8.1",
          title: "Intermediação tecnológica",
          paragraphs: [
            "O marketplace e serviços de parceiros constituem ambiente de divulgação e contratação entre Usuários e terceiros. O VerasJuris não se confunde, em regra, com o prestador final do serviço jurídico anunciado, salvo quando expressamente indicado.",
          ],
        },
        {
          id: "s8-c8-2",
          number: "8.2",
          title: "Relação com terceiros",
          paragraphs: [
            "Condições, prazos, honorários e qualidade dos serviços de terceiros são de responsabilidade das partes contratantes, observadas regras específicas dos Termos de Serviço e políticas do marketplace.",
          ],
        },
      ],
    },
    {
      id: "s9",
      number: "9",
      title: "Conteúdo do Usuário e propriedade intelectual",
      clauses: [
        {
          id: "s9-c9-1",
          number: "9.1",
          title: "Titularidade do Conteúdo do Usuário",
          paragraphs: [
            "O Usuário ou sua Organização permanece titular do Conteúdo do Usuário que inserir na Plataforma, sem prejuízo de direitos de terceiros e do sigilo profissional.",
          ],
        },
        {
          id: "s9-c9-2",
          number: "9.2",
          title: "Licença operacional",
          paragraphs: [
            "O Usuário concede ao VerasJuris licença limitada, não exclusiva e revogável, apenas na medida necessária para hospedar, processar, exibir e operar a Plataforma em seu benefício, inclusive por meio de subprocessadores, nos termos da Política de Privacidade.",
          ],
        },
        {
          id: "s9-c9-3",
          number: "9.3",
          title: "Propriedade da Plataforma",
          paragraphs: [
            "Software, marcas, layouts, bases de conhecimento próprias, documentação e demais elementos da Plataforma são protegidos por direitos de propriedade intelectual e não são transferidos ao Usuário, salvo licença de uso nos limites destes Termos.",
          ],
        },
      ],
    },
    {
      id: "s10",
      number: "10",
      title: "Condutas proibidas e segurança",
      clauses: [
        {
          id: "s10-c10-1",
          number: "10.1",
          title: "Vedações",
          paragraphs: ["É vedado, entre outras condutas:"],
          bullets: [
            "Utilizar a Plataforma para fins ilícitos, fraudação, lavagem de dinheiro ou violação de direitos de terceiros;",
            "Tentar obter acesso não autorizado a sistemas, dados ou contas;",
            "Introduzir malware, realizar ataques ou comprometer a disponibilidade dos serviços;",
            "Falsificar identidade, credenciais profissionais ou documentos;",
            "Extrair dados de forma automatizada abusiva (scraping) em desacordo com a lei ou estes Termos;",
            "Utilizar a IA para gerar conteúdo ilícito, difamatório ou que viole sigilo sem autorização.",
          ],
        },
        {
          id: "s10-c10-2",
          number: "10.2",
          title: "Prevenção de fraudes",
          paragraphs: [
            "O VerasJuris poderá adotar medidas razoáveis de prevenção a fraudes, incluindo verificação adicional, limitação de funcionalidades e comunicação a autoridades quando houver obrigação legal.",
          ],
        },
      ],
    },
    {
      id: "s11",
      number: "11",
      title: "Suspensão, encerramento e responsabilidade",
      clauses: [
        {
          id: "s11-c11-1",
          number: "11.1",
          title: "Suspensão e encerramento",
          paragraphs: [
            "O VerasJuris poderá suspender ou encerrar Contas em caso de violação destes Termos, risco à segurança, ordem legal ou inatividade prolongada, observadas as regras comerciais dos Termos de Serviço quando aplicáveis.",
          ],
        },
        {
          id: "s11-c11-2",
          number: "11.2",
          title: "Limitação de responsabilidade",
          paragraphs: [
            "Na máxima extensão permitida pela legislação brasileira aplicável, o VerasJuris não responde por danos decorrentes de decisões tomadas com base em saídas automatizadas sem revisão humana adequada, por atos de terceiros no marketplace, por indisponibilidades de provedores externos não configurados ou fora de seu controle razoável, nem por conteúdos inseridos exclusivamente pelo Usuário.",
            "Nada nestes Termos exclui responsabilidade por dolo, fraude ou outras hipóteses de exclusão vedadas por lei, inclusive normas de consumo quando aplicáveis à relação concreta.",
          ],
        },
        {
          id: "s11-c11-3",
          number: "11.3",
          title: "Alterações",
          paragraphs: [
            "Estes Termos poderão ser atualizados. Versões relevantes serão identificadas por número de versão e data de vigência. Aceites anteriores não são substituídos silenciosamente; novo aceite poderá ser exigido quando necessário.",
          ],
        },
        {
          id: "s11-c11-4",
          number: "11.4",
          title: "Lei aplicável e foro",
          paragraphs: [
            "Aplica-se a legislação da República Federativa do Brasil. Fica eleito o foro da comarca da sede da entidade responsável, quando identificada, ou outro foro legalmente competente, inclusive o do domicílio do consumidor quando a lei assim determinar.",
          ],
        },
      ],
    },
  ],
};
