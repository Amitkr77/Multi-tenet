"use client";

import Link from "next/link";
import { useCoupons, useTenantProfile } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";

export default function CouponsPage() {
  const coupons = useCoupons();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  if (coupons.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Coupons</h1>
        <Link
          href="/dashboard/coupons/new"
          className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          New coupon
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Code</th>
            <th className="py-1 font-medium">Type</th>
            <th className="py-1 font-medium">Value</th>
            <th className="py-1 font-medium">Used</th>
            <th className="py-1 font-medium">Active</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {coupons.data?.map((c: any) => (
            <tr key={c.id}>
              <td className="py-1.5 font-mono">
                <Link href={`/dashboard/coupons/${c.id}`} className="text-brand-600 hover:underline">{c.code}</Link>
              </td>
              <td className="py-1.5">{c.type}</td>
              <td className="py-1.5">{c.type === "percentage" ? `${c.value}%` : formatMoney(Number(c.value), currency)}</td>
              <td className="py-1.5">
                {c.usedCount}
                {c.usageLimit ? ` / ${c.usageLimit}` : ""}
              </td>
              <td className="py-1.5">{c.isActive ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {coupons.data?.length === 0 && <p className="mt-4 text-sm text-zinc-500">No coupons yet.</p>}
    </div>
  );
}
