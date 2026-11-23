"use client";

import { ButtonLink } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { RequireAuthCta } from "./require-auth-cta";

type Category = { id: string; key: string; name: string };
type Item = {
  id: string;
  title: string;
  description?: string | null;
  deliveryMode: string;
  pricingModel: string;
  basePriceCents?: number | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  estimatedDuration?: string | null;
  category?: Category;
  professional?: {
    professionalName?: string | null;
    headline?: string | null;
    oabUf?: string | null;
    oabVerificationStatus?: string | null;
    averageRating?: number | null;
    reviewCount?: number;
  };
};

const DELIVERY: Record<string, string> = {
  remote: "Remoto",
  in_person: "Presencial",
  hybrid: "Híbrido",
  other: "Outro",
};

const SORTS: Array<[string, string]> = [
  ["relevance", "Relevância"],
  ["price_asc", "Menor preço"],
  ["price_desc", "Maior preço"],
  ["rating", "Melhor avaliação"],
  ["newest", "Mais recentes"],
];

function brl(cents?: number | null): string | null {
  if (cents === null || cents === undefined) return null;
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function priceText(item: Item): string {
  if (item.pricingModel === "quote_required") return "Sob orçamento";
  const base = brl(item.basePriceCents ?? item.minPriceCents);
  if (!base) return "Sob orçamento";
  if (item.pricingModel === "starting_at") return `A partir de ${base}`;
  if (item.pricingModel === "hourly") return `${base} por hora`;
  return base;
}

export function MarketplacePublicCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("relevance");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/marketplace/public/categories");
        if (res.ok) setCategories(((await res.json()) as { items: Category[] }).items);
      } catch {
        /* filtro de categoria fica indisponível */
      }
    })();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ sort, limit: "24" });
      if (q.trim()) params.set("q", q.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (deliveryMode) params.set("deliveryMode", deliveryMode);
      const max = Number(maxPrice.replace(",", "."));
      if (maxPrice && Number.isFinite(max) && max >= 0) {
        params.set("maxPriceCents", String(Math.round(max * 100)));
      }
      try {
        const res = await fetch(`/api/v1/marketplace/public/catalog?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("falha");
        const data = (await res.json()) as { items: Item[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      } catch {
        if (!controller.signal.aborted) setError("Não foi possível carregar o catálogo agora.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, categoryId, deliveryMode, maxPrice, sort]);

  const filtered = Boolean(q || categoryId || deliveryMode || maxPrice);

  return (
    <section className="vj-stack" aria-labelledby="catalogo-titulo">
      <h2 id="catalogo-titulo" className="vj-section-title">
        Serviços disponíveis
      </h2>
      <form
        className="vj-inline-form"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filtros do catálogo"
      >
        <label>
          Buscar
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          Área
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Atendimento
          <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value)}>
            <option value="">Qualquer</option>
            {Object.entries(DELIVERY).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Preço máximo (R$)
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </label>
        <label>
          Ordenar
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </form>

      {loading ? <p role="status">Carregando serviços…</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="vj-card vj-card-calm">
          <h3 className="vj-section-title">
            {filtered ? "Nenhum serviço com esses filtros" : "Ainda não há serviços publicados"}
          </h3>
          <p>
            {filtered
              ? "Tente remover algum filtro."
              : "Os primeiros profissionais estão sendo ativados. Você pode pedir propostas ou oferecer seus serviços."}
          </p>
          <div className="vj-form-actions">
            <RequireAuthCta
              actionLabel="Pedir propostas"
              title="Entre para pedir propostas"
              message="Descreva seu caso e receba propostas de profissionais verificados."
              redirectTo="/marketplace/solicitacoes/nova"
            />
            <ButtonLink href="/cadastro" variant="secondary">
              Oferecer meus serviços
            </ButtonLink>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? <p className="vj-meta">{total} serviço(s) encontrado(s)</p> : null}
      <div className="vj-feature-grid">
        {items.map((item) => (
          <article key={item.id} className="vj-card">
            <p className="vj-meta">
              {item.category?.name ?? "Serviço"} ·{" "}
              {DELIVERY[item.deliveryMode] ?? item.deliveryMode}
            </p>
            <h3 className="vj-section-title">{item.title}</h3>
            {item.description ? <p>{item.description}</p> : null}
            <p>
              <strong>{priceText(item)}</strong>
              {item.estimatedDuration ? ` · prazo ${item.estimatedDuration}` : ""}
            </p>
            <p className="vj-meta">
              {item.professional?.professionalName ?? "Profissional"}
              {item.professional?.oabUf ? ` · OAB/${item.professional.oabUf}` : ""}
              {item.professional?.oabVerificationStatus === "verified" ? " · verificada" : ""}
              {item.professional?.averageRating
                ? ` · ${item.professional.averageRating.toFixed(1)} (${item.professional.reviewCount ?? 0})`
                : ""}
            </p>
            <RequireAuthCta
              actionLabel="Contratar"
              title="Entre para contratar"
              message="Para contratar um serviço você precisa de uma conta."
              redirectTo="/marketplace/servicos"
              variant="secondary"
            />
          </article>
        ))}
      </div>
    </section>
  );
}
