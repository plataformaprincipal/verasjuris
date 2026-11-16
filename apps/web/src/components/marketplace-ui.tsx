"use client";

import { Alert, Badge } from "@verasjuris/ui";
import {
  MARKETPLACE_ENGAGEMENT_STATUS_LABELS,
  MARKETPLACE_PROPOSAL_STATUS_LABELS,
  MARKETPLACE_REQUEST_STATUS_LABELS,
  formatDateTime,
  formatMoneyCents,
  type MarketplaceEngagement,
  type MarketplaceProfessional,
  type MarketplaceProposal,
  type MarketplaceRequest,
} from "../lib/marketplace";
import { useLocale } from "./locale-provider";

export const MARKETPLACE_PUBLIC_TABS = [
  { href: "/marketplace", labelKey: "marketplace.overview" },
  { href: "/marketplace/servicos", labelKey: "marketplace.services" },
  { href: "/marketplace/profissionais", labelKey: "marketplace.professionals" },
  { href: "/marketplace/solicitacoes", labelKey: "marketplace.requests" },
  { href: "/marketplace/propostas", labelKey: "marketplace.proposals" },
];

export const MARKETPLACE_APP_TABS = [
  { href: "/app", labelKey: "inicio.nav.explore" },
  { href: "/app/marketplace", labelKey: "marketplace.overview" },
  { href: "/app/marketplace/perfil", labelKey: "marketplace.profile" },
  { href: "/app/marketplace/servicos", labelKey: "marketplace.myServices" },
  { href: "/app/marketplace/oportunidades", labelKey: "marketplace.opportunities" },
  { href: "/app/marketplace/propostas", labelKey: "marketplace.proposals" },
  { href: "/app/marketplace/contratacoes", labelKey: "marketplace.engagements" },
  { href: "/app/carrinho", labelKey: "inicio.cart" },
  { href: "/app/marketplace/avaliacoes", labelKey: "marketplace.reviews" },
];

export function translateMarketplaceTabs(
  t: (key: string, fallback?: string) => string,
  tabs: Array<{ href: string; labelKey: string }>,
) {
  return tabs.map((tab) => ({ href: tab.href, label: t(tab.labelKey) }));
}

function tone(status: string): "neutral" | "success" | "warning" | "error" {
  if (status === "completed" || status === "accepted" || status === "active") return "success";
  if (status === "draft" || status === "submitted" || status === "receiving_proposals") {
    return "warning";
  }
  if (status === "cancelled" || status === "rejected" || status === "disputed") return "error";
  return "neutral";
}

export function MarketplacePaymentBanner({ status }: { status: string | null }) {
  const { t } = useLocale();
  if (!status || status === "ok") return null;
  return (
    <Alert tone="warning" title={t("marketplace.payment.bannerTitle")}>
      {t("marketplace.payment.notConfigured")}
    </Alert>
  );
}

export function MarketplaceRequestsTable({
  items,
  baseHref = "/marketplace/solicitacoes",
}: {
  items: MarketplaceRequest[];
  baseHref?: string;
}) {
  const { t } = useLocale();
  if (items.length === 0) {
    return <p className="vj-meta">{t("marketplace.empty.requests")}</p>;
  }
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{t("marketplace.requests")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("marketplace.table.title")}</th>
            <th scope="col">{t("marketplace.table.state")}</th>
            <th scope="col">{t("marketplace.table.status")}</th>
            <th scope="col">{t("marketplace.table.created")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`${baseHref}/${item.id}`}>{item.title}</a>
              </td>
              <td>{item.locationState ?? "—"}</td>
              <td>
                <Badge tone={tone(item.status)}>
                  {MARKETPLACE_REQUEST_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceProposalsTable({ items }: { items: MarketplaceProposal[] }) {
  const { t } = useLocale();
  if (items.length === 0) return <p className="vj-meta">{t("marketplace.empty.proposals")}</p>;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <thead>
          <tr>
            <th scope="col">{t("marketplace.table.amount")}</th>
            <th scope="col">{t("marketplace.table.version")}</th>
            <th scope="col">{t("marketplace.table.status")}</th>
            <th scope="col">{t("marketplace.table.sent")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatMoneyCents(item.amountCents)}</td>
              <td>{item.version}</td>
              <td>
                <Badge tone={tone(item.status)}>
                  {MARKETPLACE_PROPOSAL_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>{formatDateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceEngagementsTable({
  items,
  baseHref = "/marketplace/contratacoes",
}: {
  items: MarketplaceEngagement[];
  baseHref?: string;
}) {
  const { t } = useLocale();
  if (items.length === 0) return <p className="vj-meta">{t("marketplace.empty.engagements")}</p>;
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <thead>
          <tr>
            <th scope="col">{t("marketplace.table.id")}</th>
            <th scope="col">{t("marketplace.table.status")}</th>
            <th scope="col">{t("marketplace.table.revisions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`${baseHref}/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td>
                <Badge tone={tone(item.status)}>
                  {MARKETPLACE_ENGAGEMENT_STATUS_LABELS[item.status] ?? item.status}
                </Badge>
              </td>
              <td>
                {item.revisionCount}/{item.revisionLimit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketplaceProfessionalsGrid({ items }: { items: MarketplaceProfessional[] }) {
  const { t } = useLocale();
  if (items.length === 0) return <p className="vj-meta">{t("marketplace.empty.professionals")}</p>;
  return (
    <ul className="vj-card-grid">
      {items.map((p) => (
        <li key={p.userId} className="vj-card">
          <h3 className="vj-card-title">
            <a href={`/marketplace/profissionais/${p.userId}`}>
              {p.professionalName ?? t("marketplace.professional")}
            </a>
          </h3>
          <p className="vj-meta">{p.marketplaceHeadline ?? "—"}</p>
          <p className="vj-meta">
            {p.oabUf ? `OAB/${p.oabUf}` : ""} {p.ranking ? `· score ${p.ranking.totalScore}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
