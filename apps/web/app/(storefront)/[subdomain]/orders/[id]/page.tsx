"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMyOrder, useStorefrontTenant } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";

export default function MyOrderDetailPage() {
  const { subdomain, id } = useParams<{ subdomain: string; id: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const order = useMyOrder(subdomain, id, hasToken);
  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || order.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;
  if (!order.data) return <p className="p-8 text-sm text-red-600">Order not found.</p>;

  const o = order.data;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Order #{o.id.slice(0, 8)}
      </h1>
      <p className="mb-6 text-sm capitalize text-zinc-500">Status: {o.status}</p>

      <ul className="mb-6 divide-y divide-zinc-200 dark:divide-zinc-800">
        {o.items.map((item: any) => (
          <li key={item.id} className="flex items-center justify-between py-3 text-sm">
            <span>
              {item.productName} <span className="text-zinc-500">× {item.quantity}</span>
            </span>
            <span>{formatMoney(Number(item.lineTotal), currency)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between">
          <span className="text-zinc-500">Subtotal</span>
          <span>{formatMoney(Number(o.subtotal), currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Shipping</span>
          <span>{formatMoney(Number(o.shippingTotal), currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Tax</span>
          <span>{formatMoney(Number(o.taxTotal), currency)}</span>
        </div>
        {Number(o.discountTotal) > 0 && (
          <div className="flex justify-between text-brand-600">
            <span>Discount</span>
            <span>-{formatMoney(Number(o.discountTotal), currency)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          <span>Total</span>
          <span>{formatMoney(Number(o.grandTotal), currency)}</span>
        </div>
      </div>

      <div className="mt-6 text-sm text-zinc-500">
        <p className="mb-1 font-medium text-zinc-700 dark:text-zinc-300">Shipping to</p>
        <p>{o.shippingLine1}</p>
        {o.shippingLine2 && <p>{o.shippingLine2}</p>}
        <p>
          {o.shippingCity}
          {o.shippingState ? `, ${o.shippingState}` : ""} {o.shippingPostalCode}
        </p>
        <p>{o.shippingCountry}</p>
      </div>
    </div>
  );
}
