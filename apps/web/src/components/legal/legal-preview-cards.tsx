"use client";

import { Button } from "@verasjuris/ui";
import { FileText, Handshake, Shield } from "lucide-react";
import { useState } from "react";
import { CURRENT_LEGAL_REGISTRY, listLegalDocuments, type LegalDocId } from "../../lib/legal";
import { useLocale } from "../locale-provider";
import { LegalDocumentModal } from "./legal-document-modal";

const ICONS: Record<LegalDocId, typeof FileText> = {
  "terms-of-use": FileText,
  "terms-of-service": Handshake,
  "privacy-policy": Shield,
};

const ACTION_KEYS: Record<LegalDocId, string> = {
  "terms-of-use": "legal.preview.viewTerms",
  "terms-of-service": "legal.preview.viewService",
  "privacy-policy": "legal.preview.viewPrivacy",
};

export function LegalPreviewCards() {
  const { t } = useLocale();
  const [openId, setOpenId] = useState<LegalDocId | null>(null);
  const documents = listLegalDocuments();

  return (
    <section className="vj-legal-preview" aria-labelledby="legal-preview-title">
      <h3 id="legal-preview-title" className="vj-section-title">
        {t("legal.preview.title", "Antes de continuar, conheça nossos documentos legais.")}
      </h3>
      <p className="vj-hint">
        {t(
          "legal.preview.lead",
          "Consulte os instrumentos vigentes. O aceite é registrado com a versão correspondente.",
        )}{" "}
        {t("legal.preview.version", "Versão")} {CURRENT_LEGAL_REGISTRY.packageVersion}.
      </p>
      <div className="vj-legal-preview-grid">
        {documents.map((doc) => {
          const Icon = ICONS[doc.id];
          return (
            <article key={doc.id} className="vj-legal-preview-card">
              <div className="vj-legal-card-icon" aria-hidden="true">
                <Icon size={18} />
              </div>
              <h4 className="vj-wizard-review-title">{doc.shortTitle}</h4>
              <p className="vj-meta">{doc.summary}</p>
              <p className="vj-meta">
                {t("legal.preview.version", "Versão")} {doc.version}
              </p>
              <Button
                type="button"
                variant="secondary"
                aria-haspopup="dialog"
                onClick={() => setOpenId(doc.id)}
              >
                {t(
                  ACTION_KEYS[doc.id],
                  doc.id === "terms-of-use"
                    ? "Visualizar termos"
                    : doc.id === "terms-of-service"
                      ? "Visualizar condições"
                      : "Conhecer política",
                )}
              </Button>
            </article>
          );
        })}
      </div>
      <LegalDocumentModal
        open={Boolean(openId)}
        documentId={openId}
        onClose={() => setOpenId(null)}
      />
    </section>
  );
}
