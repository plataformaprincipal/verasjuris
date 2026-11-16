"use client";

import { Alert, Button, ButtonLink, LoadingState } from "@verasjuris/ui";
import {
  BadgeCheck,
  Bookmark,
  Compass,
  Heart,
  MessageCircle,
  Newspaper,
  Repeat2,
  Share2,
  Flag,
  UserRound,
  Bell,
  Users,
  Settings,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { FEED_DEMO_BANNER, FEED_TOPICS } from "../lib/explore-feed";
import {
  createSocialComment,
  createSocialPost,
  createSocialRepost,
  deleteSocialPost,
  fetchAuthSession,
  fetchSocialComments,
  fetchSocialFeed,
  fetchSocialMe,
  fetchSocialNotifications,
  fetchSocialPeople,
  fetchSocialTrending,
  followSocialUser,
  hideSocialPost,
  isApiFailure,
  markAllSocialNotificationsRead,
  reportSocialPost,
  requestSocialConnection,
  socialErrorMessage,
  toggleSocialBookmark,
  toggleSocialLike,
  type SocialComment,
  type SocialNotification,
  type SocialPerson,
  type SocialPost,
} from "../lib/social";
import { useLocale } from "./locale-provider";
import { RequireAuthCta } from "./require-auth-cta";

type Tab = "feed" | "trending" | "connections" | "notifications" | "profile";
type FeedMode = "recent" | "following" | "saved" | "for_you";

function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

export function ExploreSocial() {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<Tab>("feed");
  const [mode, setMode] = useState<FeedMode>("recent");
  const [authenticated, setAuthenticated] = useState(false);
  const [meName, setMeName] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [trending, setTrending] = useState<SocialPost[]>([]);
  const [people, setPeople] = useState<SocialPerson[]>([]);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [visibility, setVisibility] = useState<"public" | "connections" | "draft">("public");
  const [category, setCategory] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [headlineDraft, setHeadlineDraft] = useState("");

  async function refreshSession() {
    const session = await fetchAuthSession();
    if (isApiFailure(session)) {
      setAuthenticated(false);
      setMeName(null);
      setMeId(null);
      return false;
    }
    setAuthenticated(true);
    const display =
      session.account?.user.displayName ??
      session.account?.user.email ??
      t("explore.you", "Você");
    setMeName(display);
    setMeId(session.account?.user.id ?? null);
    const me = await fetchSocialMe();
    if (!isApiFailure(me)) {
      setBioDraft(String(me.profile.bio ?? ""));
      setHeadlineDraft(String(me.profile.headline ?? ""));
      if (me.author?.displayName) setMeName(me.author.displayName);
    }
    return true;
  }

  async function refreshFeed(nextMode = mode) {
    const feed = await fetchSocialFeed({ mode: nextMode, limit: 20 });
    if (isApiFailure(feed)) {
      setError(socialErrorMessage(feed));
      setPosts([]);
      return;
    }
    setError(null);
    setPosts(feed.items);
  }

  async function refreshSide() {
    const trend = await fetchSocialTrending("7d");
    if (!isApiFailure(trend)) setTrending(trend.items);
    if (authenticated) {
      const p = await fetchSocialPeople();
      if (!isApiFailure(p)) setPeople(p.items.filter((x) => x.userId !== meId).slice(0, 8));
      const n = await fetchSocialNotifications();
      if (!isApiFailure(n)) setNotifications(n.items);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshSession();
      if (cancelled) return;
      await refreshFeed("recent");
      if (cancelled) return;
      await refreshSide();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    void refreshFeed(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function onPublish() {
    if (!authenticated) return;
    if (composer.trim().length < 1) return;
    setPublishing(true);
    const result = await createSocialPost({
      body: composer.trim(),
      visibility: visibility === "draft" ? "draft" : visibility,
      status: visibility === "draft" ? "draft" : "published",
      legalCategory: category || undefined,
      hashtags: hashtags || undefined,
    });
    setPublishing(false);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setComposer("");
    setHashtags("");
    setStatus(t("explore.published", "Publicação enviada."));
    await refreshFeed(mode);
    await refreshSide();
  }

  function patchPost(updated: SocialPost) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setTrending((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }

  async function onLike(postId: string) {
    if (!authenticated) return;
    const result = await toggleSocialLike(postId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    patchPost({ ...result.post, likedByMe: result.liked });
  }

  async function onBookmark(postId: string) {
    if (!authenticated) return;
    const result = await toggleSocialBookmark(postId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    patchPost({ ...result.post, bookmarkedByMe: result.bookmarked });
  }

  async function onRepost(postId: string) {
    if (!authenticated) return;
    const result = await createSocialRepost(postId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    patchPost({ ...result.post, repostedByMe: result.reposted });
    setStatus(t("explore.reposted", "Republicado no seu perfil."));
  }

  async function onShare(post: SocialPost) {
    const url = `${window.location.origin}/explorar?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "VerasJuris", text: post.body.slice(0, 120), url });
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(url);
    setStatus(t("explore.linkCopied", "Link permanente copiado."));
  }

  async function onHide(postId: string) {
    if (!authenticated) return;
    if (!window.confirm(t("explore.confirmHide", "Ocultar esta publicação do seu feed?"))) return;
    const result = await hideSocialPost(postId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  async function onReport(postId: string) {
    if (!authenticated) return;
    const reason = window.prompt(
      t("explore.reportReason", "Motivo da denúncia (spam, assédio, dados sensíveis…)"),
      "spam",
    );
    if (!reason || reason.trim().length < 2) return;
    const result = await reportSocialPost(postId, { reasonCode: reason.trim() });
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setStatus(t("explore.reported", "Denúncia registrada para moderação."));
  }

  async function onDelete(postId: string) {
    if (!authenticated) return;
    if (!window.confirm(t("explore.confirmDelete", "Excluir esta publicação?"))) return;
    const result = await deleteSocialPost(postId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  async function loadComments(postId: string) {
    setOpenComments(postId);
    const result = await fetchSocialComments(postId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      setComments([]);
      return;
    }
    setComments(result.items);
  }

  async function sendComment(postId: string) {
    if (!authenticated || commentDraft.trim().length < 1) return;
    const result = await createSocialComment(postId, { body: commentDraft.trim() });
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setCommentDraft("");
    await loadComments(postId);
    await refreshFeed(mode);
  }

  async function onFollow(userId: string) {
    const result = await followSocialUser(userId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setPeople((prev) =>
      prev.map((p) => (p.userId === userId ? { ...p, following: result.following } : p)),
    );
  }

  async function onConnect(userId: string) {
    const result = await requestSocialConnection(userId);
    if (isApiFailure(result)) {
      setError(socialErrorMessage(result));
      return;
    }
    setStatus(t("explore.connectSent", "Solicitação de conexão enviada."));
  }

  const navItems: Array<{ id: Tab; label: string; icon: typeof Newspaper }> = [
    { id: "feed", label: t("explore.nav.feed", "Feed"), icon: Newspaper },
    { id: "trending", label: t("explore.nav.trending", "Tendências"), icon: TrendingUp },
    { id: "connections", label: t("explore.nav.connections", "Conexões"), icon: Users },
    { id: "notifications", label: t("explore.nav.notifications", "Notificações"), icon: Bell },
    { id: "profile", label: t("explore.nav.profile", "Perfil"), icon: UserRound },
  ];

  return (
    <div className="vj-stack vj-social">
      {!authenticated ? (
        <p className="vj-demo-banner" role="status">
          {t(
            "explore.guestBanner",
            "Você está no feed público. Publicar, curtir, comentar e seguir exigem autenticação. Demonstrações de módulos: /explorar?view=painel",
          )}
        </p>
      ) : (
        <p className="vj-meta" role="status">
          {t("explore.authBanner", "Rede social autenticada — dados reais persistidos.")}
          {status ? ` · ${status}` : null}
        </p>
      )}

      {error ? (
        <Alert tone="error" title={t("common.error", "Erro")}>
          {error}
        </Alert>
      ) : null}

      <div className="vj-feed-layout">
        <aside className="vj-feed-column vj-social-side" aria-label={t("explore.nav", "Navegação")}>
          <div className="vj-card vj-stack">
            <p className="vj-meta">VerasJuris</p>
            <h2 className="vj-section-title">{t("explore.networkTitle", "Rede jurídica")}</h2>
            <nav className="vj-social-nav" aria-label={t("explore.nav", "Navegação")}>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      tab === item.id ? "vj-social-nav-item is-active" : "vj-social-nav-item"
                    }
                    onClick={() => setTab(item.id)}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
              <a className="vj-social-nav-item" href="/marketplace-juridico">
                <Compass size={16} aria-hidden="true" /> Marketplace
              </a>
              <a className="vj-social-nav-item" href="/app/conta">
                <Settings size={16} aria-hidden="true" />{" "}
                {t("explore.accountSettings", "Conta e privacidade")}
              </a>
              <a className="vj-social-nav-item" href="/explorar?view=painel">
                {t("explore.demoLab", "Lab demonstrativo")}
              </a>
            </nav>
          </div>
          <div className="vj-card vj-stack">
            <p className="vj-meta">{t("explore.profile", "Perfil")}</p>
            {authenticated ? (
              <>
                <strong>{meName}</strong>
                <Button type="button" className="vj-button-secondary" onClick={() => setTab("profile")}>
                  {t("explore.manageProfile", "Gerenciar perfil")}
                </Button>
              </>
            ) : (
              <>
                <p>{t("explore.guestProfile", "Entre para publicar e gerenciar sua conta.")}</p>
                <div className="vj-form-actions">
                  <ButtonLink href="/entrar?next=%2Fexplorar" variant="secondary">
                    {t("nav.login")}
                  </ButtonLink>
                  <ButtonLink href="/cadastro?next=%2Fexplorar">{t("nav.signup")}</ButtonLink>
                </div>
              </>
            )}
          </div>
        </aside>

        <section className="vj-feed-column" aria-label={t("explore.posts", "Publicações")}>
          {tab === "feed" || tab === "trending" ? (
            <>
              <div className="vj-card vj-stack vj-social-composer">
                <label className="vj-label" htmlFor="explore-composer">
                  {t(
                    "explore.composerLabel",
                    "Compartilhe uma ideia, atualização ou conhecimento jurídico…",
                  )}
                </label>
                <textarea
                  id="explore-composer"
                  className="vj-input"
                  rows={3}
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  maxLength={5000}
                  placeholder={t(
                    "explore.composerPlaceholder",
                    "Texto educativo ou profissional — sem dados de clientes ou processos sigilosos.",
                  )}
                />
                <div className="vj-inicio-filters">
                  <label className="vj-field">
                    <span className="vj-label">{t("explore.visibility", "Visibilidade")}</span>
                    <select
                      className="vj-input"
                      value={visibility}
                      onChange={(e) =>
                        setVisibility(e.target.value as "public" | "connections" | "draft")
                      }
                    >
                      <option value="public">{t("explore.vis.public", "Público")}</option>
                      <option value="connections">
                        {t("explore.vis.connections", "Conexões")}
                      </option>
                      <option value="draft">{t("explore.vis.draft", "Rascunho")}</option>
                    </select>
                  </label>
                  <label className="vj-field">
                    <span className="vj-label">{t("explore.category", "Categoria")}</span>
                    <input
                      className="vj-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="civil, trabalhista…"
                      maxLength={80}
                    />
                  </label>
                  <label className="vj-field">
                    <span className="vj-label">Hashtags</span>
                    <input
                      className="vj-input"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="#previdenciario #processo"
                      maxLength={400}
                    />
                  </label>
                </div>
                <div className="vj-feed-actions">
                  {authenticated ? (
                    <Button type="button" disabled={publishing} onClick={() => void onPublish()}>
                      {publishing
                        ? t("common.loading")
                        : t("explore.publish", "Publicar")}
                    </Button>
                  ) : (
                    <RequireAuthCta
                      actionLabel={t("explore.publish", "Publicar")}
                      message={t(
                        "explore.authPublish",
                        "Publicações reais exigem autenticação e são persistidas no banco.",
                      )}
                      redirectTo="/explorar"
                    />
                  )}
                  <span className="vj-meta">
                    {t(
                      "explore.composerHint",
                      "Nunca publique dados de clientes, CPF ou documentos internos.",
                    )}
                  </span>
                </div>
              </div>

              {tab === "feed" ? (
                <div className="vj-social-tabs" role="tablist" aria-label={t("explore.filters", "Filtros")}>
                  {(
                    [
                      ["recent", "Recentes"],
                      ["for_you", "Para você"],
                      ["following", "Seguindo"],
                      ["saved", "Salvos"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={mode === id}
                      className={mode === id ? "vj-social-tab is-active" : "vj-social-tab"}
                      onClick={() => setMode(id)}
                    >
                      {t(`explore.mode.${id}`, label)}
                    </button>
                  ))}
                </div>
              ) : null}

              {loading ? <LoadingState label={t("common.loading")} /> : null}

              {!loading && (tab === "trending" ? trending : posts).length === 0 ? (
                <div className="vj-card vj-stack">
                  <h2 className="vj-section-title">
                    {t("explore.empty", "Nenhuma publicação ainda")}
                  </h2>
                  <p>
                    {t(
                      "explore.emptyBody",
                      "Quando houver conteúdo público autorizado, ele aparecerá aqui. Use o lab demonstrativo para módulos operacionais fictícios.",
                    )}
                  </p>
                  <ButtonLink href="/explorar?view=painel" variant="secondary">
                    {t("explore.openLab", "Abrir lab")}
                  </ButtonLink>
                </div>
              ) : null}

              {(tab === "trending" ? trending : posts).map((post) => (
                <article key={post.id} className="vj-card vj-feed-post vj-social-post">
                  <header className="vj-feed-post-header">
                    <div className="vj-social-avatar" aria-hidden="true">
                      {initials(post.author.displayName)}
                    </div>
                    <div className="vj-stack" style={{ gap: "0.15rem", flex: 1 }}>
                      <strong>
                        {post.author.displayName}
                        {post.author.verified ? (
                          <>
                            {" "}
                            <BadgeCheck
                              size={16}
                              aria-label={t("explore.verified", "Verificado")}
                            />
                          </>
                        ) : null}
                      </strong>
                      <span className="vj-meta">
                        {post.author.headline ? `${post.author.headline} · ` : null}
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleString(locale)
                          : new Date(post.createdAt).toLocaleString(locale)}
                        {post.legalCategory ? ` · ${post.legalCategory}` : null}
                      </span>
                    </div>
                  </header>
                  <p className="vj-social-body">{post.body}</p>
                  {post.hashtags ? <p className="vj-meta">{post.hashtags}</p> : null}
                  {post.linkUrl ? (
                    <a href={post.linkUrl} rel="noopener noreferrer">
                      {post.linkUrl}
                    </a>
                  ) : null}
                  <p className="vj-meta">
                    {post.likeCount} curtidas · {post.commentCount} comentários ·{" "}
                    {post.repostCount} republicações
                  </p>
                  <div className="vj-feed-actions">
                    {authenticated ? (
                      <>
                        <Button
                          type="button"
                          className={
                            post.likedByMe ? "vj-button-secondary is-liked" : "vj-button-ghost"
                          }
                          onClick={() => void onLike(post.id)}
                        >
                          <Heart size={16} aria-hidden="true" />{" "}
                          {post.likedByMe
                            ? t("explore.liked", "Curtido")
                            : t("explore.like", "Curtir")}
                        </Button>
                        <Button
                          type="button"
                          className="vj-button-ghost"
                          onClick={() => void loadComments(post.id)}
                        >
                          <MessageCircle size={16} aria-hidden="true" />{" "}
                          {t("explore.comment", "Comentar")}
                        </Button>
                        <Button
                          type="button"
                          className="vj-button-ghost"
                          onClick={() => void onRepost(post.id)}
                        >
                          <Repeat2 size={16} aria-hidden="true" />{" "}
                          {t("explore.repost", "Republicar")}
                        </Button>
                        <Button
                          type="button"
                          className="vj-button-ghost"
                          onClick={() => void onShare(post)}
                        >
                          <Share2 size={16} aria-hidden="true" />{" "}
                          {t("explore.share", "Compartilhar")}
                        </Button>
                        <Button
                          type="button"
                          className="vj-button-ghost"
                          onClick={() => void onBookmark(post.id)}
                        >
                          <Bookmark size={16} aria-hidden="true" />{" "}
                          {post.bookmarkedByMe
                            ? t("explore.saved", "Salvo")
                            : t("explore.save", "Salvar")}
                        </Button>
                        <Button
                          type="button"
                          className="vj-button-ghost"
                          onClick={() => void onHide(post.id)}
                        >
                          {t("explore.hide", "Ocultar")}
                        </Button>
                        <Button
                          type="button"
                          className="vj-button-ghost"
                          onClick={() => void onReport(post.id)}
                        >
                          <Flag size={16} aria-hidden="true" />{" "}
                          {t("explore.report", "Denunciar")}
                        </Button>
                        {meId === post.author.userId ? (
                          <Button
                            type="button"
                            className="vj-button-ghost"
                            onClick={() => void onDelete(post.id)}
                          >
                            {t("explore.delete", "Excluir")}
                          </Button>
                        ) : null}
                      </>
                    ) : (
                      <RequireAuthCta
                        actionLabel={t("explore.interact", "Interagir")}
                        message={t(
                          "explore.authInteract",
                          "Curtir, comentar e salvar exigem autenticação.",
                        )}
                        redirectTo="/explorar"
                        variant="ghost"
                      />
                    )}
                  </div>
                  {openComments === post.id ? (
                    <div className="vj-social-comments vj-stack">
                      {comments.map((c) => (
                        <div key={c.id} className="vj-demo-panel">
                          <strong>{c.author.displayName}</strong>
                          <p>{c.body}</p>
                        </div>
                      ))}
                      {authenticated ? (
                        <form
                          className="vj-inline-actions"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void sendComment(post.id);
                          }}
                        >
                          <input
                            className="vj-input"
                            value={commentDraft}
                            onChange={(e) => setCommentDraft(e.target.value)}
                            placeholder={t("explore.writeComment", "Escreva um comentário")}
                            maxLength={2000}
                            required
                          />
                          <Button type="submit">{t("explore.send", "Enviar")}</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </>
          ) : null}

          {tab === "connections" ? (
            <div className="vj-card vj-stack">
              <h2 className="vj-section-title">{t("explore.connections", "Conexões")}</h2>
              {!authenticated ? (
                <RequireAuthCta
                  actionLabel={t("explore.signInConnections", "Entrar para conectar")}
                  message={t(
                    "explore.authConnections",
                    "Seguir e solicitar conexão exigem autenticação.",
                  )}
                  redirectTo="/explorar"
                />
              ) : people.length === 0 ? (
                <p className="vj-meta">
                  {t("explore.noPeople", "Nenhuma sugestão disponível no momento.")}
                </p>
              ) : (
                <ul className="vj-stack">
                  {people.map((person) => (
                    <li key={person.userId} className="vj-demo-panel vj-inline-actions">
                      <div>
                        <strong>{person.displayName}</strong>
                        <p className="vj-meta">
                          {person.headline ?? person.practiceAreas ?? person.locationLabel ?? "—"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="vj-button-secondary"
                        onClick={() => void onFollow(person.userId)}
                      >
                        {person.following
                          ? t("explore.following", "Seguindo")
                          : t("explore.follow", "Seguir")}
                      </Button>
                      <Button
                        type="button"
                        className="vj-button-ghost"
                        onClick={() => void onConnect(person.userId)}
                      >
                        {t("explore.connect", "Conectar")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "notifications" ? (
            <div className="vj-card vj-stack">
              <div className="vj-inline-actions">
                <h2 className="vj-section-title">{t("explore.notifications", "Notificações")}</h2>
                {authenticated ? (
                  <Button
                    type="button"
                    className="vj-button-secondary"
                    onClick={() => void markAllSocialNotificationsRead().then(() => refreshSide())}
                  >
                    {t("explore.markRead", "Marcar todas como lidas")}
                  </Button>
                ) : null}
              </div>
              {!authenticated ? (
                <RequireAuthCta
                  actionLabel={t("nav.login")}
                  message={t("explore.authNotifications", "Notificações exigem autenticação.")}
                  redirectTo="/explorar"
                />
              ) : notifications.length === 0 ? (
                <p className="vj-meta">{t("explore.noNotifications", "Sem notificações.")}</p>
              ) : (
                <ul className="vj-stack">
                  {notifications.map((n) => (
                    <li key={n.id} className="vj-demo-panel">
                      <strong>{n.type}</strong>
                      <p>{n.body}</p>
                      <span className="vj-meta">
                        {new Date(n.createdAt).toLocaleString(locale)}
                        {n.readAt ? "" : ` · ${t("explore.unread", "não lida")}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "profile" ? (
            <div className="vj-card vj-stack">
              <h2 className="vj-section-title">{t("explore.myProfile", "Meu perfil")}</h2>
              {!authenticated ? (
                <RequireAuthCta
                  actionLabel={t("nav.login")}
                  message={t("explore.authProfile", "Editar perfil exige autenticação.")}
                  redirectTo="/explorar"
                />
              ) : (
                <>
                  <p>
                    <strong>{meName}</strong>
                  </p>
                  <label className="vj-field">
                    <span className="vj-label">{t("explore.headline", "Headline")}</span>
                    <input
                      className="vj-input"
                      value={headlineDraft}
                      onChange={(e) => setHeadlineDraft(e.target.value)}
                      maxLength={160}
                    />
                  </label>
                  <label className="vj-field">
                    <span className="vj-label">{t("explore.bio", "Biografia")}</span>
                    <textarea
                      className="vj-input"
                      rows={4}
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      maxLength={1000}
                    />
                  </label>
                  <Button
                    type="button"
                    onClick={() => {
                      void import("../lib/social").then(async ({ patchSocialMe }) => {
                        const result = await patchSocialMe({
                          bio: bioDraft,
                          headline: headlineDraft,
                        });
                        if (isApiFailure(result)) setError(socialErrorMessage(result));
                        else setStatus(t("explore.profileSaved", "Perfil atualizado."));
                      });
                    }}
                  >
                    {t("explore.saveProfile", "Salvar perfil social")}
                  </Button>
                  <p className="vj-hint">
                    {t(
                      "explore.profilePrivacyHint",
                      "Senha, MFA, sessões e exportação LGPD ficam em Conta. Este painel não exibe CPF nem endereço.",
                    )}
                  </p>
                  <ButtonLink href="/app/conta" variant="secondary">
                    {t("explore.openAccount", "Abrir configurações de conta")}
                  </ButtonLink>
                  <ButtonLink href="/app/comunicacao" variant="ghost">
                    {t("explore.messages", "Mensagens")}
                  </ButtonLink>
                </>
              )}
            </div>
          ) : null}
        </section>

        <aside className="vj-feed-column vj-social-rail" aria-label={t("explore.suggestions", "Sugestões")}>
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">{t("explore.topics", "Temas")}</h2>
            <div className="vj-feed-suggestions">
              {FEED_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className="vj-badge"
                  onClick={() => {
                    setCategory(topic.toLowerCase());
                    setTab("feed");
                  }}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">{t("explore.trendingShort", "Em alta")}</h2>
            {trending.slice(0, 5).map((p) => (
              <button
                key={p.id}
                type="button"
                className="vj-social-nav-item"
                onClick={() => {
                  setTab("trending");
                }}
              >
                {p.body.slice(0, 72)}
                {p.body.length > 72 ? "…" : ""}
              </button>
            ))}
            {trending.length === 0 ? (
              <p className="vj-meta">{FEED_DEMO_BANNER}</p>
            ) : null}
          </div>
          <div className="vj-card vj-stack">
            <h2 className="vj-section-title">Marketplace</h2>
            <ButtonLink href="/app" variant="secondary">
              {t("explore.marketplaceHub", "Abrir hub Início")}
            </ButtonLink>
            <ButtonLink href="/marketplace-juridico" variant="ghost">
              {t("explore.marketplacePublic", "Página pública")}
            </ButtonLink>
          </div>
        </aside>
      </div>

      <nav className="vj-social-mobile-nav" aria-label={t("explore.mobileNav", "Navegação móvel")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
