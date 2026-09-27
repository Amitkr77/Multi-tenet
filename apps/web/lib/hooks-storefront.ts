"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomerRegisterDto,
  CustomerLoginDto,
  CustomerSelfUpdateDto,
  CreateAddressDto,
  UpdateAddressDto,
  AddCartItemDto,
  UpdateCartItemDto,
  CheckoutRequestDto,
  CreateReviewDto,
} from "@saas/shared-types";
import { storefrontFetch } from "./storefront-api-client";
import { setCustomerAccessToken, clearCustomerAccessToken } from "./customer-auth";

export function useStorefrontTenant(subdomain: string) {
  return useQuery({
    queryKey: ["storefront-tenant", subdomain],
    queryFn: () => storefrontFetch<{ name: string; currency: string }>(subdomain, "/storefront/info"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStorefrontProducts(
  subdomain: string,
  params?: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
  },
) {
  return useQuery({
    queryKey: ["storefront-products", subdomain, params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.categoryId) qs.set("categoryId", params.categoryId);
      if (params?.brandId) qs.set("brandId", params.brandId);
      if (params?.sort) qs.set("sort", params.sort);
      if (params?.minPrice !== undefined) qs.set("minPrice", String(params.minPrice));
      if (params?.maxPrice !== undefined) qs.set("maxPrice", String(params.maxPrice));
      const q = qs.toString();
      return storefrontFetch<any[]>(subdomain, `/storefront/products${q ? `?${q}` : ""}`);
    },
  });
}

export function useStorefrontCategories(subdomain: string) {
  return useQuery({
    queryKey: ["storefront-categories", subdomain],
    queryFn: () => storefrontFetch<any[]>(subdomain, "/storefront/categories"),
  });
}

export function useStorefrontProduct(subdomain: string, slug: string) {
  return useQuery({
    queryKey: ["storefront-products", subdomain, slug],
    queryFn: () => storefrontFetch<any>(subdomain, `/storefront/products/${slug}`),
  });
}

export function useCustomerRegister(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CustomerRegisterDto) =>
      storefrontFetch<{ tokens: { accessToken: string } }>(subdomain, "/customers/register", {
        method: "POST",
        body: dto,
        skipAuthRetry: true,
      }),
    onSuccess: (data) => {
      setCustomerAccessToken(data.tokens.accessToken);
      queryClient.invalidateQueries({ queryKey: ["customer-me", subdomain] });
    },
  });
}

export function useCustomerLogin(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CustomerLoginDto) =>
      storefrontFetch<{ tokens: { accessToken: string } }>(subdomain, "/customers/login", {
        method: "POST",
        body: dto,
        skipAuthRetry: true,
      }),
    onSuccess: (data) => {
      setCustomerAccessToken(data.tokens.accessToken);
      queryClient.invalidateQueries({ queryKey: ["customer-me", subdomain] });
    },
  });
}

export function useCustomerLogout(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => storefrontFetch<void>(subdomain, "/customers/logout", { method: "POST" }),
    onSettled: () => {
      clearCustomerAccessToken();
      queryClient.invalidateQueries({ queryKey: ["customer-me", subdomain] });
    },
  });
}

export function useUpdateMe(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CustomerSelfUpdateDto) =>
      storefrontFetch<any>(subdomain, "/customers/me", { method: "PATCH", body: dto, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-me", subdomain] }),
  });
}

export function useCustomerMe(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: ["customer-me", subdomain],
    queryFn: () => storefrontFetch<any>(subdomain, "/customers/me", { auth: true }),
    enabled,
    retry: false,
  });
}

// --- Cart ---

export function useCart(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: ["cart", subdomain],
    queryFn: () => storefrontFetch<any>(subdomain, "/cart", { auth: true }),
    enabled,
  });
}

export function useAddCartItem(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: AddCartItemDto) =>
      storefrontFetch<any>(subdomain, "/cart/items", { method: "POST", body: dto, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart", subdomain] }),
  });
}

export function useUpdateCartItem(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, dto }: { itemId: string; dto: UpdateCartItemDto }) =>
      storefrontFetch<any>(subdomain, `/cart/items/${itemId}`, { method: "PATCH", body: dto, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart", subdomain] }),
  });
}

export function useRemoveCartItem(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      storefrontFetch<any>(subdomain, `/cart/items/${itemId}`, { method: "DELETE", auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart", subdomain] }),
  });
}

// --- Checkout ---

export function useCheckoutQuote(subdomain: string) {
  return useMutation({
    mutationFn: (dto: CheckoutRequestDto) =>
      storefrontFetch<any>(subdomain, "/checkout/quote", { method: "POST", body: dto, auth: true }),
  });
}

