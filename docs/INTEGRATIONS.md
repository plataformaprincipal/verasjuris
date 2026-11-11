# Integrações externas

Toda integração passa pelo Provider Registry. Domínios nunca chamam SDK externo direto.

Status: CONFIGURED | NOT_CONFIGURED | DEGRADED | FAILED | DISABLED.

UI: `/app/control/integracoes`.

## Adapters de produção (fetch, sem SDK pesado)

| Domínio | Env | Adapter | Default sem credencial |
| --- | --- | --- | --- |
| E-mail transacional (`@verasjuris/email`) | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | `ResendEmailProvider` | `not_configured` |
| IA (`@verasjuris/ai`) | `FEATURE_AI=1` + `AI_PROVIDER=openai` + `OPENAI_API_KEY` | `OpenAIProvider` | `not_configured` |
| Object storage (`@verasjuris/storage`) | `STORAGE_PROVIDER=supabase` + `SUPABASE_*` | `SupabaseStorageProvider` (bucket privado) | `NOT_CONFIGURED` |

Deploy e variáveis: `docs/PRODUCTION_DEPLOY.md`. Comunicação omnichannel ainda usa contratos em `@verasjuris/ai` (canais); o e-mail de identidade/auth usa `@verasjuris/email`.
