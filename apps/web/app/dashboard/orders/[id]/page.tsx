"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { orderStatusSchema } from "@saas/shared-types";
import { useOrder, useUpdateOrderStatus, useRefundOrder, useTenantProfile } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";
import { ApiError } from "@/lib/api-client";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  paid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  fulfilled: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  shipped: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const order = useOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const refund = useRefundOrder();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [fulfillmentCarrier, setFulfillmentCarrier] = useState("");
  const [refundSuccess, setRefundSuccess] = useState(false);

  if (order.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-zinc-500">Loading order…</p>
      </div>
    );
  }
  if (!order.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <p className="text-sm text-red-600">Order not found.</p>
        <button onClick={() => router.push("/dashboard/orders")} className="text-sm text-brand-600 hover:underline">
          ← Back to orders
        </button>
      </div>
    );
  }

  const o = order.data;
  const canRefund = ["paid", "fulfilled", "shipped", "delivered"].includes(o.status);
  const subtotal = o.items?.reduce((s: number, item: any) => s + Number(item.lineTotal), 0) ?? 0;

  const handleRefund = () => {
    if (!window.confirm(`Issue a full refund of ${formatMoney(Number(o.grandTotal), currency)} for this order?`)) return;
    refund.mutate(
      { id: o.id, dto: {} },
      {
        onSuccess: () => {
          setRefundSuccess(true);
          setTimeout(() => setRefundSuccess(false), 4000);
        },
      },
    );
  };

  const handleSaveTracking = () => {
    updateStatus.mutate({ id: o.id, dto: { trackingNumber, fulfillmentCarrier } });
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push("/dashboard/orders")}
          className="mb-3 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Orders
        </button>

        {/* Order identity card */}
        <div className="flex items-start justify-between rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-mono text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                #{o.id.slice(0, 8)}
              </h1>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[o.status] ?? ""}`}>
                {o.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {o.customer?.email ?? "Guest"}
              {o.createdAt && (
                <> · {new Date(o.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-400">Order total</p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {formatMoney(Number(o.grandTotal), currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: items + totals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line items */}
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Items</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-5 py-2">Product</th>
                  <th className="px-5 py-2">SKU</th>
                  <th className="px-5 py-2 text-center">Qty</th>
                  <th className="px-5 py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {(o.items ?? []).map((item: any) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-50">{item.productName}</td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-500">{item.sku}</td>
                    <td className="px-5 py-3 text-center text-zinc-600 dark:text-zinc-400">×{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatMoney(Number(item.lineTotal), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal, currency)}</span>
              </div>
              {Number(o.discountTotal ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>−{formatMoney(Number(o.discountTotal), currency)}</span>
                </div>
              )}
              {Number(o.shippingTotal ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Shipping</span>
                  <span>{formatMoney(Number(o.shippingTotal), currency)}</span>
                </div>
              )}
              {Number(o.taxTotal ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-zinc-500">
                  <span>Tax</span>
                  <span>{formatMoney(Number(o.taxTotal), currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-50">
                <span>Grand total</span>
                <span>{formatMoney(Number(o.grandTotal), currency)}</span>
              </div>
            </div>
          </section>

          {/* Refunds */}
          {(o.refunds ?? []).length > 0 && (
            <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Refunds</h2>
              <ul className="space-y-2">
                {o.refunds.map((r: any) => (
                  <li key={r.id} className="flex justify-between text-sm">
                    <span className="capitalize text-zinc-600 dark:text-zinc-400">{r.status}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {formatMoney(Number(r.amount), currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Right: actions */}
        <div className="space-y-4">
          {/* Change status */}
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Update status</h2>
            <select
              defaultValue={o.status}
              onChange={(e) =>
                updateStatus.mutate({ id: o.id, dto: { status: e.target.value as any } })
              }
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {orderStatusSchema.options.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {updateStatus.isPending && (
              <p className="mt-1 text-xs text-zinc-500">Saving…</p>
            )}
          </section>

          {/* Fulfillment tracking */}
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Fulfillment</h2>
            {o.trackingNumber && (
              <div className="mb-3 rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                <p className="text-xs text-zinc-500">Current tracking</p>
                <p className="font-mono text-sm text-zinc-900 dark:text-zinc-50">{o.trackingNumber}</p>
                {o.fulfillmentCarrier && (
                  <p className="text-xs text-zinc-500">{o.fulfillmentCarrier}</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <input
                placeholder="Tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <input
                placeholder="Carrier (e.g. UPS, FedEx)"
                value={fulfillmentCarrier}
                onChange={(e) => setFulfillmentCarrier(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                onClick={handleSaveTracking}
                disabled={!trackingNumber || updateStatus.isPending}
                className="w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {updateStatus.isPending ? "Saving…" : "Save tracking"}
              </button>
            </div>
          </section>

          {/* Refund */}
          {canRefund && (
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Refund</h2>
              {refundSuccess && (
                <p className="mb-2 text-sm text-green-600 dark:text-green-400">Refund issued successfully.</p>
              )}
              <button
                onClick={handleRefund}
                disabled={refund.isPending}
                className="w-full rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/20"
              >
                {refund.isPending ? "Processing…" : `Refund ${formatMoney(Number(o.grandTotal), currency)}`}
              </button>
              {refund.isError && (
                <p className="mt-2 text-xs text-red-600">
                  {refund.error instanceof ApiError ? refund.error.message : "Something went wrong."}
                </p>
              )}
            </section>
          )}

          {/* Customer info */}
          {o.customer && (
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Customer</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{o.customer.email}</p>
              {o.customer.firstName && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {o.customer.firstName} {o.customer.lastName}
                </p>
              )}
            </section>
          )}

          {/* Shipping address */}
          {o.shippingAddress && (
            <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Ship to</h2>
              <address className="not-italic text-sm text-zinc-600 dark:text-zinc-400">
                {o.shippingAddress.line1 && <div>{o.shippingAddress.line1}</div>}
                {o.shippingAddress.line2 && <div>{o.shippingAddress.line2}</div>}
                {o.shippingAddress.city && (
                  <div>
                    {o.shippingAddress.city}
                    {o.shippingAddress.state ? `, ${o.shippingAddress.state}` : ""}
                    {o.shippingAddress.postalCode ? ` ${o.shippingAddress.postalCode}` : ""}
                  </div>
                )}
                {o.shippingAddress.country && <div>{o.shippingAddress.country}</div>}
              </address>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
