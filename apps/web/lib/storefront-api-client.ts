"use client";

import type { ErrorEnvelope } from "@saas/shared-types";
import { getCustomerAccessToken, setCustomerAccessToken, clearCustomerAccessToken } from "./customer-auth";
import { ApiError } from "./api-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

let refreshInFlight: Promise<boolean> | null = null;

async function attemptCustomerRefresh(subdomain: string): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_BASE_URL}/customers/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Tenant-Subdomain": subdomain },
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setCustomerAccessToken(data.accessToken);
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
  auth?: boolean; // attach the customer access token (vs. a purely public browse call)
  skipAuthRetry?: boolean;
}

/**
 * Public storefront browsing + customer-authenticated calls share this one
 * client — every call carries `X-Tenant-Subdomain` (the dev-shaped tenant
 * resolution this whole codebase uses locally; see proxy.ts's comment on
 * the production Host-header equivalent being deferred). `auth: true` layers
 * the customer access token + silent-refresh-on-401 on top, same shape as
 * lib/api-client.ts's staff equivalent but against /customers/refresh and a
 * completely separate token store.
 */
export async function storefrontFetch<T>(subdomain: string, path: string, options: RequestOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const token = options.auth ? getCustomerAccessToken() : null;
    return fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Subdomain": subdomain,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && options.auth && !options.skipAuthRetry) {
    const refreshed = await attemptCustomerRefresh(subdomain);
    if (refreshed) {
      res = await doFetch();
    } else {
      clearCustomerAccessToken();
    }
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => undefined);

  if (!res.ok) {
    const envelope = data as ErrorEnvelope | undefined;
    throw new ApiError(envelope?.error?.code ?? "UNKNOWN_ERROR", envelope?.error?.message ?? res.statusText, res.status, envelope?.error?.details);
  }

  return data as T;
}
