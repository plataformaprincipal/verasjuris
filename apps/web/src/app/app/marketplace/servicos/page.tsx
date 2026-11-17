"use client";

import {
  Alert,
  Breadcrumb,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { useLocale } from "../../../../components/locale-provider";
import {
  MARKETPLACE_APP_TABS,
  translateMarketplaceTabs,
} from "../../../../components/marketplace-ui";
import {
  createMarketplaceService,
  fetchMarketplaceCategories,
  fetchMyMarketplaceServices,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  updateMarketplaceService,
  type MarketplaceCategory,
  type MarketplaceService,
} from "../../../../lib/marketplace";
import { useOrgContext } from "../../../../lib/use-org-context";

function ServicesInner() {
  const { t } = useLocale();
  const org = useOrgContext();
  const searchParams = useSearchParams();
  const showForm = searchParams.get("novo") === "1";
  const can = hasMarketplacePermission(org.permissions, "service.manage");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<MarketplaceService[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [formOpen, setFormOpen] = useState(showForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: "",
    title: "",
    description: "",
    deliveryMode: "remote",
    pricingModel: "fixed",
    basePriceReais: "",
    estimatedDuration: "",
    active: true,
  });

  async function reload(orgId: string) {
    const [mine, cats] = await Promise.all([
      fetchMyMarketplaceServices(orgId),
      fetchMarketplaceCategories(orgId),
    ]);
    if (isApiFailure(mine)) {
      setError(marketplaceErrorMessage(mine));
      return;
    }
    if (!isApiFailure(cats)) {
      setCategories(cats.items);
      if (!form.categoryId && cats.items[0]) {
        setForm((f) => ({ ...f, categoryId: cats.items[0]!.id }));
      }
    }
    setItems(mine.items);
    setError(null);
  }

  useEffect(() => {
    const orgId = org.orgId;
    if (!org.ready || !orgId || !can) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [mine, cats] = await Promise.all([
        fetchMyMarketplaceServices(orgId),
        fetchMarketplaceCategories(orgId),
      ]);
      if (cancelled) return;
      if (isApiFailure(mine)) {
        setError(marketplaceErrorMessage(mine));
        setLoading(false);
        return;
      }
      if (!isApiFailure(cats)) {
        setCategories(cats.items);
        const firstCategory = cats.items[0];
        if (firstCategory) {
          setForm((f) => (f.categoryId ? f : { ...f, categoryId: firstCategory.id }));
        }
      }
      setItems(mine.items);
      setError(null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, can]);

  if (org.ready && !can) {
    return <NoPermission>{t("marketplace.noPermission")}</NoPermission>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!org.orgId) return;
    setSaving(true);
    setFormError(null);
    const basePriceCents =
      form.pricingModel === "fixed" && form.basePriceReais !== ""
        ? Math.round(Number(form.basePriceReais) * 100)
        : null;
    const result = await createMarketplaceService(org.orgId, {
      categoryId: form.categoryId,
      title: form.title,
      description: form.description || undefined,
      deliveryMode: form.deliveryMode,
      pricingModel: form.pricingModel,
      basePriceCents,
      estimatedDuration: form.estimatedDuration || undefined,
      active: form.active,
    });
    setSaving(false);
    if (isApiFailure(result)) {
      setFormError(marketplaceErrorMessage(result));
      return;
    }
    setFormOpen(false);
    setForm((f) => ({
      ...f,
      title: "",
      description: "",
      basePriceReais: "",
      estimatedDuration: "",
    }));
    await reload(org.orgId);
  }

  async function toggleActive(service: MarketplaceService) {
    if (!org.orgId) return;
    const result = await updateMarketplaceService(org.orgId, service.id, {
      active: !service.active,
    });
    if (isApiFailure(result)) {
      setError(marketplaceErrorMessage(result));
      return;
    }
    await reload(org.orgId);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: t("dashboard.title", "Início"), href: "/app" },
          { label: t("marketplace.title"), href: "/app/marketplace" },
          { label: t("marketplace.myServices") },
        ]}
      />
      <PageHeader
        title={t("marketplace.myServices")}
        description={t(
          "inicio.listings.desc",
          "Publique, pause ou reative anúncios. Atividades privativas da advocacia exigem perfil habilitado.",
        )}
      />
      <SectionTabs
        label={t("common.sections")}
        items={translateMarketplaceTabs(t, MARKETPLACE_APP_TABS)}
        current="/app/marketplace/servicos"
      />
      <div className="vj-inline-actions">
        <Button type="button" onClick={() => setFormOpen((v) => !v)}>
          {formOpen
            ? t("inicio.listings.cancelForm", "Fechar formulário")
            : t("inicio.publish", "Anunciar produto ou serviço")}
        </Button>
      </div>
      {formOpen ? (
        <form className="vj-card vj-stack" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="vj-subtitle">{t("inicio.listings.formTitle", "Novo anúncio")}</h2>
          {formError ? (
            <ErrorState title={t("common.error", "Erro")}>{formError}</ErrorState>
          ) : null}
          <label className="vj-field">
            <span className="vj-label">{t("inicio.filter.category", "Categoria")}</span>
            <select
              className="vj-input"
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="vj-field">
            <span className="vj-label">{t("inicio.listings.title", "Título")}</span>
            <input
              className="vj-input"
              required
              minLength={3}
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="vj-field">
            <span className="vj-label">{t("inicio.listings.description", "Descrição")}</span>
            <textarea
              className="vj-input"
              rows={4}
              minLength={10}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="vj-inicio-filters">
            <label className="vj-field">
              <span className="vj-label">{t("inicio.filter.modality", "Modalidade")}</span>
              <select
                className="vj-input"
                value={form.deliveryMode}
                onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })}
              >
                <option value="remote">{t("inicio.delivery.remote", "Remoto")}</option>
                <option value="in_person">{t("inicio.delivery.inPerson", "Presencial")}</option>
                <option value="hybrid">{t("inicio.delivery.hybrid", "Híbrido")}</option>
              </select>
            </label>
            <label className="vj-field">
              <span className="vj-label">{t("inicio.listings.pricing", "Cobrança")}</span>
              <select
                className="vj-input"
                value={form.pricingModel}
                onChange={(e) => setForm({ ...form, pricingModel: e.target.value })}
              >
                <option value="fixed">{t("inicio.pricing.fixed", "Preço fixo")}</option>
                <option value="starting_at">{t("inicio.pricing.startingAt", "A partir de")}</option>
                <option value="hourly">{t("inicio.pricing.hourly", "Por hora")}</option>
                <option value="quote_required">{t("inicio.price.quote", "Sob consulta")}</option>
              </select>
            </label>
            <label className="vj-field">
              <span className="vj-label">{t("inicio.listings.price", "Preço (R$)")}</span>
              <input
                className="vj-input"
                type="number"
                min={0}
                step="0.01"
                value={form.basePriceReais}
                onChange={(e) => setForm({ ...form, basePriceReais: e.target.value })}
                disabled={form.pricingModel === "quote_required"}
              />
            </label>
            <label className="vj-field">
              <span className="vj-label">{t("inicio.listings.duration", "Prazo estimado")}</span>
              <input
                className="vj-input"
                maxLength={120}
                value={form.estimatedDuration}
                onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })}
              />
            </label>
          </div>
          <Alert tone="warning" title={t("inicio.listings.legalTitle", "Conformidade")}>
            {t(
              "inicio.listings.legalBody",
              "Não anuncie atividades privativas da advocacia sem habilitação OAB. Intermediação, publicidade e honorários sujeitos a validação jurídica antes da ativação comercial.",
            )}
          </Alert>
          <Button type="submit" disabled={saving}>
            {saving ? t("common.loading") : t("inicio.listings.publish", "Publicar")}
          </Button>
        </form>
      ) : null}
      {loading ? <LoadingState label={t("common.loading")} /> : null}
      {error ? <ErrorState title={t("common.error", "Erro")}>{error}</ErrorState> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState title={t("inicio.listings.empty", "Nenhum anúncio")}>
          {t("inicio.listings.emptyBody", "Publique seu primeiro serviço no marketplace.")}
        </EmptyState>
      ) : null}
      {items.length > 0 ? (
        <ul className="vj-stack">
          {items.map((s) => (
            <li key={s.id} className="vj-card vj-stack">
              <div className="vj-inline-actions">
                <strong>{s.title}</strong>
                <span className="vj-meta">{s.active ? "ativo" : "pausado"}</span>
              </div>
              <p className="vj-meta">
                {s.pricingModel}
                {s.basePriceCents != null ? ` · R$ ${(s.basePriceCents / 100).toFixed(2)}` : null}
              </p>
              <Button
                type="button"
                className="vj-button-secondary"
                onClick={() => void toggleActive(s)}
              >
                {s.active
                  ? t("inicio.listings.pause", "Pausar")
                  : t("inicio.listings.activate", "Reativar")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function AppMarketplaceServicesPage() {
  return (
    <Suspense fallback={<LoadingState label="…" />}>
      <ServicesInner />
    </Suspense>
  );
}
