"use client";

import { useBillingPlan, useUpgradePlan, useInvoices, usePlans } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const METRIC_LABELS: Record<string, string> = {
  staff_seats: "Staff seats",
  product_count: "Products",
  order_volume: "Orders this month",
};

function UsageBar({ metric, count, limit }: { metric: string; count: number; limit: number | null }) {
  const pct = limit ? Math.min(100, Math.round((count / limit) * 100)) : 0;
  const overLimit = limit != null && count >= limit;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500">
        <span>{METRIC_LABELS[metric] ?? metric}</span>
        <span>{limit == null ? `${count} (unlimited)` : `${count} / ${limit}`}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-900">
        {limit != null && (
          <div
            className={`h-2 rounded-full ${overLimit ? "bg-red-500" : "bg-brand-600"}`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}

export default function BillingPage() {
  const plan = useBillingPlan();
  const upgrade = useUpgradePlan();
  const invoices = useInvoices();
  const plans = usePlans();

  if (plan.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const currentPlanId = plan.data?.plan?.id;

  const errorMessage =
    upgrade.error instanceof ApiError
      ? upgrade.error.code === "DOWNGRADE_BLOCKED"
        ? upgrade.error.message
        : upgrade.error.message
      : null;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Billing</h1>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Current plan</p>
        <p className="mb-4 text-lg text-zinc-900 dark:text-zinc-50">
          {plan.data?.plan?.name} — ${Number(plan.data?.plan?.price ?? 0).toFixed(2)}/{plan.data?.plan?.billingInterval}
        </p>
        <div className="space-y-3">
          {plan.data?.usage?.map((u: any) => (
            <UsageBar key={u.metric} metric={u.metric} count={u.count} limit={u.limit} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Available plans</h2>
        {errorMessage && <p className="mb-3 text-sm text-red-600">{errorMessage}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {plans.data?.map((p: any) => (
            <div key={p.id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
              <p className="mb-3 text-sm text-zinc-500">
                ${Number(p.price).toFixed(2)}/{p.billingInterval}
              </p>
              <button
                onClick={() => upgrade.mutate(p.id)}
                disabled={upgrade.isPending || p.id === currentPlanId}
                className="w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {p.id === currentPlanId ? "Current plan" : upgrade.isPending ? "Switching…" : "Switch to this plan"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Invoices</h2>
        {invoices.data?.length === 0 ? (
          <p className="text-sm text-zinc-500">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1 font-medium">Date</th>
                <th className="py-1 font-medium">Amount</th>
                <th className="py-1 font-medium">Status</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {invoices.data?.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="py-1.5">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="py-1.5">${Number(inv.amountDue).toFixed(2)}</td>
                  <td className="py-1.5 capitalize">{inv.status}</td>
                  <td className="py-1.5">
                    {inv.hostedInvoiceUrl && (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
