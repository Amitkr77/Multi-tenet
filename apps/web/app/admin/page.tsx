"use client";

import Link from "next/link";
import { usePlatformStats, useAdminAllTenants } from "@/lib/hooks-catalog";

const STATUS_COLORS: Record<string, string> = {
  trial: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  past_due: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  offboarded: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

const STATUS_BAR: Record<string, string> = {
  active: "bg-green-500",
  trial: "bg-zinc-400",
  past_due: "bg-amber-500",
  suspended: "bg-red-500",
  offboarded: "bg-zinc-300",
};

function MetricCard({
  label,
  value,
  sub,
  trend,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { direction: "up" | "down" | "neutral"; label: string };
  href?: string;
}) {
  const inner = (
    <div className="group rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      {trend && (
        <p
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            trend.direction === "up"
              ? "text-green-600 dark:text-green-400"
              : trend.direction === "down"
              ? "text-red-500"
              : "text-zinc-400"
          }`}
        >
          {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "—"}
          {trend.label}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function AdminOverviewPage() {
  const stats = usePlatformStats();
  const allTenants = useAdminAllTenants();

  const tenants: any[] = allTenants.data?.data ?? [];
  const s = stats.data;

  const recentSignups = [...tenants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const growthDiff =
    s && s.newLastMonth > 0
      ? Math.round(((s.newThisMonth - s.newLastMonth) / s.newLastMonth) * 100)
      : null;

  const isLoading = stats.isLoading || allTenants.isLoading;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Overview</h1>
        <p className="text-xs text-zinc-400">
          {isLoading ? "Loading…" : `Last refreshed just now`}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total tenants"
              value={s?.totalTenants ?? tenants.length}
              sub="all statuses"
              href="/admin/tenants"
            />
            <MetricCard
              label="Active tenants"
              value={s?.byStatus?.active ?? 0}
              sub="paying or fully activated"
              trend={
                (s?.byStatus?.active ?? 0) > 0
                  ? { direction: "up", label: "live" }
                  : { direction: "neutral", label: "none yet" }
              }
            />
            <MetricCard
              label="MRR"
              value={`$${s ? s.mrr.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "—"}`}
              sub="monthly recurring revenue"
            />
            <MetricCard
              label="New this month"
              value={s?.newThisMonth ?? 0}
              sub={s?.newLastMonth != null ? `vs ${s.newLastMonth} last month` : undefined}
              trend={
                growthDiff != null
                  ? {
                      direction: growthDiff > 0 ? "up" : growthDiff < 0 ? "down" : "neutral",
                      label: `${growthDiff > 0 ? "+" : ""}${growthDiff}% vs last month`,
                    }
                  : undefined
              }
            />
          </div>

          {/* Status breakdown row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {["trial", "active", "past_due", "suspended", "offboarded"].map((status) => (
              <Link
                key={status}
                href={`/admin/tenants?status=${status}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="capitalize text-sm text-zinc-600 dark:text-zinc-400">
                  {status.replace("_", " ")}
                </span>
                <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {s?.byStatus?.[status] ?? 0}
                </span>
              </Link>
            ))}
          </div>

          {/* Status stacked bar */}
          {tenants.length > 0 && s && (
            <section>
              <p className="mb-2 text-xs font-medium text-zinc-500">Status distribution</p>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                {Object.entries(s.byStatus ?? {}).map(([status, count]: [string, any]) => (
                  <div
                    key={status}
                    title={`${status.replace("_", " ")}: ${count}`}
                    style={{ width: `${(count / s.totalTenants) * 100}%` }}
                    className={`transition-all ${STATUS_BAR[status] ?? "bg-zinc-200"}`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-zinc-400">
                {Object.entries(s.byStatus ?? {}).map(([status, count]: [string, any]) => (
                  <span key={status}>
                    <span className="font-medium text-zinc-600 dark:text-zinc-300 capitalize">
                      {status.replace("_", " ")}
                    </span>{" "}
                    {count}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Recent sign-ups */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Recent sign-ups
              </h2>
              <Link href="/admin/tenants" className="text-xs text-brand-600 hover:underline">
                View all →
              </Link>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Tenant</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {recentSignups.map((t: any) => (
                    <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/tenants/${t.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {t.name}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-zinc-400">{t.subdomain}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {t.plan?.name ?? <span className="italic text-zinc-400">No plan</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? ""}`}>
                          {t.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
