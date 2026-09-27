"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAdminTenants, useUpdateTenantStatus } from "@/lib/hooks-catalog";

const STATUSES = ["all", "trial", "active", "past_due", "suspended", "offboarded"] as const;

const STATUS_BADGE: Record<string, string> = {
  trial: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  past_due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  offboarded: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

const STATUS_CHANGE_REASONS: Record<string, string> = {
  active: "Payment confirmed",
  suspended: "Suspended by platform admin",
  past_due: "Payment failed",
  offboarded: "Account closed",
  trial: "Reset to trial",
};

export default function AdminTenantsPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") ?? "all");

  // Inline quick-status-change popover state
  const [quickChangeTenantId, setQuickChangeTenantId] = useState<string | null>(null);
  const [quickStatus, setQuickStatus] = useState("");
  const [quickReason, setQuickReason] = useState("");
  const updateStatus = useUpdateTenantStatus();

  // Sync filter from URL param (clicked from overview page status cards)
  useEffect(() => {
    const s = searchParams.get("status");
    if (s && STATUSES.includes(s as any)) setStatusFilter(s);
  }, [searchParams]);

  const tenants = useAdminTenants(page, 20);

  const meta = tenants.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;
  const rows: any[] = tenants.data?.data ?? [];

  const filtered = rows.filter((t) => {
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function openQuickChange(tenantId: string, currentStatus: string) {
    setQuickChangeTenantId(tenantId);
    setQuickStatus(currentStatus);
    setQuickReason(STATUS_CHANGE_REASONS[currentStatus] ?? "");
  }

  function submitQuickChange(tenantId: string) {
    if (!quickStatus || !quickReason) return;
    updateStatus.mutate(
      { id: tenantId, dto: { status: quickStatus, reason: quickReason } },
      { onSuccess: () => setQuickChangeTenantId(null) },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Tenants</h1>
        {meta && <span className="text-sm text-zinc-500">{meta.total} total</span>}
      </div>

      {/* Search + filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or subdomain…"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? "bg-brand-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {tenants.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500">No tenants match your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {filtered.map((t: any) => (
                <>
                  <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{t.name}</p>
                      <p className="font-mono text-xs text-zinc-400">{t.subdomain}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {t.plan ? (
                        <span>
                          {t.plan.name}
                          <span className="ml-1 text-xs text-zinc-400">
                            ${Number(t.plan.price ?? 0).toFixed(0)}/{t.plan.billingInterval === "year" ? "yr" : "mo"}
                          </span>
                        </span>
                      ) : (
                        <span className="italic text-zinc-400">No plan</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {t._count?.users ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          quickChangeTenantId === t.id
                            ? setQuickChangeTenantId(null)
                            : openQuickChange(t.id, t.status)
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 ${STATUS_BADGE[t.status] ?? ""}`}
                      >
                        {t.status.replace("_", " ")}
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>

                  {/* Inline quick-change row */}
                  {quickChangeTenantId === t.id && (
                    <tr key={`${t.id}-quick`} className="bg-zinc-50 dark:bg-zinc-900">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={quickStatus}
                            onChange={(e) => setQuickStatus(e.target.value)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {["trial", "active", "past_due", "suspended", "offboarded"].map((s) => (
                              <option key={s} value={s}>{s.replace("_", " ")}</option>
                            ))}
                          </select>
                          <input
                            value={quickReason}
                            onChange={(e) => setQuickReason(e.target.value)}
                            placeholder="Reason (required)"
                            className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          />
                          <button
                            onClick={() => submitQuickChange(t.id)}
                            disabled={updateStatus.isPending || !quickStatus || !quickReason}
                            className="rounded-md bg-brand-600 px-3 py-1 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            {updateStatus.isPending ? "Saving…" : "Apply"}
                          </button>
                          <button
                            onClick={() => setQuickChangeTenantId(null)}
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta && totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            Previous
          </button>
          <span className="text-zinc-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
