"use client";

import { ButtonLink } from "@verasjuris/ui";
import {
  BadgeCheck,
  Bookmark,
  Compass,
  Ellipsis,
  Flag,
  Heart,
  MessageCircle,
  Newspaper,
  Share2,
  UserRoundPlus,
} from "lucide-react";
import { useState } from "react";
import { FEED_DEMO_BANNER, FEED_DEMO_POSTS, FEED_TOPICS } from "../lib/explore-feed";
import { RequireAuthCta } from "./require-auth-cta";

export function ExploreSocial() {
  const [composer, setComposer] = useState("");

  return (
    <div className="vj-stack">
      <p className="vj-demo-banner" role="status">
        {FEED_DEMO_BANNER}
      </p>

      <div className="vj-feed-layout">
        <aside className="vj-feed-column" aria-label="Navegação do feed">
          <div className="vj-card vj-stack">
            <p className="vj-meta">Explorar</p>
            <h2 className="vj-section-title">Rede jurídica</h2>
            <nav className="vj-stack" aria-label="Atalhos">
              <a href="/explorar">
                <Newspaper size={16} aria-hidden="true" /> Feed público
              </a>
              <a href="/marketplace-juridico">
                <Compass size={16} aria-hidden="true" /> Marketplace
              </a>
              <a href="/ferramentas">Ferramentas</a>
              <a href="/solucoes">Soluções</a>
            </nav>
          </div>
          <div className="vj-card vj-stack">
            <p className="vj-meta">Perfil</p>
            <p>Visitantes veem conteúdo público. Publicar, curtir e seguir exigem conta.</p>
            <div className="vj-form-actions">
              <ButtonLink href="/entrar" variant="secondary">
                Entrar
              </ButtonLink>
              <ButtonLink href="/cadastro">Criar conta</ButtonLink>
            </div>
          </div>
        </aside>

        <section className="vj-feed-column" aria-label="Publicações">
          <div className="vj-card vj-stack">
            <label className="vj-label" htmlFor="explore-composer">
              O que você deseja compartilhar?
            </label>
            <textarea
              id="explore-composer"
              className="vj-input"
              rows={3}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              placeholder="Texto, atualizações profissionais ou conteúdo educativo…"
            />
            <div className="vj-feed-actions">
              <RequireAuthCta
                actionLabel="Publicar"
                message="Publicações reais exigem autenticação. O feed atual é apenas demonstrativo."
                redirectTo="/explorar"
              />
              <span className="vj-meta">Imagens e anexos após o login, conforme permissões.</span>
            </div>
          </div>

          {FEED_DEMO_POSTS.length === 0 ? (
            <div className="vj-card vj-stack">
              <h2 className="vj-section-title">Nenhuma publicação pública</h2>
              <p>Quando houver conteúdo autorizado, ele aparecerá aqui.</p>
            </div>
          ) : (
            FEED_DEMO_POSTS.map((post) => (
              <article key={post.id} className="vj-card vj-feed-post">
                <header className="vj-feed-post-header">
                  <div
                    className="vj-avatar"
                    aria-hidden="true"
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      borderRadius: "999px",
                      background: "var(--vj-blue-light)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                    }}
                  >
                    {post.author.slice(0, 1)}
                  </div>
                  <div className="vj-stack" style={{ gap: "0.15rem", flex: 1 }}>
                    <strong>
                      {post.author}
                      {post.verifiedLabel ? (
                        <>
                          {" "}
                          <BadgeCheck size={16} aria-label={post.verifiedLabel} />
                        </>
                      ) : null}
                    </strong>
                    <span className="vj-meta">
                      {post.persona} · {post.publishedAt} · {post.topic}
                    </span>
                  </div>
                  <button type="button" className="vj-button vj-button-ghost" aria-label="Mais opções">
                    <Ellipsis size={18} aria-hidden="true" />
                  </button>
                </header>
                <p>{post.body}</p>
                <div className="vj-feed-actions">
                  <RequireAuthCta
                    actionLabel="Curtir"
                    variant="ghost"
                    message="Curtidas em publicações reais exigem autenticação."
                    redirectTo="/explorar"
                  />
                  <RequireAuthCta
                    actionLabel="Comentar"
                    variant="ghost"
                    message="Comentários exigem autenticação."
                    redirectTo="/explorar"
                  />
                  <RequireAuthCta
                    actionLabel="Compartilhar"
                    variant="ghost"
                    message="Compartilhamento exige autenticação."
                    redirectTo="/explorar"
                  />
                  <RequireAuthCta
                    actionLabel="Salvar"
                    variant="ghost"
                    message="Salvar publicações exige autenticação."
                    redirectTo="/explorar"
                  />
                  <RequireAuthCta
                    actionLabel="Denunciar"
                    variant="ghost"
                    message="Denúncias exigem autenticação para moderação responsável."
                    redirectTo="/explorar"
                  />
                </div>
                <p className="vj-meta" aria-hidden="true">
                  <Heart size={14} /> <MessageCircle size={14} /> <Share2 size={14} />{" "}
                  <Bookmark size={14} /> <Flag size={14} />
                </p>
              </article>
            ))
          )}
        </section>

        <aside className="vj-feed-column" aria-label="Sugestões">
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">Temas</h2>
            <div className="vj-feed-suggestions">
              {FEED_TOPICS.map((topic) => (
                <span key={topic} className="vj-badge">
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">Sugestões</h2>
            <p className="vj-meta">
              Sugestões de perfis reais só aparecerão quando houver dados públicos aprovados.
            </p>
            <RequireAuthCta
              actionLabel="Seguir profissionais"
              variant="secondary"
              message="Seguir perfis exige autenticação."
              redirectTo="/explorar"
            />
            <p className="vj-meta">
              <UserRoundPlus size={14} aria-hidden="true" /> Rede profissional — sem métricas inventadas.
            </p>
          </div>
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">Demonstrações</h2>
            <p>Prefere ver módulos operacionais com dados fictícios?</p>
            <ButtonLink href="/explorar?view=painel" variant="secondary">
              Abrir laboratório
            </ButtonLink>
          </div>
        </aside>
      </div>
    </div>
  );
}
