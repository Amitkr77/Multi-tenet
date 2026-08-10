"use client";

import Link from "next/link";
import { useOrders, useTenantProfile } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";

export default function OrdersPage() {
  const orders = useOrders();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  if (orders.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Orders</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Order</th>
            <th className="py-1 font-medium">Customer</th>
            <th className="py-1 font-medium">Status</th>
            <th className="py-1 font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {orders.data?.map((order: any) => (
            <tr key={order.id}>
              <td className="py-1.5">
                <Link href={`/dashboard/orders/${order.id}`} className="text-brand-600 hover:underline">
                  #{order.id.slice(0, 8)}
                </Link>
              </td>
              <td className="py-1.5">{order.customer?.email}</td>
              <td className="py-1.5 capitalize">{order.status}</td>
              <td className="py-1.5">{formatMoney(Number(order.grandTotal), currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.data?.length === 0 && <p className="mt-4 text-sm text-zinc-500">No orders yet.</p>}
    </div>
  );
}
