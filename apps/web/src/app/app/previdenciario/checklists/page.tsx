"use client";

import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  catalog as fetchCatalog,
  checklists,
  getActiveMembership,
  getActiveOrgId,
  isApiFailure,
  type BenefitChecklist,
  type BenefitDefinition,
} from "../../../../lib/admin-procedures";

export default function ChecklistsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [canRead, setCanRead] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [benefits, setBenefits] = useState<BenefitDefinition[]>([]);
  const [items, setItems] = useState<BenefitChecklist[]>([]);
  const [benefitKey, setBenefitKey] = useState("");
  const [clientLabel, setClientLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeId: string) => {
    const [cat, list] = await Promise.all([fetchCatalog(activeId), checklists.list(activeId)]);
    setLoading(false);
    if (!isApiFailure(cat)) {
      setBenefits(cat.benefits);
      setBenefitKey((current) => current || cat.benefits[0]?.key || "");
    }
    if (isApiFailure(list)) {
      setError(apiErrorMessage(list, "Não foi possível listar os checklists."));
      return;
    }
    setItems(list.items);
  }, []);

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const permissions = membership?.permissions ?? [];
      setCanRead(permissions.includes("previdentiary.read"));
      setCanEdit(permissions.includes("previdentiary.update"));
      if (!permissions.includes("previdentiary.read")) {
        setLoading(false);
        return;
      }
      setOrgId(activeId);
      await load(activeId);
    })();
  }, [load]);

  async function create() {
    if (!orgId) return;
    const result = await checklists.create(orgId, {
      benefitKey,
      clientLabel: clientLabel || undefined,
    });
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar o checklist."));
      return;
    }
    window.location.href = `/app/previdenciario/checklists/${result.checklist.id}`;
  }

  if (!canRead) {
    return (
      <EmptyState title="Sem permissão">Você não tem acesso ao módulo previdenciário.</EmptyState>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Previdenciário", href: "/app/previdenciario" },
          { label: "Checklists de benefícios" },
        ]}
      />
      <PageHeader
        title="Checklists de benefícios"
        description="Triagem por requisito, com estados verificáveis. Sem “chance de ganhar”."
      />
      <Alert tone="info" title="Pontuação responsável">
        Cada requisito fica como comprovado, parcialmente comprovado, pendente, contraditório, não
        identificado ou sujeito a análise profissional. “Comprovado” exige documento ou descrição da
        prova.
      </Alert>
      {error ? <ErrorState title="Atenção">{error}</ErrorState> : null}

      {canEdit && benefits.length > 0 ? (
        <form
          className="vj-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <FormField id="b" label="Benefício">
            <Select id="b" value={benefitKey} onChange={(e) => setBenefitKey(e.target.value)}>
              {benefits.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="c" label="Cliente (identificação)">
            <Input id="c" value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} />
          </FormField>
          <Button type="submit">Novo checklist</Button>
        </form>
      ) : null}

      {loading ? <LoadingState label="Carregando…" /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Nenhum checklist">Crie o primeiro para começar a triagem.</EmptyState>
      ) : null}
      <ul className="vj-list">
        {items.map((c) => (
          <li key={c.id}>
            <a href={`/app/previdenciario/checklists/${c.id}`}>
              <strong>{c.benefitName}</strong>
            </a>
            {c.clientLabel ? ` · ${c.clientLabel}` : ""}{" "}
            {c.summary.open.length === 0 ? (
              <Badge tone="success">todos comprovados</Badge>
            ) : (
              <Badge tone="warning">{c.summary.open.length} em aberto</Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
