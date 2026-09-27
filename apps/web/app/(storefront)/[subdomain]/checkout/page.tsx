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
import { PaymentStep } from "./PaymentStep";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

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
  const [payment, setPayment] = useState<{ clientSecret: string; orderId: string } | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ShippingAddressInput>({ resolver: zodResolver(shippingAddressInputSchema) });

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || cart.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mb-8" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (!payment && (cart.data?.items?.length ?? 0) === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-500">Your cart is empty.</p>
      </div>
    );
  }

  if (payment) {
    const returnUrl = `${window.location.origin}/${subdomain}/orders/${payment.orderId}?payment=return`;
    return (
      <div className="mx-auto max-w-lg space-y-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Complete payment</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your order has been reserved. Complete payment to confirm.
          </p>
        </div>
        <PaymentStep clientSecret={payment.clientSecret} returnUrl={returnUrl} />
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
      { onSuccess: (result) => setPayment({ clientSecret: result.clientSecret, orderId: result.order.id }) },
    );
  };

  const items = cart.data?.items ?? [];
  const cartSubtotal = items.reduce((s: number, i: any) => s + Number(i.variant.price ?? i.variant.product.basePrice) * i.quantity, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: shipping form */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="mb-5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Shipping address</h2>
            <form onSubmit={getQuote} className="space-y-4" noValidate>
              <Field label="Address line 1" error={errors.line1?.message}>
                <input {...register("line1")} className={inputClass} placeholder="123 Main St" />
              </Field>
              <Field label="Address line 2 (optional)">
                <input {...register("line2")} className={inputClass} placeholder="Apt, suite, unit…" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="City" error={errors.city?.message}>
                  <input {...register("city")} className={inputClass} />
                </Field>
                <Field label="State / Province">
                  <input {...register("state")} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Postal code">
                  <input {...register("postalCode")} className={inputClass} />
                </Field>
                <Field label="Country" error={errors.country?.message}>
                  <input {...register("country")} className={inputClass} placeholder="US" />
                </Field>
              </div>
              <Field label="Coupon code (optional)">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className={inputClass}
                  placeholder="SAVE10"
                />
              </Field>

              <button
                type="submit"
                disabled={quote.isPending}
                className="w-full rounded-full border border-zinc-300 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {quote.isPending ? "Calculating…" : "Calculate shipping & tax"}
              </button>

              {quote.isError && (
                <p className="text-sm text-red-600">
                  {quote.error instanceof ApiError ? quote.error.message : "Something went wrong."}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Right: order summary */}
        <div>
          <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Order summary</h2>

            {/* Cart items */}
            <ul className="mb-4 divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item: any) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50 line-clamp-1">{item.variant.product.name}</p>
                    <p className="text-xs text-zinc-400">×{item.quantity}</p>
                  </div>
                  <span className="shrink-0 text-zinc-700 dark:text-zinc-300">
                    {formatMoney(Number(item.variant.price ?? item.variant.product.basePrice) * item.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Totals — either quote or pre-quote estimate */}
            <div className="space-y-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
              {quote.data ? (
                <>
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span>
                    <span>{formatMoney(quote.data.subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Shipping</span>
                    <span>{formatMoney(quote.data.shippingTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>Tax</span>
                    <span>{formatMoney(quote.data.taxTotal, currency)}</span>
                  </div>
                  {quote.data.discountTotal > 0 && (
                    <div className="flex justify-between text-brand-600">
                      <span>Discount</span>
                      <span>−{formatMoney(quote.data.discountTotal, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-zinc-200 pt-3 font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-50">
                    <span>Total</span>
                    <span>{formatMoney(quote.data.grandTotal, currency)}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={complete.isPending}
                    className="mt-3 w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {complete.isPending ? "Placing order…" : "Place order"}
                  </button>
                  {complete.isError && (
                    <p className="text-xs text-red-600">
                      {complete.error instanceof ApiError ? complete.error.message : "Something went wrong."}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-zinc-500">
                  <span>Subtotal</span>
                  <span>{formatMoney(cartSubtotal, currency)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
