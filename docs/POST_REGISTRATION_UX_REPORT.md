# Relatório — Experiência pós-cadastro (VerasJuris)

## Auditoria (resumo)

| Camada | Situação |
| --- | --- |
| Personas públicas | `client_pf`, `client_pj`, `lawyer`, `law_firm`, `corporate_legal`, `partner_legal`, `partner_service` |
| RBAC | `owner` / `administrator` / `member` — persona **não** é papel; todo cadastro público vira `owner` da org pessoal |
| Shells | `/app` (escritório) e `/portal` (cliente) |
| Design system | `packages/ui` + tokens `.vj-*` (reutilizado; sem DS paralelo) |
| Catálogo | 35 features em `public-catalog.ts` com estados `available` / `in_test` / `in_development` / `planned` |

### Gaps corrigidos nesta entrega

1. Sessão não expunha `onboardingPersona` → login/guards iam sempre a `/app`.
2. `client_pf` ia a `/portal` sem vínculo CRM → “não vinculado”.
3. Dashboard genérico, sem módulos por persona.
4. Perfil sem identidade cadastral / verificação visíveis.
5. Catálogo autenticado de pré-visualização ausente.

## Implementado

- Sessão pública com `user.onboardingPersona`.
- Redirect persona-aware (`persona-home.ts`) em login, cadastro autenticado e formulário de entrada.
- No cadastro `client_pf`: cria `crm_clients` + `organization_client_users` (portal utilizável de imediato).
- Dashboard `/app` com grade de módulos filtrada por persona + permissões + estados de disponibilidade.
- Menu do usuário: Conta, Perfis, Catálogo, Segurança.
- Conta: bloco de identidade (somente leitura) + edição de displayName/locale/timeZone + senha/sessões.
- Portal: atalhos de perfil/solicitações/notificações e empty state honesto.
- `/app/previsualizacao` e `/app/previsualizacao/[slug]` a partir do catálogo real (sem botões falsos de operação).

## Ainda depende de backend / integrações

- Verificação OAB/identidade real (hoje `pending` / stubs).
- Suite de IA, OCR, tribunais, INSS, Asaas live, e-mail/agenda externos (`not_configured` / catálogo).
- Edição cadastral sensível (CPF/endereço) via fluxos dedicados de verificação.
- Persona **não** reduz RBAC automaticamente — autorização continua por permissão no backend.
- Colaborador (`employee`) e admin global da plataforma: fora do cadastro público (convite / operações internas).

## Testes

- `apps/web/src/lib/persona-home.test.ts`
- `apps/api/src/onboarding-register.test.ts` (persona na sessão + vínculo portal)

**Sem merge e sem deploy em produção neste relatório.**
