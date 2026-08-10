"use client";

/**
 * Access-token storage. The refresh token never touches JS at all — it's an
 * httpOnly cookie set by the API (apps/api/src/modules/auth/auth.controller.ts),
 * scoped to `/api/v1/auth`, sent automatically by the browser. The access
 * token is short-lived (15 min default — JWT_ACCESS_TTL) so the exposure
 * window from living in JS-reachable storage is small; it's kept in a module
 * variable for the common case and mirrored to sessionStorage purely so a
 * page reload doesn't force an immediate silent-refresh round trip.
 */

const STORAGE_KEY = "saas.accessToken";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = sessionStorage.getItem(STORAGE_KEY);
  }
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, token);
  }
}

export function clearAccessToken(): void {
  accessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
