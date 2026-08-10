"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useMyOrders } from "@/lib/hooks-storefront";
import { getCustomerAccessToken } from "@/lib/customer-auth";

export default function MyOrdersPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const orders = useMyOrders(subdomain, hasToken);

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || orders.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">My Orders</h1>
      {orders.data?.length === 0 ? (
        <p className="text-sm text-zinc-500">You haven&apos;t placed any orders yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {orders.data?.map((order: any) => (
            <li key={order.id} className="py-4">
              <Link href={`/${subdomain}/orders/${order.id}`} className="flex items-center justify-between text-sm">
                <span className="text-zinc-900 dark:text-zinc-50">Order #{order.id.slice(0, 8)}</span>
                <span className="capitalize text-zinc-500">{order.status}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">${Number(order.grandTotal).toFixed(2)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
