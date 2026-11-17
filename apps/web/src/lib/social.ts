import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, isApiFailure } from "./ai";

export { isApiFailure, aiErrorMessage };

export type SocialAuthor = {
  userId: string;
  displayName: string;
  headline?: string | null;
  verified?: boolean;
  avatarUrl?: string | null;
};

export type SocialPost = {
  id: string;
  body: string;
  visibility: string;
  status: string;
  legalCategory?: string | null;
  hashtags?: string | null;
  linkUrl?: string | null;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  bookmarkCount: number;
  publishedAt?: string | null;
  createdAt: string;
  author: SocialAuthor;
  likedByMe?: boolean;
  bookmarkedByMe?: boolean;
  repostedByMe?: boolean;
};

export type SocialComment = {
  id: string;
  postId: string;
  body: string;
  parentCommentId?: string | null;
  createdAt: string;
  author: SocialAuthor;
};

export type SocialNotification = {
  id: string;
  type: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  postId?: string | null;
};

export type SocialPerson = {
  userId: string;
  displayName: string;
  headline?: string | null;
  practiceAreas?: string | null;
  locationLabel?: string | null;
  verified?: boolean;
  following?: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      credentials: "include",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code:
          body.error?.code ?? (response.status === 401 ? "AUTHENTICATION_ERROR" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function socialErrorMessage(failure: AiApiFailure): string {
  return aiErrorMessage(failure, "Falha na rede social.");
}

export async function fetchSocialFeed(query: {
  mode?: string;
  legalCategory?: string;
  cursor?: string;
  limit?: number;
}) {
  return request<{ items: SocialPost[]; nextCursor: string | null }>(
    `/api/v1/social/feed${qs(query)}`,
  );
}

export async function fetchSocialTrending(window: string = "7d") {
  return request<{ items: SocialPost[] }>(`/api/v1/social/trending${qs({ window, limit: 10 })}`);
}

export async function createSocialPost(body: Record<string, unknown>) {
  return request<{ post: SocialPost }>("/api/v1/social/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSocialPost(postId: string, body: Record<string, unknown>) {
  return request<{ post: SocialPost }>(`/api/v1/social/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteSocialPost(postId: string) {
  return request<{ ok: true }>(`/api/v1/social/posts/${postId}`, { method: "DELETE" });
}

export async function toggleSocialLike(postId: string) {
  return request<{ liked: boolean; post: SocialPost }>(`/api/v1/social/posts/${postId}/likes`, {
    method: "POST",
    body: "{}",
  });
}

export async function toggleSocialBookmark(postId: string) {
  return request<{ bookmarked: boolean; post: SocialPost }>(
    `/api/v1/social/posts/${postId}/bookmarks`,
    { method: "POST", body: "{}" },
  );
}

export async function createSocialRepost(postId: string, commentary?: string) {
  return request<{ reposted: boolean; post: SocialPost }>(
    `/api/v1/social/posts/${postId}/reposts`,
    { method: "POST", body: JSON.stringify({ commentary }) },
  );
}

export async function hideSocialPost(postId: string) {
  return request<{ ok: true }>(`/api/v1/social/posts/${postId}/hide`, {
    method: "POST",
    body: "{}",
  });
}

export async function reportSocialPost(
  postId: string,
  body: { reasonCode: string; description?: string },
) {
  return request<{ report: { id: string } }>(`/api/v1/social/posts/${postId}/reports`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchSocialComments(postId: string) {
  return request<{ items: SocialComment[] }>(`/api/v1/social/posts/${postId}/comments`);
}

export async function createSocialComment(
  postId: string,
  body: { body: string; parentCommentId?: string },
) {
  return request<{ comment: SocialComment }>(`/api/v1/social/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchSocialMe() {
  return request<{
    profile: Record<string, unknown>;
    author: SocialAuthor;
  }>("/api/v1/social/me");
}

export async function patchSocialMe(body: Record<string, unknown>) {
  return request<{ profile: Record<string, unknown> }>("/api/v1/social/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchSocialPeople(q?: string) {
  return request<{ items: SocialPerson[] }>(`/api/v1/social/people${qs({ q, limit: 20 })}`);
}

export async function followSocialUser(userId: string) {
  return request<{ following: boolean }>(`/api/v1/social/users/${userId}/follow`, {
    method: "POST",
    body: "{}",
  });
}

export async function unfollowSocialUser(userId: string) {
  return request<{ following: boolean }>(`/api/v1/social/users/${userId}/follow`, {
    method: "DELETE",
  });
}

export async function requestSocialConnection(userId: string) {
  return request<{ connection: { id: string; status: string } }>(
    "/api/v1/social/connections/requests",
    { method: "POST", body: JSON.stringify({ userId }) },
  );
}

export async function fetchSocialNotifications() {
  return request<{ items: SocialNotification[] }>("/api/v1/social/notifications");
}

export async function markAllSocialNotificationsRead() {
  return request<{ ok: true }>("/api/v1/social/notifications/read-all", {
    method: "POST",
    body: "{}",
  });
}

export async function fetchAuthSession() {
  return request<{
    account: { user: { id: string; displayName: string; email: string } };
  }>("/api/v1/auth/session");
}
