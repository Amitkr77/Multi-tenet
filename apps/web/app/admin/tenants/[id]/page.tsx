"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useAdminTenant,
  useAdminTenantAuditLogs,
  useUpdateTenantStatus,
  usePlanOverrides,
  useCreatePlanOverride,
  useAssignPlan,
  usePlans,
} from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const STATUSES = ["trial", "active", "past_due", "suspended", "offboarded"];
const METRICS = ["staff_seats", "product_count", "order_volume"];

const METRIC_LABELS: Record<string, string> = {
  staff_seats: "Staff seats",
  product_count: "Products",
  order_volume: "Order volume",
};

const STATUS_BADGE: Record<string, string> = {
  trial: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  past_due: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  offboarded: "bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500",
};

type Tab = "overview" | "overrides" | "audit";

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tenant = useAdminTenant(id);
  const auditLogs = useAdminTenantAuditLogs(id);
  const overrides = usePlanOverrides(id);
  const plans = usePlans();
  const updateStatus = useUpdateTenantStatus();
  const createOverride = useCreatePlanOverride();
  const assignPlan = useAssignPlan();

  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [overrideMetric, setOverrideMetric] = useState(METRICS[0]);
  const [overrideValue, setOverrideValue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideExpiresAt, setOverrideExpiresAt] = useState("");
  const [statusSuccess, setStatusSuccess] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planAssignSuccess, setPlanAssignSuccess] = useState(false);

  if (tenant.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm text-zinc-500">Loading tenant…</p>
      </div>
    );
  }

  if (tenant.isError || !tenant.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <p className="text-sm text-red-600">Could not load tenant.</p>
        <button onClick={() => router.push("/admin/tenants")} className="text-sm text-brand-600 hover:underline">
          ← Back to tenants
        </button>
      </div>
    );
  }

  const t = tenant.data;
  const activePlans = plans.data?.filter((p: any) => !p.isArchived) ?? [];

  const handleStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!status || !reason) return;
    updateStatus.mutate(
      { id, dto: { status, reason } },
      {
        onSuccess: () => {
          setStatusSuccess(true);
          setStatus("");
          setReason("");
          setTimeout(() => setStatusSuccess(false), 3000);
        },
      },
    );
  };

  const handleCreateOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideValue || !overrideReason || !overrideExpiresAt) return;
    createOverride.mutate(
      {
        tenantId: id,
        dto: {
          metric: overrideMetric,
          overrideValue: Number(overrideValue),
          reason: overrideReason,
          expiresAt: new Date(overrideExpiresAt).toISOString(),
        },
      },
      {
        onSuccess: () => {
          setOverrideValue("");
          setOverrideReason("");
          setOverrideExpiresAt("");
        },
      },
    );
  };

  const handleAssignPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) return;
    assignPlan.mutate(
      { tenantId: id, planId: selectedPlanId },
      {
        onSuccess: () => {
          setPlanAssignSuccess(true);
          setSelectedPlanId("");
          setTimeout(() => setPlanAssignSuccess(false), 3000);
        },
      },
    );
  };

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "overrides", label: "Plan Overrides", count: overrides.data?.length },
    { key: "audit", label: "Audit Log", count: auditLogs.data?.length },
  ];

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div>
        <button
          onClick={() => router.push("/admin/tenants")}
          className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Tenants
        </button>

        {/* Identity card */}
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t.name}</h1>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[t.status] ?? ""}`}>
                  {t.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
                <span className="font-mono">{t.subdomain}</span>
                <span>·</span>
                <span>
                  Joined {new Date(t.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                {t._count?.users != null && (
                  <>
                    <span>·</span>
                    <span>{t._count.users} staff user{t._count.users !== 1 ? "s" : ""}</span>
                  </>
                )}
              </div>
              <p className="font-mono text-xs text-zinc-400">{t.id}</p>
            </div>

            <div className="flex shrink-0 gap-2">
              <a
                href={`/${t.subdomain}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Storefront ↗
              </a>
              <button
                title="Impersonation is not yet implemented"
                disabled
                className="flex cursor-not-allowed items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 opacity-50 dark:border-zinc-800"
              >
                Impersonate
              </button>
            </div>
          </div>

          {/* Current plan banner */}
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
            <div className="flex-1">
              <p className="text-xs text-zinc-500">Current plan</p>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {t.plan ? (
                  <>
                    {t.plan.name}
                    <span className="ml-2 text-sm font-normal text-zinc-500">
                      ${Number(t.plan.price ?? 0).toFixed(2)}/{t.plan.billingInterval === "year" ? "yr" : "mo"}
                    </span>
                  </>
                ) : (
                  <span className="italic text-zinc-400">No plan assigned</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex gap-1">
          {TABS.map((tab_item) => (
            <button
              key={tab_item.key}
              onClick={() => setTab(tab_item.key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === tab_item.key
                  ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-400"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {tab_item.label}
              {tab_item.count !== undefined && tab_item.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  tab === tab_item.key
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}>
                  {tab_item.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Change status */}
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Change status</h2>

            {statusSuccess && (
              <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                Status updated successfully.
              </div>
            )}

            <form onSubmit={handleStatusChange} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">New status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Select new status…</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Payment confirmed, trial extended…"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              {updateStatus.isError && (
                <p className="text-sm text-red-600">
                  {updateStatus.error instanceof ApiError ? updateStatus.error.message : "Something went wrong."}
                </p>
              )}
              <button
                type="submit"
                disabled={updateStatus.isPending || !status || !reason}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {updateStatus.isPending ? "Saving…" : "Update status"}
              </button>
            </form>

            <div className="mt-4 rounded-lg border border-zinc-100 p-3 text-xs text-zinc-500 dark:border-zinc-800">
              <p className="mb-1 font-medium text-zinc-600 dark:text-zinc-400">Status guide</p>
              <ul className="space-y-0.5">
                <li><b>trial</b> — limited access, no payment required</li>
                <li><b>active</b> — full access, subscription active</li>
                <li><b>past_due</b> — payment failed, access restricted</li>
                <li><b>suspended</b> — manually suspended by admin</li>
                <li><b>offboarded</b> — account closed, data retained</li>
              </ul>
            </div>
          </section>

          {/* Assign plan */}
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Assign plan</h2>

            {planAssignSuccess && (
              <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                Plan assigned successfully.
              </div>
            )}

            <form onSubmit={handleAssignPlan} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  <option value="">Select plan to assign…</option>
                  {activePlans.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ${Number(p.price ?? 0).toFixed(2)}/{p.billingInterval}
                    </option>
                  ))}
                </select>
              </div>
              {assignPlan.isError && (
                <p className="text-sm text-red-600">
                  {assignPlan.error instanceof ApiError ? assignPlan.error.message : "Something went wrong."}
                </p>
              )}
              <button
                type="submit"
                disabled={assignPlan.isPending || !selectedPlanId}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {assignPlan.isPending ? "Assigning…" : "Assign plan"}
              </button>
            </form>

            {/* Plan limits preview */}
            {t.plan?.limits?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-zinc-500">Current plan limits</p>
                <div className="space-y-1">
                  {t.plan.limits.map((l: any) => (
                    <div key={l.metric} className="flex justify-between text-sm">
                      <span className="text-zinc-500">{METRIC_LABELS[l.metric] ?? l.metric}</span>
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {l.maxValue.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab: Plan Overrides */}
      {tab === "overrides" && (
        <div className="max-w-2xl space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Active overrides</h2>
            {overrides.isLoading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : overrides.data?.length === 0 ? (
              <p className="text-sm text-zinc-500">No active plan overrides.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3">Metric</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {overrides.data?.map((o: any) => (
                      <tr key={o.id} className="bg-white dark:bg-zinc-950">
                        <td className="px-4 py-3 font-medium">{METRIC_LABELS[o.metric] ?? o.metric}</td>
                        <td className="px-4 py-3">{o.overrideValue.toLocaleString()}</td>
                        <td className="px-4 py-3 text-zinc-500">{o.reason}</td>
                        <td className="px-4 py-3 text-zinc-500">{new Date(o.expiresAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Grant new override</h2>
            <form onSubmit={handleCreateOverride} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Metric</label>
                  <select
                    value={overrideMetric}
                    onChange={(e) => setOverrideMetric(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Override value</label>
                  <input
                    type="number"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Reason</label>
                <input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Enterprise trial, partnership deal…"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Expiry date</label>
                <input
                  type="date"
                  value={overrideExpiresAt}
                  onChange={(e) => setOverrideExpiresAt(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              {createOverride.isError && (
                <p className="text-sm text-red-600">
                  {createOverride.error instanceof ApiError ? createOverride.error.message : "Something went wrong."}
                </p>
              )}
              <button
                type="submit"
                disabled={createOverride.isPending || !overrideValue || !overrideReason || !overrideExpiresAt}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {createOverride.isPending ? "Granting…" : "Grant override"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Tab: Audit Log */}
      {tab === "audit" && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Audit log</h2>
          {auditLogs.isLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : auditLogs.data?.length === 0 ? (
            <p className="text-sm text-zinc-500">No audit log entries for this tenant.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {auditLogs.data?.map((log: any) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="max-w-sm px-4 py-3">
                        <code className="block truncate text-xs text-zinc-500">{JSON.stringify(log.metadata)}</code>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
