"use client";

/** Mirrors lib/auth.ts exactly, but for the storefront customer identity — kept in a separate sessionStorage key so a staff session and a customer session can coexist in the same browser without clobbering each other. */

const STORAGE_KEY = "saas.customerAccessToken";

let customerAccessToken: string | null = null;

export function getCustomerAccessToken(): string | null {
  if (customerAccessToken) return customerAccessToken;
  if (typeof window !== "undefined") {
    customerAccessToken = sessionStorage.getItem(STORAGE_KEY);
  }
  return customerAccessToken;
}

export function setCustomerAccessToken(token: string): void {
  customerAccessToken = token;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, token);
  }
}

export function clearCustomerAccessToken(): void {
  customerAccessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}
