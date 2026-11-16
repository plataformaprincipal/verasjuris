"use client";

import { Alert, Badge, EmptyState, LoadingState } from "@verasjuris/ui";
import type { OnboardingPersona } from "@verasjuris/validation";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  addMarketplaceCartItem,
  fetchMarketplaceCart,
  fetchMarketplaceCatalog,
  fetchMarketplaceCategories,
  fetchMarketplaceEngagements,
  formatMoneyCents,
  hasMarketplacePermission,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceCatalogItem,
  type MarketplaceCategory,
  type MarketplaceEngagement,
} from "../lib/marketplace";
import {
  AVAILABILITY_LABEL_KEYS,
  type ModuleAvailability,
  type WorkspaceModule,
} from "../lib/persona-workspace";
import { useOrgContext } from "../lib/use-org-context";
import { CreateOrganizationForm } from "./organization-forms";
import { useLocale } from "./locale-provider";

type AccountEvent = { id: string; occurredAt: string; action: string };

function availabilityTone(status: ModuleAvailability): "neutral" | "success" | "warning" | "error" {
  if (status === "available") return "success";
  if (status === "partial" || status === "demo") return "warning";
  if (status === "unavailable") return "error";
  return "neutral";
}

function priceLabel(item: MarketplaceCatalogItem, t: (k: string, f?: string) => string): string {
  if (item.pricingModel === "quote_required") {
    return t("inicio.price.quote", "Sob consulta");
  }
  if (item.basePriceCents != null) return formatMoneyCents(item.basePriceCents);
  if (item.minPriceCents != null) {
    return `${t("inicio.price.from", "A partir de")} ${formatMoneyCents(item.minPriceCents)}`;
  }
  return t("inicio.price.custom", "Personalizado");
}

const MANAGEMENT_LINKS = [
  { href: "/app/marketplace/contratacoes", labelKey: "inicio.mgmt.purchases", fallback: "Minhas compras" },
  { href: "/app/marketplace/contratacoes", labelKey: "inicio.mgmt.hires", fallback: "Minhas contratações" },
  { href: "/app/marketplace/oportunidades", labelKey: "inicio.mgmt.orders", fallback: "Pedidos / oportunidades" },
  { href: "/app/marketplace/propostas", labelKey: "inicio.mgmt.sales", fallback: "Minhas vendas" },
  { href: "/app/marketplace/servicos", labelKey: "inicio.mgmt.listings", fallback: "Meus anúncios" },
  { href: "/app/comunicacao", labelKey: "inicio.mgmt.messages", fallback: "Mensagens" },
  { href: "/app/financeiro", labelKey: "inicio.mgmt.payments", fallback: "Pagamentos e reembolsos" },
  { href: "/app/carrinho", labelKey: "inicio.mgmt.cart", fallback: "Carrinho" },
] as const;

