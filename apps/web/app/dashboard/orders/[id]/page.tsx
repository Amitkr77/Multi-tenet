"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { orderStatusSchema } from "@saas/shared-types";
import { useOrder, useUpdateOrderStatus, useRefundOrder, useTenantProfile } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";
import { ApiError } from "@/lib/api-client";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const order = useOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const refund = useRefundOrder();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [fulfillmentCarrier, setFulfillmentCarrier] = useState("");

  if (order.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!order.data) return <p className="text-sm text-red-600">Order not found.</p>;

  const o = order.data;
  const canRefund = ["paid", "fulfilled", "shipped", "delivered"].includes(o.status);

  const handleRefund = () => {
    if (!window.confirm(`Issue a full refund of ${formatMoney(Number(o.grandTotal), currency)} for this order?`)) return;
    refund.mutate({ id: o.id, dto: {} });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Order #{o.id.slice(0, 8)}</h1>
      <p className="mb-6 text-sm text-zinc-500">{o.customer?.email}</p>

      <section className="mb-6 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Items</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {o.items.map((item: any) => (
              <tr key={item.id}>
                <td className="py-1.5">{item.productName}</td>
                <td className="py-1.5 text-zinc-500">{item.sku}</td>
                <td className="py-1.5">× {item.quantity}</td>
                <td className="py-1.5 text-right">{formatMoney(Number(item.lineTotal), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Total: {formatMoney(Number(o.grandTotal), currency)}
        </p>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Status</h2>
        <div className="flex items-center gap-2">
          <select
            defaultValue={o.status}
            onChange={(e) => updateStatus.mutate({ id: o.id, dto: { status: e.target.value as any } })}
            className="input w-40"
          >
            {orderStatusSchema.options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {updateStatus.isPending && <span className="text-xs text-zinc-500">Saving…</span>}
        </div>

        <div className="flex items-center gap-2">
          <input
            placeholder="Tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            className="input"
          />
          <input
            placeholder="Carrier"
            value={fulfillmentCarrier}
            onChange={(e) => setFulfillmentCarrier(e.target.value)}
            className="input"
          />
          <button
            onClick={() =>
              updateStatus.mutate({ id: o.id, dto: { trackingNumber, fulfillmentCarrier } })
            }
            disabled={!trackingNumber}
            className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Save
          </button>
        </div>
        {o.trackingNumber && (
          <p className="text-xs text-zinc-500">
            Currently: {o.trackingNumber} ({o.fulfillmentCarrier ?? "unknown carrier"})
          </p>
        )}
      </section>

      {canRefund && (
        <section>
          <button
            onClick={handleRefund}
            disabled={refund.isPending}
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:hover:bg-red-950"
          >
            {refund.isPending ? "Processing…" : "Issue full refund"}
          </button>
          {refund.isError && (
            <p className="mt-2 text-sm text-red-600">
              {refund.error instanceof ApiError ? refund.error.message : "Something went wrong."}
            </p>
          )}
        </section>
      )}

      {o.refunds?.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Refunds</h2>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {o.refunds.map((r: any) => (
              <li key={r.id}>
                {formatMoney(Number(r.amount), currency)} — {r.status}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
