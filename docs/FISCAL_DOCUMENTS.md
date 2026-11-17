# Documentos fiscais (NFS-e / NF-e)

Invoice de cobrança (`invoices`) ≠ documento fiscal.

## API
- `GET /v1/organizations/:orgId/fiscal-documents`
- `POST /v1/organizations/:orgId/fiscal-documents` — registra solicitação
- `GET /v1/organizations/:orgId/fiscal-documents/health`

## Comportamento honesto
- Provider default: `NotConfiguredFiscalDocumentProvider`
- Persistência em `fiscal_documents` com `number`/`accessKey` nulos quando não configurado
- `emissionReady: false`, `homologation: NOT_HOMOLOGATED`, `authorized: false`

Não emitir NF fictícia. Homologar provedor fiscal em fase futura dedicada.
