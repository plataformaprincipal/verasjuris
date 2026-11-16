import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call, registerVerified } from "./test-helpers.js";

async function sessionUserId(app: FastifyInstance, cookie: string) {
  const res = await call(app, "GET", "/v1/auth/session", undefined, cookie);
  expect(res.statusCode).toBe(200);
  return res.json<{ account: { user: { id: string } } }>().account.user.id;
}

describe("Rede social jurídica API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let userA: string;
  let userB: string;
  let cookieA: string;
  let cookieB: string;
  let postId: string;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    s = await bootstrapEtapa6(app, email, "social");
    cookieA = s.ownerA;
    cookieB = s.memberA;
    userA = await sessionUserId(app, cookieA);
    userB = await sessionUserId(app, cookieB);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (database) await database.close();
  });

  it("cria post e aparece no feed público", async () => {
    const created = await call(
      app,
      "POST",
      "/v1/social/posts",
      {
        body: "Primeira publicação jurídica da rede social.",
        visibility: "public",
        status: "published",
        legalCategory: "civil",
      },
      cookieA,
    );
    expect(created.statusCode).toBe(201);
    const post = created.json<{ post: { id: string; likeCount: number; status: string } }>().post;
    expect(post.status).toBe("published");
    expect(post.likeCount).toBe(0);
    postId = post.id;

    const feedAnon = await call(app, "GET", "/v1/social/feed?mode=recent");
    expect(feedAnon.statusCode).toBe(200);
    const items = feedAnon.json<{ items: Array<{ id: string }> }>().items;
    expect(items.some((item) => item.id === postId)).toBe(true);
  });

  it("toggle like respeita unicidade e ajusta contagem", async () => {
    const like1 = await call(app, "POST", `/v1/social/posts/${postId}/likes`, {}, cookieB);
    expect(like1.statusCode).toBe(200);
    expect(like1.json<{ liked: boolean; post: { likeCount: number } }>().liked).toBe(true);
    expect(like1.json<{ post: { likeCount: number } }>().post.likeCount).toBe(1);

    const like2 = await call(app, "POST", `/v1/social/posts/${postId}/likes`, {}, cookieB);
    expect(like2.statusCode).toBe(200);
    expect(like2.json<{ liked: boolean; post: { likeCount: number } }>().liked).toBe(false);
    expect(like2.json<{ post: { likeCount: number } }>().post.likeCount).toBe(0);

    const like3 = await call(app, "POST", `/v1/social/posts/${postId}/likes`, {}, cookieB);
    expect(like3.json<{ liked: boolean; post: { likeCount: number } }>().liked).toBe(true);
    expect(like3.json<{ post: { likeCount: number } }>().post.likeCount).toBe(1);
  });

  it("comentário e limite de profundidade de resposta", async () => {
    const comment = await call(
      app,
      "POST",
      `/v1/social/posts/${postId}/comments`,
      { body: "Comentário de primeiro nível." },
      cookieB,
    );
    expect(comment.statusCode).toBe(201);
    const commentId = comment.json<{ comment: { id: string } }>().comment.id;

    const reply = await call(
      app,
      "POST",
      `/v1/social/posts/${postId}/comments`,
      { body: "Resposta válida.", parentCommentId: commentId },
      cookieA,
    );
    expect(reply.statusCode).toBe(201);
    const replyId = reply.json<{ comment: { id: string } }>().comment.id;

    const nested = await call(
      app,
      "POST",
      `/v1/social/posts/${postId}/comments`,
      { body: "Resposta encadeada inválida.", parentCommentId: replyId },
      cookieB,
    );
    expect(nested.statusCode).toBe(400);
  });

  it("não permite editar post de outro (403)", async () => {
    const res = await call(
      app,
      "PATCH",
      `/v1/social/posts/${postId}`,
      { body: "Tentativa indevida de edição." },
      cookieB,
    );
    expect([403, 404]).toContain(res.statusCode);
  });

  it("soft delete remove do feed", async () => {
    const soft = await call(
      app,
      "POST",
      "/v1/social/posts",
      { body: "Post temporário para exclusão.", status: "published" },
      cookieA,
    );
    const tempId = soft.json<{ post: { id: string } }>().post.id;

    const deleted = await call(app, "DELETE", `/v1/social/posts/${tempId}`, undefined, cookieA);
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json<{ post: { status: string; deletedAt: string | null } }>().post.status).toBe(
      "removed",
    );
    expect(deleted.json<{ post: { deletedAt: string | null } }>().post.deletedAt).toBeTruthy();

    const feed = await call(app, "GET", "/v1/social/feed?mode=recent", undefined, cookieA);
    const ids = feed.json<{ items: Array<{ id: string }> }>().items.map((i) => i.id);
    expect(ids).not.toContain(tempId);
  });

  it("follow e unfollow", async () => {
    const follow = await call(app, "POST", `/v1/social/users/${userA}/follow`, {}, cookieB);
    expect(follow.statusCode).toBe(200);
    expect(follow.json<{ following: boolean }>().following).toBe(true);

    const followers = await call(app, "GET", `/v1/social/users/${userA}/followers`, undefined, cookieA);
    expect(followers.statusCode).toBe(200);
    expect(
      followers
        .json<{ items: Array<{ followerUserId: string }> }>()
        .items.some((i) => i.followerUserId === userB),
    ).toBe(true);

    const unfollow = await call(app, "DELETE", `/v1/social/users/${userA}/follow`, undefined, cookieB);
    expect(unfollow.json<{ following: boolean }>().following).toBe(false);

    // re-follow for following feed coverage
    await call(app, "POST", `/v1/social/users/${userA}/follow`, {}, cookieB);
  });

  it("pedido de conexão e aceite", async () => {
    const outsider = await registerVerified(app, email, {
      displayName: "Social Outsider",
      email: "social.outsider@exemplo.com",
    });
    const outsiderId = await sessionUserId(app, outsider);

    const requested = await call(
      app,
      "POST",
      "/v1/social/connections/requests",
      { userId: outsiderId },
      cookieA,
    );
    expect(requested.statusCode).toBe(201);
    const connectionId = requested.json<{ connection: { id: string; status: string } }>().connection
      .id;
    expect(requested.json<{ connection: { status: string } }>().connection.status).toBe("pending");

    const accepted = await call(
      app,
      "POST",
      `/v1/social/connections/requests/${connectionId}/accept`,
      {},
      outsider,
    );
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<{ connection: { status: string } }>().connection.status).toBe("accepted");
  });

  it("reporta publicação", async () => {
    const report = await call(
      app,
      "POST",
      `/v1/social/posts/${postId}/reports`,
      { reasonCode: "spam", description: "Conteúdo suspeito de spam repetido." },
      cookieB,
    );
    expect(report.statusCode).toBe(201);
    expect(report.json<{ report: { status: string; postId: string } }>().report.status).toBe("open");
    expect(report.json<{ report: { postId: string } }>().report.postId).toBe(postId);
  });

  it("bookmark toggle e feed saved", async () => {
    const book = await call(app, "POST", `/v1/social/posts/${postId}/bookmarks`, {}, cookieB);
    expect(book.statusCode).toBe(200);
    expect(book.json<{ bookmarked: boolean; post: { bookmarkCount: number } }>().bookmarked).toBe(
      true,
    );
    expect(book.json<{ post: { bookmarkCount: number } }>().post.bookmarkCount).toBe(1);

    const saved = await call(app, "GET", "/v1/social/feed?mode=saved", undefined, cookieB);
    expect(saved.statusCode).toBe(200);
    expect(
      saved.json<{ items: Array<{ id: string }> }>().items.some((i) => i.id === postId),
    ).toBe(true);
  });

  it("trending retorna itens após interações", async () => {
    await call(app, "POST", `/v1/social/posts/${postId}/reposts`, {}, cookieB);

    const trending = await call(app, "GET", "/v1/social/trending?window=7d");
    expect(trending.statusCode).toBe(200);
    const items = trending.json<{ items: Array<{ id: string; score7d: number }> }>().items;
    expect(items.length).toBeGreaterThan(0);
    const found = items.find((i) => i.id === postId);
    expect(found).toBeTruthy();
    expect((found?.score7d ?? 0) > 0).toBe(true);
  });
});
