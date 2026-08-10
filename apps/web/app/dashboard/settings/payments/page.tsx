"use client";

import { usePaymentAccountStatus, useStartOnboarding, usePayouts, useTenantProfile } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";
import { ApiError } from "@/lib/api-client";

export default function PaymentsSettingsPage() {
  const status = usePaymentAccountStatus();
  const onboard = useStartOnboarding();
  const payouts = usePayouts();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  if (status.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const account = status.data;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Payments</h1>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Stripe Connect</p>
        <p className="mb-3 text-sm capitalize text-zinc-500">
          Status: {account?.onboardingStatus?.replace("_", " ") ?? "not started"}
        </p>
        <button
          onClick={() =>
            onboard.mutate(undefined, {
              onSuccess: (result) => {
                window.location.href = result.url;
              },
            })
          }
          disabled={onboard.isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {onboard.isPending ? "Starting…" : account?.stripeAccountId ? "Continue onboarding" : "Connect with Stripe"}
        </button>
        {onboard.isError && (
          <p className="mt-2 text-sm text-red-600">
            {onboard.error instanceof ApiError ? onboard.error.message : "Something went wrong."}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent transactions</h2>
        {payouts.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : payouts.data?.length === 0 ? (
          <p className="text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1 font-medium">Order</th>
                <th className="py-1 font-medium">Amount</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {payouts.data?.map((t: any) => (
                <tr key={t.id}>
                  <td className="py-1.5">#{t.orderId.slice(0, 8)}</td>
                  <td className="py-1.5">{formatMoney(Number(t.amount), currency)}</td>
                  <td className="py-1.5 capitalize">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
