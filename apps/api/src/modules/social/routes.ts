import {
  createSocialCommentSchema,
  createSocialPostSchema,
  createSocialReportSchema,
  parseInput,
  patchSocialProfileSchema,
  socialFeedQuerySchema,
  socialNotificationsQuerySchema,
  socialSearchPeopleSchema,
  socialTrendingQuerySchema,
  updateSocialCommentSchema,
  updateSocialPostSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { meta, readAccount, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  blockUser,
  createComment,
  createPost,
  createRepost,
  deleteComment,
  deletePost,
  followUser,
  getFeed,
  getOrCreateMySocialProfile,
  getPost,
  getPublicProfile,
  getTrending,
  hidePost,
  listComments,
  listConnections,
  listFollowers,
  listFollowing,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  patchMySocialProfile,
  removeConnection,
  reportPost,
  requestConnection,
  respondConnection,
  searchPeople,
  toggleBookmark,
  toggleLike,
  unfollowUser,
  updateComment,
  updatePost,
  type SocialModuleDeps,
} from "./service.js";

type Params = {
  postId?: string;
  commentId?: string;
  userId?: string;
  id?: string;
};

function socialDeps(deps: ApiDeps): SocialModuleDeps {
  return { rateLimiter: deps.rateLimiter };
}

/** Sessão opcional para feeds/perfis públicos. */
async function optionalAccount(deps: ApiDeps, request: FastifyRequest) {
  try {
    return await readAccount(deps, request);
  } catch {
    return null;
  }
}

export async function registerSocialRoutes(app: FastifyInstance, deps: ApiDeps) {
  const moduleDeps = () => socialDeps(deps);

  app.get("/social/feed", async (request) => {
    const account = await optionalAccount(deps, request);
    const query = parseInput(socialFeedQuerySchema, request.query ?? {});
    return getFeed(deps.db, account, query);
  });

  app.get("/social/trending", async (request) => {
    const account = await optionalAccount(deps, request);
    const query = parseInput(socialTrendingQuerySchema, request.query ?? {});
    return getTrending(deps.db, account, query);
  });

  app.get("/social/posts/:postId", async (request) => {
    const account = await optionalAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    return getPost(deps.db, account, postId);
  });

  app.post("/social/posts", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createSocialPostSchema, request.body ?? {});
    const result = await createPost(deps.db, account, body, meta(request), moduleDeps());
    return reply.status(201).send(result);
  });

  app.patch("/social/posts/:postId", async (request) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    const body = parseInput(updateSocialPostSchema, request.body ?? {});
    return updatePost(deps.db, account, postId, body, meta(request));
  });

  app.delete("/social/posts/:postId", async (request) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    return deletePost(deps.db, account, postId, meta(request));
  });

  app.post("/social/posts/:postId/likes", async (request) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    return toggleLike(deps.db, account, postId, meta(request));
  });

  app.post("/social/posts/:postId/comments", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    const body = parseInput(createSocialCommentSchema, request.body ?? {});
    const result = await createComment(
      deps.db,
      account,
      postId,
      body,
      meta(request),
      moduleDeps(),
    );
    return reply.status(201).send(result);
  });

  app.get("/social/posts/:postId/comments", async (request) => {
    const account = await optionalAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    return listComments(deps.db, account, postId);
  });

  app.patch("/social/comments/:commentId", async (request) => {
    const account = await requireAccount(deps, request);
    const commentId = parseInput(uuidSchema, (request.params as Params).commentId);
    const body = parseInput(updateSocialCommentSchema, request.body ?? {});
    return updateComment(deps.db, account, commentId, body, meta(request));
  });

  app.delete("/social/comments/:commentId", async (request) => {
    const account = await requireAccount(deps, request);
    const commentId = parseInput(uuidSchema, (request.params as Params).commentId);
    return deleteComment(deps.db, account, commentId, meta(request));
  });

  app.post("/social/posts/:postId/reposts", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    const body = (request.body ?? {}) as { commentary?: string };
    const result = await createRepost(
      deps.db,
      account,
      postId,
      { commentary: typeof body.commentary === "string" ? body.commentary : undefined },
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post("/social/posts/:postId/bookmarks", async (request) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    return toggleBookmark(deps.db, account, postId, meta(request));
  });

  app.post("/social/posts/:postId/hide", async (request) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    return hidePost(deps.db, account, postId, meta(request));
  });

  app.post("/social/posts/:postId/reports", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const postId = parseInput(uuidSchema, (request.params as Params).postId);
    const body = parseInput(createSocialReportSchema, request.body ?? {});
    const result = await reportPost(deps.db, account, postId, body, meta(request));
    return reply.status(201).send(result);
  });

  app.get("/social/users/:userId", async (request) => {
    const account = await optionalAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as Params).userId);
    return getPublicProfile(deps.db, account, userId);
  });

  app.post("/social/users/:userId/follow", async (request) => {
    const account = await requireAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as Params).userId);
    return followUser(deps.db, account, userId, meta(request));
  });

  app.delete("/social/users/:userId/follow", async (request) => {
    const account = await requireAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as Params).userId);
    return unfollowUser(deps.db, account, userId, meta(request));
  });

  app.get("/social/users/:userId/followers", async (request) => {
    const account = await optionalAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as Params).userId);
    return listFollowers(deps.db, account, userId);
  });

  app.get("/social/users/:userId/following", async (request) => {
    const account = await optionalAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as Params).userId);
    return listFollowing(deps.db, account, userId);
  });

  app.get("/social/people", async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(socialSearchPeopleSchema, request.query ?? {});
    return searchPeople(deps.db, account, query);
  });

  app.get("/social/connections", async (request) => {
    const account = await requireAccount(deps, request);
    return listConnections(deps.db, account);
  });

  app.post("/social/connections/requests", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = request.body as { userId?: string };
    const userId = parseInput(uuidSchema, body?.userId);
    const result = await requestConnection(deps.db, account, userId, meta(request));
    return reply.status(201).send(result);
  });

  app.post("/social/connections/requests/:id/accept", async (request) => {
    const account = await requireAccount(deps, request);
    const id = parseInput(uuidSchema, (request.params as Params).id);
    return respondConnection(deps.db, account, id, "accept", meta(request));
  });

  app.post("/social/connections/requests/:id/decline", async (request) => {
    const account = await requireAccount(deps, request);
    const id = parseInput(uuidSchema, (request.params as Params).id);
    return respondConnection(deps.db, account, id, "decline", meta(request));
  });

  app.delete("/social/connections/:id", async (request) => {
    const account = await requireAccount(deps, request);
    const id = parseInput(uuidSchema, (request.params as Params).id);
    return removeConnection(deps.db, account, id, meta(request));
  });

  app.post("/social/users/:userId/block", async (request) => {
    const account = await requireAccount(deps, request);
    const userId = parseInput(uuidSchema, (request.params as Params).userId);
    return blockUser(deps.db, account, userId, meta(request));
  });

  app.get("/social/me", async (request) => {
    const account = await requireAccount(deps, request);
    return getOrCreateMySocialProfile(deps.db, account);
  });

  app.patch("/social/me", async (request) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(patchSocialProfileSchema, request.body ?? {});
    return patchMySocialProfile(deps.db, account, body, meta(request));
  });

  app.get("/social/notifications", async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(socialNotificationsQuerySchema, request.query ?? {});
    return listNotifications(deps.db, account, query);
  });

  app.post("/social/notifications/read-all", async (request) => {
    const account = await requireAccount(deps, request);
    return markAllNotificationsRead(deps.db, account);
  });

  app.post("/social/notifications/:id/read", async (request) => {
    const account = await requireAccount(deps, request);
    const id = parseInput(uuidSchema, (request.params as Params).id);
    return markNotificationRead(deps.db, account, id);
  });
}
