# Relatório técnico — Central jurídica institucional

Data: 2026-11-16  
Versão do pacote documental: `2026-11-16`  
Status: **DRAFT** (pendente revisão jurídica e validação institucional)

## Entregue

### Documentos
- Termos de Uso (`apps/web/src/lib/legal/terms-of-use.ts`) — 11 seções
- Termos de Serviço (`apps/web/src/lib/legal/terms-of-service.ts`) — 9 seções (ampliados após consolidação)
- Política de Privacidade LGPD (`apps/web/src/lib/legal/privacy-policy.ts`) — versão expandida com placeholders institucionais
- Registry/versionamento (`registry.ts`, `types.ts`, `pending-validation.md`)

### Frontend
- Hub `/documentos-legais` com hero + 3 cartões
- Páginas `/termos-de-uso`, `/termos-de-servico`, `/politica-de-privacidade`
- Viewer com índice, progresso de leitura, impressão, compartilhar, voltar ao topo, links cruzados
- Modal amplo no cadastro + prévias interativas
- CSS institucional em `packages/ui/src/styles.css` (respeita `prefers-reduced-motion` e `@media print`)

### Integração
- Rodapé público → central + três documentos
- Cadastro: checkbox único obrigatório (liga `acceptTerms` + `acceptPrivacy`), links clicáveis, hint de que ciência ≠ consentimento genérico
- Payload envia `termsVersion` / `privacyVersion` = `2026-11-16`
- Auditoria `user.registered` inclui versões + `acceptanceEvidence: affirmative_checkbox`
- Compatibilidade: `/politicas/termos`, `/politicas/privacidade`, `/politicas/servico` redirecionam
- Conta (`/app/conta`) link para a central
- Sitemap atualizado

### Reuso sem migration
- Persistência existente em `profiles.terms_accepted_at`, `terms_version`, `privacy_accepted_at`, `privacy_version`
- `termsVersion` cobre o pacote **Uso + Serviço**; `privacyVersion` cobre a Política

## Pendências institucionais (antes de `published`)

Ver `apps/web/src/lib/legal/pending-validation.md`:
- Razão social / CNPJ / sede / foro
- Canal DPO e suporte
- Preços, comissões e tabelas comerciais definitivas
- Lista de operadores/subprocessadores
- Aprovação jurídica formal

## Testes e qualidade

| Check | Resultado |
|-------|-----------|
| `legal-docs.test.ts` + wizard | passed |
| Typecheck/build `@verasjuris/web` | OK (rotas legais geradas) |
| Migrations / deploy | **não executados** |

## Escopo preservado

Sem alteração de pagamentos, marketplace operacional, dashboards ou autenticação além do registro de versões no aceite de cadastro e metadados de auditoria.
