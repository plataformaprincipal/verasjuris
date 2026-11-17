# Relatório de evidências — homologação comercial

Gerado a partir do modelo auditável (migração `0033` + checklist dinâmico).
**Estado inicial do repositório:** a plataforma **não** está apta à operação comercial live.

## Regras

- `PAYMENTS_LIVE=1` é **necessário mas insuficiente** para compra comercial.
- `readyForLive` exige todos os checks required em `PASS` **e** aprovação administrativa ativa em `payments_homologation_approvals`.
- `purchaseReady` por SKU exige `readyForLive` + checks required do SKU em `PASS` (inclui evidências admin para `e2e_sandbox_purchase` e `deliverability`).
- Esta API/código **nunca** escreve `PAYMENTS_LIVE` / `FEATURE_PUBLIC_CHECKOUT`.

## Checks de plataforma (Asaas / pagamentos)

| check_key | required | classificação inicial | notas |
|-----------|----------|----------------------|-------|
| payment_provider_asaas | sim | FAIL / NOT_VERIFIED conforme env | Auto |
| asaas_api_key | sim | FAIL se ausente | Auto (presença, sem expor segredo) |
| asaas_webhook_token | sim | FAIL se ausente | Auto |
| payment_health | sim | FAIL se provider ausente | Auto |
| sandbox_environment | sim | PASS em sandbox | Auto |
| webhook_events_persisted | sim | PASS se tabela existe | Probe DB |
| payment_intents_idempotency | sim | PASS se índice único existe | Probe DB |
| refund_path_exists | sim | PASS | Probe estático de código |
| cancel_path_exists | sim | PASS | Probe estático de código |
| reconciliation_module_present | sim | PASS | Probe estático de código |
| admin_approval | sim | FAIL até aprovação DB | Auto |

## Checks por SKU (mínimo)

| check_key | required | classificação inicial | notas |
|-----------|----------|----------------------|-------|
| price_defined | sim | PASS/FAIL via catálogo | Auto |
| not_not_implemented | sim | FAIL em `AI_VOZ` etc. | Auto |
| entitlements_or_credits | não | PASS/NOT_VERIFIED | Auto |
| feature_binding | não | PASS/FAIL em AI_* | Auto |
| cart_or_service_flow | sim | PASS se tipo comprável/serviço | Auto |
| e2e_sandbox_purchase | sim | **NOT_VERIFIED** | Evidência admin |
| deliverability | sim | **NOT_VERIFIED** | Evidência admin |

## Conclusão honesta

Até haver:

1. evidências reais (sandbox e2e / entregabilidade) registradas por SKU,
2. checklist Asaas verde,
3. aprovação administrativa (`platform.payments.approve`),
4. e (ops) `PAYMENTS_LIVE=1` no ambiente,

o checkout comercial permanece **bloqueado**. Nenhuma aprovação, NF, webhook pago ou cobrança real foi inventada neste trabalho.
