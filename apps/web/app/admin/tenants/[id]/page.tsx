"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  useAdminTenant,
  useAdminTenantAuditLogs,
  useUpdateTenantStatus,
  usePlanOverrides,
  useCreatePlanOverride,
} from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const STATUSES = ["trial", "active", "past_due", "suspended", "offboarded"];
const METRICS = ["staff_seats", "product_count", "order_volume"];

export default function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tenant = useAdminTenant(id);
  const auditLogs = useAdminTenantAuditLogs(id);
  const overrides = usePlanOverrides(id);
  const updateStatus = useUpdateTenantStatus();
  const createOverride = useCreatePlanOverride();

  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [overrideMetric, setOverrideMetric] = useState(METRICS[0]);
  const [overrideValue, setOverrideValue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideExpiresAt, setOverrideExpiresAt] = useState("");

  if (tenant.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const handleStatusChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!status || !reason) return;
    updateStatus.mutate({ id, dto: { status, reason } });
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

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{tenant.data?.name}</h1>
        <p className="text-sm text-zinc-500">
          {tenant.data?.subdomain} — status: <span className="capitalize">{tenant.data?.status?.replace("_", " ")}</span>
        </p>
      </div>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Change status</h2>
        <form onSubmit={handleStatusChange} className="space-y-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Select new status…</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={updateStatus.isPending || !status || !reason}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {updateStatus.isPending ? "Saving…" : "Update status"}
          </button>
          {updateStatus.isError && (
            <p className="text-sm text-red-600">
              {updateStatus.error instanceof ApiError ? updateStatus.error.message : "Something went wrong."}
            </p>
          )}
        </form>
      </section>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Plan overrides</h2>
        <table className="mb-4 w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-1 font-medium">Metric</th>
              <th className="py-1 font-medium">Value</th>
              <th className="py-1 font-medium">Reason</th>
              <th className="py-1 font-medium">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {overrides.data?.map((o: any) => (
              <tr key={o.id}>
                <td className="py-1.5">{o.metric}</td>
                <td className="py-1.5">{o.overrideValue}</td>
                <td className="py-1.5">{o.reason}</td>
                <td className="py-1.5">{new Date(o.expiresAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {overrides.data?.length === 0 && <p className="mb-4 text-sm text-zinc-500">No active overrides.</p>}
        <form onSubmit={handleCreateOverride} className="grid grid-cols-2 gap-2">
          <select
            value={overrideMetric}
            onChange={(e) => setOverrideMetric(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={overrideValue}
            onChange={(e) => setOverrideValue(e.target.value)}
            placeholder="Override value"
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Reason"
            className="col-span-2 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="date"
            value={overrideExpiresAt}
            onChange={(e) => setOverrideExpiresAt(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={createOverride.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createOverride.isPending ? "Granting…" : "Grant override"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Audit log</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-1 font-medium">Action</th>
              <th className="py-1 font-medium">Metadata</th>
              <th className="py-1 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {auditLogs.data?.map((log: any) => (
              <tr key={log.id}>
                <td className="py-1.5">{log.action}</td>
                <td className="max-w-xs truncate py-1.5 font-mono text-xs">{JSON.stringify(log.metadata)}</td>
                <td className="py-1.5">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {auditLogs.data?.length === 0 && <p className="mt-2 text-sm text-zinc-500">No audit log entries.</p>}
      </section>
    </div>
  );
}
