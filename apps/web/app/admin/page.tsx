"use client";

import Link from "next/link";
import { useAdminAllTenants, usePlans } from "@/lib/hooks-catalog";

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  past_due: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  offboarded: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
      {sub && <p className="text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const allTenants = useAdminAllTenants();
  const plans = usePlans();

  const tenants: any[] = allTenants.data?.data ?? [];

  const byStatus = tenants.reduce((acc: Record<string, number>, t: any) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const recentSignups = [...tenants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Platform Overview</h1>

      {allTenants.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <>
          {/* Top-level stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Total tenants" value={tenants.length} />
            <StatCard label="Active" value={byStatus.active ?? 0} />
            <StatCard label="Trial" value={byStatus.trial ?? 0} />
            <StatCard label="Past due" value={byStatus.past_due ?? 0} />
            <StatCard label="Suspended" value={byStatus.suspended ?? 0} />
          </div>

          {/* Status breakdown bar */}
          {tenants.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Status breakdown</h2>
              <div className="flex h-4 w-full overflow-hidden rounded-full">
                {Object.entries(byStatus).map(([status, count]) => (
                  <div
                    key={status}
                    title={`${status}: ${count}`}
                    style={{ width: `${(count / tenants.length) * 100}%` }}
                    className={`${
                      status === "active" ? "bg-green-500" :
                      status === "trial" ? "bg-zinc-400" :
                      status === "past_due" ? "bg-amber-500" :
                      status === "suspended" ? "bg-red-500" : "bg-zinc-300"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-zinc-500">
                {Object.entries(byStatus).map(([status, count]) => (
                  <span key={status}>{status.replace("_", " ")}: {count}</span>
                ))}
              </div>
            </section>
          )}

          {/* Plans summary */}
          {plans.data && plans.data.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Plans</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {plans.data.map((plan: any) => (
                  <div key={plan.id} className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{plan.name}</p>
                    <p className="text-xs text-zinc-500">
                      ${Number(plan.priceMonthly ?? 0).toFixed(0)}/mo
                      {plan.isArchived ? " · archived" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent signups */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent sign-ups</h2>
              <Link href="/admin/tenants" className="text-sm text-brand-600 hover:underline">View all →</Link>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1 font-medium">Name</th>
                  <th className="py-1 font-medium">Subdomain</th>
                  <th className="py-1 font-medium">Status</th>
                  <th className="py-1 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {recentSignups.map((t: any) => (
                  <tr key={t.id}>
                    <td className="py-1.5">
                      <Link href={`/admin/tenants/${t.id}`} className="text-brand-600 hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="py-1.5 font-mono text-xs">{t.subdomain}</td>
                    <td className="py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? ""}`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-1.5 text-zinc-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
