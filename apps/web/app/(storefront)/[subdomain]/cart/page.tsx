"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCart, useUpdateCartItem, useRemoveCartItem } from "@/lib/hooks-storefront";
import { getCustomerAccessToken } from "@/lib/customer-auth";

function effectivePrice(item: any): number {
  return Number(item.variant.price ?? item.variant.product.basePrice);
}

export default function CartPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const cart = useCart(subdomain, hasToken);
  const updateItem = useUpdateCartItem(subdomain);
  const removeItem = useRemoveCartItem(subdomain);

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || cart.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;

  const items = cart.data?.items ?? [];
  const subtotal = items.reduce((sum: number, item: any) => sum + effectivePrice(item) * item.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Your Cart</h1>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your cart is empty. <Link href={`/${subdomain}`} className="text-brand-600 hover:underline">Keep shopping</Link>.
        </p>
      ) : (
        <>
          <ul className="mb-6 divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((item: any) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.variant.product.name}</p>
                  <p className="text-xs text-zinc-500">{item.variant.sku} · ${effectivePrice(item).toFixed(2)} each</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const quantity = Number(e.target.value);
                    if (quantity > 0) updateItem.mutate({ itemId: item.id, dto: { quantity } });
                  }}
                  className="input w-16 text-center"
                />
                <p className="w-20 text-right text-sm text-zinc-700 dark:text-zinc-300">
                  ${(effectivePrice(item) * item.quantity).toFixed(2)}
                </p>
                <button
                  onClick={() => removeItem.mutate(item.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Subtotal</p>
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">${subtotal.toFixed(2)}</p>
          </div>
          <Link
            href={`/${subdomain}/checkout`}
            className="mt-6 block w-full rounded-full bg-brand-600 py-3 text-center text-sm font-medium text-white hover:bg-brand-700"
          >
            Proceed to checkout
          </Link>
        </>
      )}
    </div>
  );
}