export function useCheckoutComplete(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CheckoutRequestDto) =>
      storefrontFetch<any>(subdomain, "/checkout/complete", { method: "POST", body: dto, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart", subdomain] }),
  });
}

// --- Own orders ---

export function useMyOrders(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: ["my-orders", subdomain],
    queryFn: () => storefrontFetch<any[]>(subdomain, "/customers/me/orders", { auth: true }),
    enabled,
  });
}

export function useMyOrder(subdomain: string, orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["my-orders", subdomain, orderId],
    queryFn: () => storefrontFetch<any>(subdomain, `/customers/me/orders/${orderId}`, { auth: true }),
    enabled,
  });
}

// --- Reviews ---

/** Public — returns `{ average, count, reviews }`, only ever `approved` rows. */
export function useStorefrontProductReviews(subdomain: string, productId: string | undefined) {
  return useQuery({
    queryKey: ["storefront-product-reviews", subdomain, productId],
    queryFn: () => storefrontFetch<any>(subdomain, `/products/${productId}/reviews`),
    enabled: !!productId,
  });
}

/**
 * A non-qualifying submission (no completed order for this product) 403s
 * with `NOT_ELIGIBLE` — surfaced inline by the caller via `error`, rather
 * than pre-checking eligibility with an extra round-trip the API spec
 * doesn't define an endpoint for.
 */
export function useSubmitReview(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, dto }: { productId: string; dto: CreateReviewDto }) =>
      storefrontFetch<any>(subdomain, `/products/${productId}/reviews`, { method: "POST", body: dto, auth: true }),
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ["storefront-product-reviews", subdomain, vars.productId] }),
  });
}

// --- Customer addresses ---

export function useMyAddresses(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: ["my-addresses", subdomain],
    queryFn: () => storefrontFetch<any[]>(subdomain, "/customers/me/addresses", { auth: true }),
    enabled,
  });
}

export function useAddAddress(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateAddressDto) =>
      storefrontFetch<any>(subdomain, "/customers/me/addresses", { method: "POST", body: dto, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-addresses", subdomain] }),
  });
}

export function useUpdateAddress(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId, dto }: { addressId: string; dto: UpdateAddressDto }) =>
      storefrontFetch<any>(subdomain, `/customers/me/addresses/${addressId}`, { method: "PATCH", body: dto, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-addresses", subdomain] }),
  });
}

export function useRemoveAddress(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) =>
      storefrontFetch<void>(subdomain, `/customers/me/addresses/${addressId}`, { method: "DELETE", auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-addresses", subdomain] }),
  });
}

// --- Storefront brands ---

export function useStorefrontBrands(subdomain: string) {
  return useQuery({
    queryKey: ["storefront-brands", subdomain],
    queryFn: () => storefrontFetch<any[]>(subdomain, "/storefront/brands"),
  });
}

// --- Wishlist ---

export function useWishlist(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: ["wishlist", subdomain],
    queryFn: () => storefrontFetch<any[]>(subdomain, "/customers/me/wishlist", { auth: true }),
    enabled,
    retry: false,
  });
}

export function useAddToWishlist(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      storefrontFetch<any>(subdomain, "/customers/me/wishlist", { method: "POST", body: { productId }, auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist", subdomain] }),
  });
}

export function useRemoveFromWishlist(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      storefrontFetch<void>(subdomain, `/customers/me/wishlist/${productId}`, { method: "DELETE", auth: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist", subdomain] }),
  });
}

// --- Coupon history + validation ---

export function useMyCoupons(subdomain: string, enabled: boolean) {
  return useQuery({
    queryKey: ["my-coupons", subdomain],
    queryFn: () => storefrontFetch<any[]>(subdomain, "/customers/me/coupons", { auth: true }),
    enabled,
    retry: false,
  });
}

export function useValidateCoupon(subdomain: string) {
  return useMutation({
    mutationFn: ({ code, subtotal }: { code: string; subtotal: number }) =>
      storefrontFetch<any>(subdomain, "/coupons/validate", { method: "POST", body: { code, subtotal } }),
  });
}

// --- Product Q&A ---

export function useProductQuestions(subdomain: string, productId: string | undefined) {
  return useQuery({
    queryKey: ["product-questions", subdomain, productId],
    queryFn: () => storefrontFetch<any[]>(subdomain, `/storefront/products/${productId}/questions`),
    enabled: !!productId,
  });
}

export function useAskQuestion(subdomain: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, question }: { productId: string; question: string }) =>
      storefrontFetch<any>(subdomain, `/storefront/products/${productId}/questions`, {
        method: "POST",
        body: { question },
        auth: true,
      }),
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ["product-questions", subdomain, vars.productId] }),
  });
}
