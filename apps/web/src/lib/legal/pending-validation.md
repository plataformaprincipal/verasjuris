# Pendências de validação institucional — Documentos jurídicos VerasJuris

Pacote: `2026-11-16` · Status atual: **DRAFT** (pendente de revisão jurídica)

Os documentos (`terms-of-use`, `terms-of-service`, `privacy-policy`) **não podem** ser movidos para `published` enquanto os itens abaixo não forem validados. Nenhum desses dados foi inventado; os textos usam marcadores como `[IDENTIFICAÇÃO SOCIETÁRIA PENDENTE]`, `[CANAL DE CONTATO PENDENTE DE CONFIRMAÇÃO]`, `[CANAL DE PRIVACIDADE/ENCARREGADO PENDENTE DE CONFIRMAÇÃO]` e `[FORO DE ELEIÇÃO PENDENTE DE VALIDAÇÃO]`.

## 1. Identificação societária
- [ ] Razão social / denominação empresarial
- [ ] CNPJ
- [ ] Endereço da sede
- [ ] Representante legal
- [ ] Nome fantasia/marca registrada (se aplicável)

## 2. Canais oficiais
- [ ] E-mail e canal de suporte ao usuário
- [ ] Canal de notificações legais e de direitos autorais
- [ ] Canal de comunicação de vulnerabilidades/incidentes
- [ ] Canal de cobrança/financeiro

## 3. Privacidade e LGPD
- [ ] Nome e e-mail do Encarregado (DPO) designado
- [ ] Canal de exercício de direitos dos titulares (e-mail, formulário ou área logada)
- [ ] Mapeamento definitivo de bases legais por operação de tratamento
- [ ] Tabela de prazos de retenção por categoria de dados
- [ ] Lista de provedores/suboperadores efetivamente ativos e localização do tratamento
- [ ] Mecanismos de transferência internacional (art. 33 LGPD)
- [ ] Política de uso de conteúdo para treinamento de modelos de IA (conforme provedor contratado)
- [ ] Registro das operações de tratamento (ROPA) e avaliação de necessidade de RIPD

## 4. Condições comerciais
- [ ] Planos, preços e periodicidades (definidos apenas nas páginas de planos/checkout)
- [ ] Comissões/taxas de marketplace (se houver)
- [ ] Política de reembolso e prazos
- [ ] Encargos moratórios em caso de inadimplência (se houver)
- [ ] Condições de cancelamento e eventuais fidelidades
- [ ] Níveis de serviço/SLA (somente se formalmente assumidos)
- [ ] Horários e prazos de suporte

## 5. Pagamentos e fiscal
- [ ] Processador(es) de pagamento contratado(s) e ativo(s)
- [ ] Política de chargeback
- [ ] Regime tributário e emissão de documentos fiscais
- [ ] Tratamento fiscal de operações de marketplace

## 6. Integrações e verificação profissional
- [ ] Integrações oficiais efetivamente ativas (tribunais, OAB, órgãos) e sua base de autorização
- [ ] Procedimento operacional de verificação de inscrição na OAB (manual/automática)
- [ ] Declarações sobre certificações de segurança (nenhuma é declarada hoje; só incluir após comprovação)

## 7. Revisão jurídica final
- [ ] Foro de eleição e eventual mediação/arbitragem
- [ ] Conformidade com Código de Ética e Disciplina da OAB (publicidade, captação) para o marketplace
- [ ] Conformidade com o CDC (informação prévia, arrependimento, cláusulas abusivas)
- [ ] Revisão por advogado(a) habilitado(a) de todos os textos
- [ ] Atualizar `CURRENT_LEGAL_REGISTRY.status` para `published` e os `status`/`publishedAt` de cada documento
- [ ] Atualizar versões se o texto mudar (afeta `termsVersion`/`privacyVersion` enviados à API)
