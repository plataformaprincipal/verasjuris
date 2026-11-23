"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { CHECKLIST_ITEM_STATUSES, CHECKLIST_STATUS_LABEL } from "@verasjuris/validation";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  checklists,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  type BenefitChecklist,
  type ChecklistItemStatus,
} from "../../../../../lib/admin-procedures";

const TONE: Record<ChecklistItemStatus, "success" | "warning" | "error" | "neutral"> = {
  comprovado: "success",
  parcialmente_comprovado: "warning",
  pendente: "warning",
  contraditorio: "error",
  nao_identificado: "neutral",
  sujeito_analise_profissional: "neutral",
};

export default function ChecklistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [data, setData] = useState<BenefitChecklist | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { status: ChecklistItemStatus; note: string }>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (activeId: string) => {
      const result = await checklists.get(activeId, id);
      if (isApiFailure(result)) {
        setError(apiErrorMessage(result, "Não foi possível abrir o checklist."));
        return;
      }
      setData(result.checklist);
      setDrafts(
        Object.fromEntries(
          result.checklist.requirements.map((r) => [
            r.key,
            { status: r.status, note: r.note ?? "" },
          ]),
        ),
      );
    },
    [id],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) return;
      setOrgId(activeId);
      setCanEdit(Boolean(membership?.permissions?.includes("previdentiary.update")));
      await load(activeId);
    })();
  }, [load]);

  async function save(key: string) {
    if (!orgId) return;
    const draft = drafts[key];
    if (!draft) return;
    setBusy(key);
    setError(null);
    const result = await checklists.updateItem(orgId, id, key, {
      status: draft.status,
      note: draft.note || undefined,
    });
    setBusy(null);
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível salvar."));
      return;
    }
    setData(result.checklist);
  }

  if (!data) {
    return error ? (
      <ErrorState title="Erro">{error}</ErrorState>
    ) : (
      <LoadingState label="Carregando checklist" />
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Previdenciário", href: "/app/previdenciario" },
          { label: "Checklists", href: "/app/previdenciario/checklists" },
          { label: data.benefitName },
        ]}
      />
      <PageHeader
        title={data.benefitName}
        description={data.clientLabel ?? undefined}
        actions={
          data.summary.open.length === 0 ? (
            <Badge tone="success">Todos os requisitos comprovados</Badge>
          ) : (
            <Badge tone="warning">{data.summary.open.length} requisito(s) em aberto</Badge>
          )
        }
      />
      <Alert tone="info" title="Leitura do resultado">
        O checklist organiza a prova; não prevê o resultado do pedido. Requisitos com regra de
        transição ou situação especial devem ficar como “sujeito a análise profissional”.
      </Alert>
      {error ? (
        <Alert tone="error" title="Atenção">
          {error}
        </Alert>
      ) : null}
      {data.requirements.map((req) => (
        <section key={req.key} className="vj-card" aria-labelledby={`r-${req.key}`}>
          <h2 id={`r-${req.key}`} className="vj-section-title">
            {req.label} <Badge tone={TONE[req.status]}>{CHECKLIST_STATUS_LABEL[req.status]}</Badge>
          </h2>
          <p className="vj-meta">{req.basis}</p>
          <p className="vj-meta">Provas usuais: {req.evidence.join(", ")}.</p>
          {canEdit ? (
            <div className="vj-stack">
              <FormField id={`s-${req.key}`} label="Situação">
                <Select
                  id={`s-${req.key}`}
                  value={drafts[req.key]?.status ?? req.status}
                  onChange={(e) =>
                    setDrafts({
                      ...drafts,
                      [req.key]: {
                        status: e.target.value as ChecklistItemStatus,
                        note: drafts[req.key]?.note ?? "",
                      },
                    })
                  }
                >
                  {CHECKLIST_ITEM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CHECKLIST_STATUS_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id={`n-${req.key}`} label="Prova / observação">
                <Textarea
                  id={`n-${req.key}`}
                  rows={2}
                  value={drafts[req.key]?.note ?? ""}
                  onChange={(e) =>
                    setDrafts({
                      ...drafts,
                      [req.key]: {
                        status: drafts[req.key]?.status ?? req.status,
                        note: e.target.value,
                      },
                    })
                  }
                />
              </FormField>
              <div className="vj-form-actions">
                <Button
                  variant="secondary"
                  loading={busy === req.key}
                  onClick={() => void save(req.key)}
                >
                  Salvar
                </Button>
              </div>
            </div>
          ) : req.note ? (
            <p>{req.note}</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
