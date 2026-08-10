"use client";

import type { ErrorEnvelope } from "@saas/shared-types";
import { getAccessToken, setAccessToken, clearAccessToken } from "./auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: unknown[],
  ) {
    super(message);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

/** POST /auth/refresh — the httpOnly cookie is sent automatically (credentials: 'include'). */
async function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuthRetry?: boolean; // avoid infinite loops on the refresh endpoint itself
}

/**
 * Thin fetch wrapper — attaches the access token, retries once via silent
 * refresh on 401 (typical "access token just expired mid-session" case),
 * and normalizes errors into ApiError using the API's
 * `{ error: { code, message, details } }` envelope (06-api-specification.md).
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // Captured once, at the moment THIS call started — not re-read after
  // awaits. A request issued right before logout/login can still be
  // in-flight when a *subsequent* call already rotated in a new token (React
  // Query's background refetching + fast client-side navigation makes this
  // easy to hit, not just a theoretical race). Without this, the stale
  // request's 401 handling below would call clearAccessToken() and wipe out
  // a perfectly valid newer token it has no knowledge of.
  const tokenAtCallStart = getAccessToken();

  const doFetch = async (): Promise<Response> => {
    const token = getAccessToken();
    return fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await doFetch();
    } else if (getAccessToken() === tokenAtCallStart) {
      // Only clear if nothing else has already rotated in a newer token
      // since this call started — see the comment above.
      clearAccessToken();
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => undefined);

  if (!res.ok) {
    const envelope = data as ErrorEnvelope | undefined;
    throw new ApiError(
      envelope?.error?.code ?? "UNKNOWN_ERROR",
      envelope?.error?.message ?? res.statusText,
      res.status,
      envelope?.error?.details,
    );
  }

  return data as T;
}

/**
 * `apiFetch` always calls `res.json()` — incompatible with the CSV/PDF
 * blobs `/analytics/export` returns. This sibling does the same auth-header
 * plumbing but resolves a Blob and click-triggers a browser download. No
 * existing precedent to reuse (ProductsService#bulkExport was never wired
 * to a frontend button before this).
 */
export async function downloadReport(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => undefined);
    const envelope = data as ErrorEnvelope | undefined;
    throw new ApiError(
      envelope?.error?.code ?? "UNKNOWN_ERROR",
      envelope?.error?.message ?? res.statusText,
      res.status,
      envelope?.error?.details,
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
