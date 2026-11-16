"use client";

import { Button, ButtonLink } from "@verasjuris/ui";
import { useEffect, useId, useRef } from "react";
import type { LegalDocId } from "../../lib/legal";
import { getLegalDocument } from "../../lib/legal";
import { LegalDocumentView } from "./legal-document-view";

export function LegalDocumentModal({
  open,
  documentId,
  onClose,
}: {
  open: boolean;
  documentId: LegalDocId | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const document = documentId ? getLegalDocument(documentId) : null;

  useEffect(() => {
    if (!open) return;
    const previous =
      window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.document.addEventListener("keydown", onKey);
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.removeEventListener("keydown", onKey);
      window.document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open || !document) return null;

  return (
    <div className="vj-overlay vj-legal-overlay">
      <button type="button" className="vj-overlay-dismiss" aria-label="Fechar" onClick={onClose} />
      <div
        className="vj-dialog vj-legal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
      >
        <header className="vj-legal-dialog-header">
          <div>
            <p className="vj-meta">{document.category}</p>
            <h2 id={titleId} className="vj-section-title">
              {document.shortTitle}
            </h2>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </header>
        <div className="vj-legal-dialog-body">
          <LegalDocumentView document={document} compact />
        </div>
        <footer className="vj-legal-dialog-footer">
          <ButtonLink href={document.href} variant="secondary">
            Abrir página completa
          </ButtonLink>
          <Button type="button" variant="ghost" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button type="button" onClick={onClose}>
            Continuar cadastro
          </Button>
        </footer>
      </div>
    </div>
  );
}
