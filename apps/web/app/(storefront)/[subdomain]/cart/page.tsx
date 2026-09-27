"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCart, useUpdateCartItem, useRemoveCartItem, useStorefrontTenant, useValidateCoupon } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";

function effectivePrice(item: any): number {
  return Number(item.variant.price ?? item.variant.product.basePrice);
}

function CartSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="h-16 w-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
          <div className="h-8 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

export default function CartPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const cart = useCart(subdomain, hasToken);
  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";
  const updateItem = useUpdateCartItem(subdomain);
  const removeItem = useRemoveCartItem(subdomain);
  const validateCoupon = useValidateCoupon(subdomain);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<any>(null);
  const FREE_SHIPPING_THRESHOLD = 100;

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  const items = cart.data?.items ?? [];
  const subtotal = items.reduce((sum: number, item: any) => sum + effectivePrice(item) * item.quantity, 0);
  const itemCount = items.reduce((sum: number, item: any) => sum + item.quantity, 0);

  if (!hasToken || cart.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mb-8" />
        <CartSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Your Cart
        {itemCount > 0 && <span className="ml-2 text-base font-normal text-zinc-400">({itemCount} item{itemCount !== 1 ? "s" : ""})</span>}
      </h1>

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-20 text-center dark:border-zinc-800">
          <svg className="mx-auto mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm text-zinc-500">Your cart is empty.</p>
          <Link href={`/${subdomain}/products`} className="mt-3 inline-block text-sm text-brand-600 hover:underline">
            Browse products →
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Items list */}
          <div className="lg:col-span-2">
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((item: any) => (
                <li key={item.id} className="flex gap-4 py-5">
                  {/* Thumbnail */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                    {item.variant.product.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.variant.product.images[0].url}
                        alt={item.variant.product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-300 dark:text-zinc-700">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.variant.product.name}</p>
                        <p className="text-xs text-zinc-500">{item.variant.sku} · {formatMoney(effectivePrice(item), currency)} each</p>
                      </div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 shrink-0">
                        {formatMoney(effectivePrice(item) * item.quantity, currency)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Qty control */}
                      <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <button
                          onClick={() => {
                            const qty = item.quantity - 1;
                            if (qty > 0) updateItem.mutate({ itemId: item.id, dto: { quantity: qty } });
                            else removeItem.mutate(item.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.quantity}</span>
                        <button
                          onClick={() => updateItem.mutate({ itemId: item.id, dto: { quantity: item.quantity + 1 } })}
                          className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem.mutate(item.id)}
                        className="text-xs text-zinc-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Link href={`/${subdomain}/products`} className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200">
              ← Continue shopping
            </Link>
          </div>

          {/* Order summary */}
          <div>
            <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Order summary</h2>

              {/* Free shipping progress bar */}
              {subtotal < FREE_SHIPPING_THRESHOLD ? (
                <div className="mb-4">
                  <p className="mb-1 text-xs text-zinc-500">
                    Add <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatMoney(FREE_SHIPPING_THRESHOLD - subtotal, currency)}</span> more for free shipping
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                  You qualify for free shipping!
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-500">
                  <span>Subtotal ({itemCount} items)</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatMoney(subtotal, currency)}</span>
                </div>
                {couponResult?.valid && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Coupon ({couponResult.code})</span>
                    <span>−{formatMoney(couponResult.discountAmount ?? 0, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500">
                  <span>Shipping</span>
                  <span className="text-zinc-400">Calculated at checkout</span>
                </div>
              </div>
              <div className="my-4 border-t border-zinc-200 dark:border-zinc-700" />
              <div className="flex justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                <span>Estimated total</span>
                <span>{formatMoney(couponResult?.valid ? subtotal - (couponResult.discountAmount ?? 0) : subtotal, currency)}</span>
              </div>

              {/* Coupon input */}
              <div className="mt-4">
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value); setCouponResult(null); }}
                    placeholder="Coupon code"
                    className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => {
                      if (!couponCode.trim()) return;
                      validateCoupon.mutate(
                        { code: couponCode.trim(), subtotal },
                        { onSuccess: (data) => setCouponResult({ ...data, code: couponCode.trim() }) },
                      );
                    }}
                    disabled={validateCoupon.isPending || !couponCode.trim()}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Apply
                  </button>
                </div>
                {couponResult && (
                  <p className={`mt-1.5 text-xs ${couponResult.valid ? "text-green-600" : "text-red-600"}`}>
                    {couponResult.valid
                      ? `Coupon applied — saving ${formatMoney(couponResult.discountAmount ?? 0, currency)}`
                      : (couponResult.reason ?? "Invalid coupon")}
                  </p>
                )}
              </div>

              <Link
                href={`/${subdomain}/checkout`}
                className="mt-5 block w-full rounded-full bg-brand-600 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700"
              >
                Proceed to checkout
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
