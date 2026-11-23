"use client";

import { Button, ButtonLink } from "@verasjuris/ui";
import { ArrowUp, Link2, Printer, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { LegalDocument } from "../../lib/legal";
import { getLegalDocument } from "../../lib/legal";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function LegalDocumentView({
  document,
  compact = false,
}: {
  document: LegalDocument;
  compact?: boolean;
}) {
  const [activeId, setActiveId] = useState<string>(document.sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const related = useMemo(
    () => document.related.map((id) => getLegalDocument(id)),
    [document.related],
  );

  useEffect(() => {
    const nodes = document.sections
      .map((section) => window.document.getElementById(section.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.5, 0.8] },
    );
    for (const node of nodes) observer.observe(node);

    function onScroll() {
      const el = window.document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [document.sections]);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : document.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareMessage("Link copiado.");
      window.setTimeout(() => setShareMessage(null), 2500);
    } catch {
      setShareMessage("Não foi possível compartilhar.");
      window.setTimeout(() => setShareMessage(null), 2500);
    }
  }

  return (
    <div className={`vj-legal-doc ${compact ? "vj-legal-doc-compact" : ""}`.trim()}>
      <div className="vj-legal-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <header className="vj-legal-doc-header">
        <p className="vj-meta">{document.category}</p>
        <h1 className="vj-display">{document.title}</h1>
        <p className="vj-lead">{document.summary}</p>
        <dl className="vj-legal-meta">
          <div>
            <dt>Versão</dt>
            <dd>{document.version}</dd>
          </div>
          <div>
            <dt>Vigência</dt>
            <dd>{formatDate(document.effectiveAt)}</dd>
          </div>
          <div>
            <dt>Leitura</dt>
            <dd>≈ {document.readingMinutes} min</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{document.status === "draft" ? "Rascunho" : "Vigente"}</dd>
          </div>
        </dl>
        {document.status === "draft" ? (
          <p className="vj-draft-banner" role="status">
            RASCUNHO — conteúdo institucional sujeito a revisão jurídica antes da vigência
            contratual definitiva. Não tratar como instrumento publicado.
          </p>
        ) : null}
        <div className="vj-form-actions">
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Imprimir
          </Button>
          <Button type="button" variant="ghost" onClick={() => void share()}>
            <Share2 size={16} aria-hidden="true" /> Compartilhar
          </Button>
          {!compact ? (
            <ButtonLink href="/documentos-legais" variant="ghost">
              Central jurídica
            </ButtonLink>
          ) : null}
        </div>
        {shareMessage ? (
          <p className="vj-meta" role="status">
            {shareMessage}
          </p>
        ) : null}
      </header>

      <div className="vj-legal-layout">
        <aside className="vj-legal-toc" aria-label="Índice do documento">
          <button
            type="button"
            className="vj-button vj-button-secondary vj-legal-toc-toggle"
            aria-expanded={tocOpen}
            onClick={() => setTocOpen((value) => !value)}
          >
            Índice
          </button>
          <nav className={tocOpen ? "vj-legal-toc-panel is-open" : "vj-legal-toc-panel"}>
            <p className="vj-label">Sumário</p>
            <ol>
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={activeId === section.id ? "is-active" : undefined}
                    onClick={() => setTocOpen(false)}
                  >
                    <span>{section.number}.</span> {section.title}
                  </a>
                </li>
              ))}
            </ol>
            <p className="vj-meta">Progresso de leitura: {progress}%</p>
          </nav>
        </aside>

        <article className="vj-legal-body vj-prose">
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className="vj-legal-section">
              <h2>
                {section.number}. {section.title}
              </h2>
              {section.intro ? <p>{section.intro}</p> : null}
              {section.clauses.map((clause) => (
                <div key={clause.id} id={clause.id} className="vj-legal-clause">
                  <h3>
                    {clause.number} {clause.title}
                  </h3>
                  {clause.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                  ))}
                  {clause.bullets ? (
                    <ul>
                      {clause.bullets.map((item) => (
                        <li key={item.slice(0, 48)}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  {clause.callout ? (
                    <p className="vj-legal-callout" role="note">
                      {clause.callout}
                    </p>
                  ) : null}
                </div>
              ))}
            </section>
          ))}

          {!compact ? (
            <nav className="vj-legal-related" aria-label="Documentos relacionados">
              <h2>Documentos relacionados</h2>
              <ul>
                {related.map((item) => (
                  <li key={item.id}>
                    <a href={item.href}>
                      <Link2 size={14} aria-hidden="true" /> {item.shortTitle}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </article>
      </div>

      {!compact ? (
        <button
          type="button"
          className="vj-legal-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUp size={16} aria-hidden="true" /> Voltar ao topo
        </button>
      ) : null}
    </div>
  );
}