export function MarketplaceInicioHub({
  organizationName,
  organizationSlug,
  verificationStatus,
  events,
  actionLabels,
  taskTotal,
  calendarUpcoming,
  deadlineSuggested,
  deadlineConfirmed,
  persona,
  personaLabel,
  displayName,
  modules,
}: {
  organizationName: string | null;
  organizationSlug: string | null;
  verificationStatus: string | null;
  events: AccountEvent[];
  actionLabels: Record<string, string>;
  taskTotal: number | null;
  calendarUpcoming: number | null;
  deadlineSuggested: number | null;
  deadlineConfirmed: number | null;
  persona: OnboardingPersona | null;
  personaLabel: string;
  displayName: string;
  modules: WorkspaceModule[];
}) {
  const { t, locale } = useLocale();
  const org = useOrgContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const qParam = searchParams.get("q") ?? "";
  const categoryParam = searchParams.get("categoryId") ?? "";
  const sortParam = searchParams.get("sort") ?? "relevance";
  const deliveryParam = searchParams.get("deliveryMode") ?? "";
  const minPriceParam = searchParams.get("minPriceCents") ?? "";
  const maxPriceParam = searchParams.get("maxPriceCents") ?? "";

  const [qDraft, setQDraft] = useState(qParam);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [catalog, setCatalog] = useState<MarketplaceCatalogItem[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [engagements, setEngagements] = useState<MarketplaceEngagement[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cartMsg, setCartMsg] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const hasOrg = Boolean(organizationName);
  const canPublish = hasMarketplacePermission(org.permissions, "service.manage");
  const canReadMarketplace =
    hasMarketplacePermission(org.permissions, "read") ||
    hasMarketplacePermission(org.permissions, "proposal.create") ||
    canPublish;

  useEffect(() => {
    setQDraft(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (qDraft === qParam) return;
      const next = new URLSearchParams(searchParams.toString());
      if (qDraft.trim()) next.set("q", qDraft.trim());
      else next.delete("q");
      next.delete("offset");
      startTransition(() => {
        router.replace(`/app?${next.toString()}`);
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [qDraft, qParam, router, searchParams]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !hasOrg) {
      setLoadingCatalog(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const cats = await fetchMarketplaceCategories(org.orgId!);
      if (!cancelled && !isApiFailure(cats)) setCategories(cats.items);
      const cart = await fetchMarketplaceCart(org.orgId!);
      if (!cancelled && !isApiFailure(cart)) setCartCount(cart.cart.itemCount);
      if (canReadMarketplace) {
        const eng = await fetchMarketplaceEngagements(org.orgId!);
        if (!cancelled && !isApiFailure(eng)) setEngagements(eng.items.slice(0, 5));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, hasOrg, canReadMarketplace]);

  useEffect(() => {
    if (!org.ready || !org.orgId || !hasOrg || !canReadMarketplace) {
      setLoadingCatalog(false);
      return;
    }
    let cancelled = false;
    setLoadingCatalog(true);
    setCatalogError(null);
    void fetchMarketplaceCatalog(
      {
        q: qParam || undefined,
        categoryId: categoryParam || undefined,
        sort: sortParam,
        deliveryMode: deliveryParam || undefined,
        minPriceCents: minPriceParam ? Number(minPriceParam) : undefined,
        maxPriceCents: maxPriceParam ? Number(maxPriceParam) : undefined,
        limit: 12,
        offset: 0,
      },
      org.orgId,
    ).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) {
        setCatalogError(marketplaceErrorMessage(data));
        setCatalog([]);
        setCatalogTotal(0);
      } else {
        setCatalog(data.items);
        setCatalogTotal(data.total);
      }
      setLoadingCatalog(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    org.ready,
    org.orgId,
    hasOrg,
    canReadMarketplace,
    qParam,
    categoryParam,
    sortParam,
    deliveryParam,
    minPriceParam,
    maxPriceParam,
  ]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => {
      router.replace(`/app?${next.toString()}`);
    });
  }

  async function onAddToCart(serviceId: string) {
    if (!org.orgId) return;
    setAddingId(serviceId);
    setCartMsg(null);
    const result = await addMarketplaceCartItem(org.orgId, { professionalServiceId: serviceId });
    setAddingId(null);
    if (isApiFailure(result)) {
      setCartMsg(marketplaceErrorMessage(result));
      return;
    }
    setCartCount(result.cart.itemCount);
    setCartMsg(t("inicio.cart.added", "Item adicionado ao carrinho."));
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("inicio.greeting.morning", "Bom dia")
      : hour < 18
        ? t("inicio.greeting.afternoon", "Boa tarde")
        : t("inicio.greeting.evening", "Boa noite");

  const verification =
    verificationStatus === "not_submitted"
      ? t("dashboard.verification.notSubmitted")
      : verificationStatus === "pending"
        ? t("dashboard.verification.pending")
        : verificationStatus
          ? t("dashboard.verification.status", undefined, { status: verificationStatus })
          : null;

  return (
    <div className="vj-stack vj-inicio">
      <header className="vj-inicio-header">
        <div className="vj-inicio-header-main">
          <p className="vj-inicio-eyebrow">{organizationName ?? t("dashboard.noOrg")}</p>
          <h1 className="vj-inicio-title">
            {greeting}, {displayName}
          </h1>
          <p className="vj-inicio-lead">
            {t(
              "inicio.lead",
              "Central do marketplace jurídico: explore serviços, publique ofertas e acompanhe contratações com dados reais.",
            )}
          </p>
        </div>
        <div className="vj-inicio-header-actions" aria-label={t("inicio.ops", "Operações")}>
          <Link className="vj-button vj-button-ghost" href="/app/comunicacao">
            {t("inicio.messages", "Mensagens")}
          </Link>
          <Link className="vj-button vj-button-secondary" href="/app/carrinho">
            {t("inicio.cart", "Carrinho")}
            {cartCount > 0 ? (
              <Badge tone="warning">{cartCount}</Badge>
            ) : null}
          </Link>
          {canPublish ? (
            <Link className="vj-button" href="/app/marketplace/servicos?novo=1">
              {t("inicio.publish", "Anunciar produto ou serviço")}
            </Link>
          ) : null}
        </div>
      </header>

      {!hasOrg ? (
        <EmptyState title={t("dashboard.empty.orgTitle")}>
          {t("dashboard.emptyOrgBody")}
          <CreateOrganizationForm />
        </EmptyState>
      ) : null}

      {hasOrg ? (
        <>
          <section className="vj-inicio-search" aria-labelledby="inicio-search-heading">
            <h2 id="inicio-search-heading" className="vj-visually-hidden">
              {t("inicio.search.title", "Buscar no marketplace")}
            </h2>
            <label className="vj-field">
              <span className="vj-label">{t("inicio.search.label", "Busca global")}</span>
              <input
                className="vj-input vj-inicio-search-input"
                type="search"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder={t(
                  "inicio.search.placeholder",
                  "Título, descrição, categoria ou profissional…",
                )}
                aria-busy={pending || loadingCatalog}
              />
            </label>
            <div className="vj-inicio-filters">
              <label className="vj-field">
                <span className="vj-label">{t("inicio.filter.category", "Categoria")}</span>
                <select
                  className="vj-input"
                  value={categoryParam}
                  onChange={(e) => setFilter("categoryId", e.target.value)}
                >
                  <option value="">{t("inicio.filter.all", "Todas")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("inicio.filter.modality", "Modalidade")}</span>
                <select
                  className="vj-input"
                  value={deliveryParam}
                  onChange={(e) => setFilter("deliveryMode", e.target.value)}
                >
                  <option value="">{t("inicio.filter.all", "Todas")}</option>
                  <option value="remote">{t("inicio.delivery.remote", "Remoto")}</option>
                  <option value="in_person">{t("inicio.delivery.inPerson", "Presencial")}</option>
                  <option value="hybrid">{t("inicio.delivery.hybrid", "Híbrido")}</option>
                </select>
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("inicio.filter.sort", "Ordenar")}</span>
                <select
                  className="vj-input"
                  value={sortParam}
                  onChange={(e) => setFilter("sort", e.target.value)}
                >
                  <option value="relevance">{t("inicio.sort.relevance", "Relevância")}</option>
                  <option value="newest">{t("inicio.sort.newest", "Mais recentes")}</option>
                  <option value="price_asc">{t("inicio.sort.priceAsc", "Menor preço")}</option>
                  <option value="price_desc">{t("inicio.sort.priceDesc", "Maior preço")}</option>
                  <option value="rating">{t("inicio.sort.rating", "Avaliação")}</option>
                </select>
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("inicio.filter.minPrice", "Preço mín. (R$)")}</span>
                <input
                  className="vj-input"
                  type="number"
                  min={0}
                  step={1}
                  value={minPriceParam ? String(Number(minPriceParam) / 100) : ""}
                  onChange={(e) => {
                    const reais = e.target.value;
                    setFilter(
                      "minPriceCents",
                      reais === "" ? "" : String(Math.round(Number(reais) * 100)),
                    );
                  }}
                />
              </label>
              <label className="vj-field">
                <span className="vj-label">{t("inicio.filter.maxPrice", "Preço máx. (R$)")}</span>
                <input
                  className="vj-input"
                  type="number"
                  min={0}
                  step={1}
                  value={maxPriceParam ? String(Number(maxPriceParam) / 100) : ""}
                  onChange={(e) => {
                    const reais = e.target.value;
                    setFilter(
                      "maxPriceCents",
                      reais === "" ? "" : String(Math.round(Number(reais) * 100)),
                    );
                  }}
                />
              </label>
            </div>
            {categories.length > 0 ? (
              <div className="vj-inicio-cats" role="list" aria-label={t("inicio.categories", "Categorias")}>
                {categories.slice(0, 10).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="listitem"
                    className={
                      categoryParam === c.id
                        ? "vj-inicio-cat vj-inicio-cat-active"
                        : "vj-inicio-cat"
                    }
                    onClick={() =>
                      setFilter("categoryId", categoryParam === c.id ? "" : c.id)
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          {cartMsg ? (
            <Alert tone="info" title={t("inicio.cart.title", "Carrinho")}>
              {cartMsg}
            </Alert>
          ) : null}

          <section className="vj-stack" aria-labelledby="inicio-catalog-heading">
            <div className="vj-inicio-section-head">
              <h2 id="inicio-catalog-heading" className="vj-section-title">
                {t("inicio.catalog.title", "Serviços em destaque")}
              </h2>
              <p className="vj-meta">
                {t("inicio.catalog.count", undefined, { count: catalogTotal }) ||
                  `${catalogTotal} resultado(s)`}
              </p>
            </div>
            {!canReadMarketplace ? (
              <Alert tone="warning" title={t("marketplace.noPermission")}>
                {t(
                  "inicio.catalog.noPerm",
                  "Sua organização não possui permissão de leitura no marketplace.",
                )}
              </Alert>
            ) : null}
            {loadingCatalog ? <LoadingState label={t("common.loading")} /> : null}
            {catalogError ? (
              <Alert tone="error" title={t("common.error", "Erro")}>
                {catalogError}
              </Alert>
            ) : null}
            {!loadingCatalog && !catalogError && catalog.length === 0 && canReadMarketplace ? (
              <EmptyState title={t("inicio.catalog.empty", "Nenhum serviço encontrado")}>
                {t(
                  "inicio.catalog.emptyBody",
                  "Ajuste os filtros ou publique um anúncio se estiver habilitado.",
                )}
              </EmptyState>
            ) : null}
            {catalog.length > 0 ? (
              <div className="vj-inicio-grid">
                {catalog.map((item) => (
                  <article key={item.id} className="vj-inicio-card">
                    <div className="vj-inicio-card-top">
                      <Badge tone="neutral">{item.category?.name ?? "—"}</Badge>
                      <span className="vj-meta">{item.deliveryMode}</span>
                    </div>
                    <h3 className="vj-inicio-card-title">{item.title}</h3>
                    <p className="vj-inicio-card-pro">
                      {item.professional?.professionalName ??
                        t("inicio.professional.unknown", "Profissional")}
                      {item.professional?.oabUf
                        ? ` · OAB/${item.professional.oabUf}`
                        : null}
                    </p>
                    {item.description ? (
                      <p className="vj-inicio-card-desc">{item.description.slice(0, 140)}</p>
                    ) : null}
                    <div className="vj-inicio-card-foot">
                      <strong>{priceLabel(item, t)}</strong>
                      {item.professional?.averageRating != null ? (
                        <span className="vj-meta">
                          ★ {item.professional.averageRating.toFixed(1)} (
                          {item.professional.reviewCount ?? 0})
                        </span>
                      ) : null}
                    </div>
                    <div className="vj-inline-actions">
                      <Link
                        className="vj-button vj-button-secondary"
                        href={`/marketplace/profissionais/${item.professionalProfileId}`}
                      >
                        {t("inicio.viewProfile", "Ver perfil")}
                      </Link>
                      {item.pricingModel === "fixed" && item.basePriceCents != null ? (
                        <button
                          type="button"
                          className="vj-button"
                          disabled={addingId === item.id}
                          onClick={() => void onAddToCart(item.id)}
                        >
                          {addingId === item.id
                            ? t("common.loading")
                            : t("inicio.addCart", "Adicionar ao carrinho")}
                        </button>
                      ) : (
                        <Link
                          className="vj-button"
                          href={`/marketplace/profissionais/${item.professionalProfileId}`}
                        >
                          {t("inicio.requestQuote", "Solicitar proposta")}
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

          <section className="vj-stack" aria-labelledby="inicio-mgmt-heading">
            <h2 id="inicio-mgmt-heading" className="vj-section-title">
              {t("inicio.mgmt.title", "Área de gestão")}
            </h2>
            <div className="vj-inicio-mgmt">
              {MANAGEMENT_LINKS.map((link) => (
                <Link key={link.labelKey} className="vj-inicio-mgmt-link" href={link.href}>
                  {t(link.labelKey, link.fallback)}
                </Link>
              ))}
            </div>
          </section>

          {engagements.length > 0 ? (
            <section className="vj-card vj-stack" aria-labelledby="inicio-eng-heading">
              <h2 id="inicio-eng-heading" className="vj-section-title">
                {t("inicio.recentEngagements", "Contratações recentes")}
              </h2>
              <ul className="vj-stack">
                {engagements.map((e) => (
                  <li key={e.id}>
                    <Link href={`/app/marketplace/contratacoes/${e.id}`}>
                      {e.id.slice(0, 8)}… · {e.status}
                      {e.financialStatus && e.financialStatus !== "none"
                        ? ` · ${e.financialStatus}`
                        : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="vj-card">
            <h2 className="vj-section-title">{t("dashboard.activeContext")}</h2>
            <p>
              {organizationName}
              {organizationSlug ? <span className="vj-technical"> · {organizationSlug}</span> : null}
            </p>
            {personaLabel ? (
              <p className="vj-meta">
                {t("dashboard.persona", "Perfil de cadastro")}: {personaLabel}
              </p>
            ) : null}
            {verification ? <p>{verification}</p> : null}
          </section>

          {(taskTotal !== null ||
            calendarUpcoming !== null ||
            deadlineSuggested !== null ||
            deadlineConfirmed !== null) && (
            <section className="vj-card">
              <h2 className="vj-section-title">{t("dashboard.productivity")}</h2>
              <ul>
                {taskTotal !== null ? (
                  <li>{t("dashboard.tasksCount", undefined, { count: taskTotal })}</li>
                ) : null}
                {calendarUpcoming !== null ? (
                  <li>{t("dashboard.appointmentsWeek", undefined, { count: calendarUpcoming })}</li>
                ) : null}
                {deadlineSuggested !== null ? (
                  <li>
                    {t("dashboard.deadlinesSuggestedCount", undefined, {
                      count: deadlineSuggested,
                    })}
                  </li>
                ) : null}
                {deadlineConfirmed !== null ? (
                  <li>
                    {t("dashboard.deadlinesConfirmedCount", undefined, {
                      count: deadlineConfirmed,
                    })}
                  </li>
                ) : null}
              </ul>
            </section>
          )}

          {modules.length > 0 ? (
            <details className="vj-inicio-modules">
              <summary className="vj-section-title">
                {t("dashboard.yourModules", "Seus módulos")}
              </summary>
              <p className="vj-meta">
                {t(
                  "dashboard.modulesLead",
                  "Acesso conforme suas permissões. Estados parciais e em desenvolvimento não executam operações sensíveis.",
                )}
              </p>
              <div className="vj-feature-grid">
                {modules.map((module) => {
                  const href =
                    module.availability === "in_development" || module.availability === "demo"
                      ? (module.previewHref ?? module.href)
                      : module.href;
                  const label = t(
                    AVAILABILITY_LABEL_KEYS[module.availability],
                    module.availability,
                  );
                  return (
                    <a key={module.id} className="vj-card vj-card-link" href={href}>
                      <Badge tone={availabilityTone(module.availability)}>{label}</Badge>
                      <h3 className="vj-section-title">{t(module.titleKey, module.id)}</h3>
                      <p>{t(module.descriptionKey, "")}</p>
                    </a>
                  );
                })}
              </div>
            </details>
          ) : null}

          <section className="vj-card">
            <h2 className="vj-section-title">{t("dashboard.accountRecords")}</h2>
            {events.length === 0 ? (
              <p>{t("dashboard.emptyEventsDetail")}</p>
            ) : (
              <ul>
                {events.slice(0, 8).map((event) => (
                  <li key={event.id}>
                    {actionLabels[event.action] ?? event.action}
                    <span className="vj-meta">
                      {" · "}
                      {new Date(event.occurredAt).toLocaleString(locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
