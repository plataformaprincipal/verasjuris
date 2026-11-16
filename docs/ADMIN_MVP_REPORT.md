# VerasJuris — Administração interna, integrações e classificação do MVP

**Data:** 2026-11-16  
**Regra:** sem deploy automático, sem migration destrutiva, sem senhas em texto puro, sem falsa homologação.

---

## 1. Conta administrativa e ativação segura

| Item | Status |
|------|--------|
| E-mail alvo | `acesseverasjuris@gmail.com` |
| Papel | `SUPER_ADMIN` (permissões persistidas em `platform_staff`, **não** por comparação de e-mail) |
| Autenticação | Login normal VerasJuris |
| Senha em código/seed | **Não** |
| Mecanismo | Convite de uso único (`platform_admin_invites.token_hash`) + página `/admin/ativar` |
| MFA | Obrigatório para staff (`mfaRequired`); painel bloqueia até MFA ativo |
| Provisionamento | `node scripts/provision-platform-super-admin-invite.mjs` |

**Estado neste ambiente:** convite **não** emitido com sucesso — migration `0026_platform_admin` ainda **não aplicada** no banco conectado (`PROVISION_FAILED` / tabelas ausentes ou falha de conexão). Após aplicar 0026 com backup, rodar o script e guardar o `activationPath` exibido **uma vez**.

---

## 2. Painel administrativo

Rota protegida: **`/admin`** (gate por `platform.*` + MFA).

| Módulo | Estado |
|--------|--------|
| Dashboard | **Operacional** (contagens reais; financeiros PSP = vazio até haver dados) |
| Usuários | **Operacional** (lista/busca/suspender/reativar com motivo auditado) |
| Organizações | **Operacional** (metadados; sem acesso a conteúdo confidencial) |
| Equipe | **Operacional** (lista staff/roles) |
| Integrações | **Operacional** (classificação honesta Resend/OpenAI/Asaas) |
| Financeiro / Marketplace / Social / Suporte / Juris One global | **Indisponível declarado** (UI `AdminUnavailable`, sem ações falsas) |
| Segurança | Orienta MFA/conta; sem exposição de segredos |

Design: sidebar recolhível, métricas, tabelas, estados vazios, responsivo — design system existente.

---

## 3. Permissões

Papéis: `SUPER_ADMIN`, `ADMIN_OPERACIONAL`, `ADMIN_FINANCEIRO`, `SUPORTE`, `MODERADOR`, `ADMIN_COMERCIAL`, `AUDITOR`.  
Catálogo: `packages/types/src/platform-admin.ts`.  
Sessão enriquecida: `account.platform` em `findSession` / `toPublicSession`.  
Proteção: último SUPER_ADMIN não pode ser desativado.

---

## 4. Auditoria de integrações (neste ambiente)

| Serviço | Classificação | Evidência |
|---------|---------------|-----------|
| **Resend** | **Não configurada** | `EMAIL_PROVIDER=not_configured`, chave/from ausentes |
| **OpenAI** | **Não configurada** | `FEATURE_AI=0`, `AI_PROVIDER=not_configured`, chave ausente; probe sem request externo |
| **Asaas** | **Não configurada** | `PAYMENT_PROVIDER=not_configured`, `PAYMENTS_LIVE≠1`, chave ausente |

Nenhum status positivo apenas por existência de variável. Cobranças reais **não** executadas.

---

## 5. Mensagens técnicas na UI

- Mapa `mapErrorCode` ampliado: `AI_PROVIDER_NOT_CONFIGURED`, `INTERNAL_ERROR`, pagamentos, etc.
- Textos pt-BR / en-US / es-ES atualizados (`errors.unavailable`, `errors.forbidden`, `errors.unexpected`, `errors.payment*`).
- Códigos técnicos permanecem em logs/API; UI prioriza linguagem humana.
- Varredura completa de todas as páginas autenticadas: **parcial** (padrão centralizado; resíduos possíveis em telas antigas que ainda usam `apiErrorMessage` bruto).

---

## 6. Traduções

Erros críticos nos **3 idiomas** do cadastro. Textos do painel `/admin` ainda predominantemente em português (pendência de i18n completa do admin).

---

## 7. Testes realizados

| Suite | Resultado |
|-------|-----------|
| `platform-admin.test.ts` | 5/5 passou |
| `api-errors.test.ts` | 3/3 passou |
| `tsc` types / auth / database / api | limpo (pacotes tocados) |
| Probe OpenAI | `not_configured` |
| Probe Resend/Asaas (env) | `not_configured` |
| Provision SUPER_ADMIN | **falhou** (migration/DB) |
| Lint / E2E / build monorepo completo | **não executados nesta entrega** |

---

## 8. Migrations pendentes

| Migration | Aplicar em prod? |
|-----------|------------------|
| `0025_juris_work_credits.sql` | Pendente (Juris One) |
| `0026_platform_admin.sql` | Pendente (admin) |

**Não aplicadas automaticamente.** Exigir backup recuperável.

---

## 9. Pendências críticas

1. Aplicar `0026` (+ `0025` se Work credits) com backup.  
2. Rodar `provision-platform-super-admin-invite.mjs` e ativar via `/admin/ativar`.  
3. Configurar MFA na conta.  
4. Configurar e homologar Resend, OpenAI e Asaas (sandbox) com probes reais.  
5. Completar módulos admin marcados indisponíveis (financeiro, suporte, moderação).  
6. i18n completa do `/admin`.  
7. Lint, typecheck web, E2E, build e regressão de login/cadastro.  
8. Não ativar `PAYMENTS_LIVE` sem autorização.

---

## 10. Classificação final do MVP

### **NOT READY**

**Motivo:** fluxos críticos de operação da plataforma ainda sem evidência de funcionamento ponta a ponta neste ambiente:

- Conta `SUPER_ADMIN` **não provisionada** (migration ausente).  
- Resend, OpenAI e Asaas **não configurados / não homologados**.  
- Módulos admin financeiros, suporte e moderação **explicitamente indisponíveis**.  
- Sem suíte E2E/build completa nesta sessão.

O que **foi** entregue com evidência de código/testes: RBAC de plataforma, painel `/admin` com dados reais onde existem, ativação segura por token, saúde de integrações honesta, mensagens de erro humanizadas nos 3 idiomas para códigos centrais.

**Não declarar READY** até as pendências da seção 9 e probes positivos com orçamento controlado.
