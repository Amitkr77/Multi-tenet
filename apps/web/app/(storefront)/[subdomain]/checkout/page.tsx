"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { shippingAddressInputSchema, type ShippingAddressInput } from "@saas/shared-types";
import { useCart, useCheckoutQuote, useCheckoutComplete, useStorefrontTenant } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { ApiError } from "@/lib/api-client";

export default function CheckoutPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const cart = useCart(subdomain, hasToken);
  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";
  const quote = useCheckoutQuote(subdomain);
  const complete = useCheckoutComplete(subdomain);
  const [couponCode, setCouponCode] = useState("");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ShippingAddressInput>({ resolver: zodResolver(shippingAddressInputSchema) });

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || cart.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;

  if ((cart.data?.items?.length ?? 0) === 0) {
    return (
      <div className="p-8">
        <p className="text-sm text-zinc-500">Your cart is empty.</p>
      </div>
    );
  }

  const getQuote = handleSubmit((shippingAddress) => {
    quote.mutate({ shippingAddress, couponCode: couponCode || undefined });
  });

  const placeOrder = () => {
    const shippingAddress = getValues();
    complete.mutate(
      { shippingAddress, couponCode: couponCode || undefined },
      { onSuccess: (result) => router.push(`/${subdomain}/orders/${result.order.id}`) },
    );
  };

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Checkout</h1>
      <form onSubmit={getQuote} className="space-y-4" noValidate>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Address line 1</span>
          <input {...register("line1")} className="input" />
          {errors.line1 && <span className="block text-xs text-red-600">{errors.line1.message}</span>}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">City</span>
          <input {...register("city")} className="input" />
          {errors.city && <span className="block text-xs text-red-600">{errors.city.message}</span>}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">State</span>
          <input {...register("state")} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Country</span>
          <input {...register("country")} className="input" placeholder="US" />
          {errors.country && <span className="block text-xs text-red-600">{errors.country.message}</span>}
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Coupon code (optional)</span>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="input"
            placeholder="SAVE10"
          />
        </label>

        <button
          type="submit"
          disabled={quote.isPending}
          className="w-full rounded-full border border-zinc-300 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {quote.isPending ? "Calculating…" : "Get quote"}
        </button>
      </form>

      {quote.isError && (
        <p className="mt-4 text-sm text-red-600">
          {quote.error instanceof ApiError ? quote.error.message : "Something went wrong."}
        </p>
      )}

      {quote.data && (
        <div className="mt-6 space-y-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <div className="flex justify-between">
            <span className="text-zinc-500">Subtotal</span>
            <span>{formatMoney(quote.data.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Shipping</span>
            <span>{formatMoney(quote.data.shippingTotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax</span>
            <span>{formatMoney(quote.data.taxTotal, currency)}</span>
          </div>
          {quote.data.discountTotal > 0 && (
            <div className="flex justify-between text-brand-600">
              <span>Discount</span>
              <span>-{formatMoney(quote.data.discountTotal, currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            <span>Total</span>
            <span>{formatMoney(quote.data.grandTotal, currency)}</span>
          </div>

          <button
            onClick={placeOrder}
            disabled={complete.isPending}
            className="mt-4 w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {complete.isPending ? "Placing order…" : "Place order"}
          </button>
          {complete.isError && (
            <p className="text-sm text-red-600">
              {complete.error instanceof ApiError ? complete.error.message : "Something went wrong."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
