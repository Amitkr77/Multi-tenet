"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMyOrder, useStorefrontTenant } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  paid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  fulfilled: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  shipped: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_STEPS = ["pending", "paid", "fulfilled", "shipped", "delivered"];

export default function MyOrderDetailPage() {
  const { subdomain, id } = useParams<{ subdomain: string; id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPaymentReturn = searchParams.get("payment") === "return";
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const order = useMyOrder(subdomain, id, hasToken);
  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || order.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!order.data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-sm text-red-600">Order not found.</p>
        <Link href={`/${subdomain}/orders`} className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const o = order.data;
  const activeStep = STATUS_STEPS.indexOf(o.status);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Back */}
      <Link
        href={`/${subdomain}/orders`}
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        My orders
      </Link>

      {/* Payment success banner */}
      {isPaymentReturn && o.status !== "pending" && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <svg className="h-5 w-5 text-green-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Payment received — your order is confirmed!
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold text-zinc-900 dark:text-zinc-50">#{o.id.slice(0, 8)}</h1>
          {o.createdAt && (
            <p className="mt-0.5 text-sm text-zinc-400">
              {new Date(o.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_BADGE[o.status] ?? ""}`}>
          {o.status}
        </span>
      </div>

      {/* Progress tracker (only for non-terminal statuses) */}
      {!["cancelled", "refunded"].includes(o.status) && (
        <div className="mb-8 flex items-center gap-0">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= activeStep;
            const isLast = i === STATUS_STEPS.length - 1;
            return (
              <div key={step} className="flex flex-1 items-center">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-brand-600 text-white" : "border-2 border-zinc-200 text-zinc-400 dark:border-zinc-700"}`}>
                  {done ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
                </div>
                {!isLast && (
                  <div className={`h-0.5 flex-1 ${i < activeStep ? "bg-brand-600" : "bg-zinc-200 dark:bg-zinc-800"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tracking info */}
      {o.trackingNumber && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Tracking number</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-amber-900 dark:text-amber-200">{o.trackingNumber}</p>
          {o.fulfillmentCarrier && <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{o.fulfillmentCarrier}</p>}
        </div>
      )}

      {/* Items */}
      <div className="mb-6 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Items</p>
        </div>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {o.items?.map((item: any) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.productName}</p>
                <p className="text-xs text-zinc-400">{item.sku} × {item.quantity}</p>
              </div>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {formatMoney(Number(item.lineTotal), currency)}
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-zinc-100 px-4 py-4 text-sm dark:border-zinc-800">
          {Number(o.discountTotal ?? 0) > 0 && (
            <div className="flex justify-between text-brand-600">
              <span>Discount</span>
              <span>−{formatMoney(Number(o.discountTotal), currency)}</span>
            </div>
          )}
          {Number(o.shippingTotal ?? 0) > 0 && (
            <div className="flex justify-between text-zinc-500">
              <span>Shipping</span>
              <span>{formatMoney(Number(o.shippingTotal), currency)}</span>
            </div>
          )}
          {Number(o.taxTotal ?? 0) > 0 && (
            <div className="flex justify-between text-zinc-500">
              <span>Tax</span>
              <span>{formatMoney(Number(o.taxTotal), currency)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-zinc-100 pt-2 font-semibold text-zinc-900 dark:border-zinc-700 dark:text-zinc-50">
            <span>Total</span>
            <span>{formatMoney(Number(o.grandTotal), currency)}</span>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      {(o.shippingLine1 || o.shippingCity) && (
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Shipping to</p>
          <address className="not-italic text-sm text-zinc-500 dark:text-zinc-400">
            {o.shippingLine1 && <div>{o.shippingLine1}</div>}
            {o.shippingLine2 && <div>{o.shippingLine2}</div>}
            {o.shippingCity && (
              <div>
                {o.shippingCity}
                {o.shippingState ? `, ${o.shippingState}` : ""}
                {o.shippingPostalCode ? ` ${o.shippingPostalCode}` : ""}
              </div>
            )}
            {o.shippingCountry && <div>{o.shippingCountry}</div>}
          </address>
        </div>
      )}
    </div>
  );
}
