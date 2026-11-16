"use client";

import { ButtonLink } from "@verasjuris/ui";
import { FileText, Handshake, Shield } from "lucide-react";
import { listLegalDocuments, type LegalDocId } from "../../lib/legal";

const ICONS: Record<LegalDocId, typeof FileText> = {
  "terms-of-use": FileText,
  "terms-of-service": Handshake,
  "privacy-policy": Shield,
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function LegalHub() {
  const documents = listLegalDocuments();
  return (
    <div className="vj-legal-hub">
      <section className="vj-legal-hero">
        <p className="vj-meta">Central jurídica</p>
        <h1 className="vj-display">Transparência, segurança e compromisso jurídico.</h1>
        <p className="vj-lead">
          Conheça as condições que orientam a utilização dos serviços e o tratamento das informações
          no ecossistema VerasJuris.
        </p>
      </section>

      <div className="vj-legal-card-grid">
        {documents.map((doc) => {
          const Icon = ICONS[doc.id];
          return (
            <article key={doc.id} className="vj-legal-card">
              <div className="vj-legal-card-icon" aria-hidden="true">
                <Icon size={22} />
              </div>
              <h2 className="vj-section-title">{doc.shortTitle}</h2>
              <p>{doc.summary}</p>
              <dl className="vj-legal-meta">
                <div>
                  <dt>Versão</dt>
                  <dd>{doc.version}</dd>
                </div>
                <div>
                  <dt>Vigência</dt>
                  <dd>{formatDate(doc.effectiveAt)}</dd>
                </div>
              </dl>
              <ButtonLink href={doc.href}>Consultar documento</ButtonLink>
            </article>
          );
        })}
      </div>
    </div>
  );
}
