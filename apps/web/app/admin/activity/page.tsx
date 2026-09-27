"use client";

import { useState } from "react";
import { usePlatformActivity } from "@/lib/hooks-catalog";

const ACTION_COLORS: Record<string, string> = {
  "tenant.status_change": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "tenant.plan_assigned": "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400",
  "tenant.plan_override_granted": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "tenant.data_export_requested": "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  "user.invited": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "user.role_changed": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "order.refunded": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function actionLabel(action: string): string {
  return action
    .replace("tenant.", "")
    .replace("user.", "")
    .replace("order.", "")
    .replace(/_/g, " ");
}

function MetadataCell({ metadata }: { metadata: any }) {
  const [expanded, setExpanded] = useState(false);
  const raw = JSON.stringify(metadata ?? {});
  if (raw === "{}") return <span className="text-zinc-400">—</span>;

  // Friendly summary for common actions
  const items: string[] = [];
  if (metadata?.from && metadata?.to) items.push(`${metadata.from} → ${metadata.to}`);
  if (metadata?.reason) items.push(metadata.reason);
  if (metadata?.planName) items.push(metadata.planName);
  if (metadata?.metric) items.push(`${metadata.metric}: ${metadata.overrideValue}`);

  const summary = items.length ? items.join(" · ") : null;

  return (
    <div className="max-w-xs">
      {summary && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-left text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {summary}
        </button>
      )}
      {expanded && (
        <div>
          <code className="block break-all text-xs text-zinc-400">{raw}</code>
          <button onClick={() => setExpanded(false)} className="mt-1 text-xs text-zinc-400 hover:underline">
            collapse
          </button>
        </div>
      )}
      {!summary && !expanded && (
        <button onClick={() => setExpanded(true)} className="font-mono text-xs text-zinc-400 hover:underline">
          {raw.slice(0, 40)}{raw.length > 40 ? "…" : ""}
        </button>
      )}
    </div>
  );
}

const LIMIT_OPTIONS = [25, 50, 100, 200];

export default function AdminActivityPage() {
  const [limit, setLimit] = useState(50);
  const [actionFilter, setActionFilter] = useState("");
  const activity = usePlatformActivity(limit);

  const rows: any[] = activity.data ?? [];

  const uniqueActions = Array.from(new Set(rows.map((r) => r.action))).sort();
  const filtered = actionFilter ? rows.filter((r) => r.action === actionFilter) : rows;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Platform Activity</h1>
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">All actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {LIMIT_OPTIONS.map((l) => (
              <option key={l} value={l}>Last {l}</option>
            ))}
          </select>
          <button
            onClick={() => activity.refetch()}
            disabled={activity.isFetching}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {activity.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {activity.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-20 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500">No activity yet.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Actions like tenant status changes and plan assignments appear here.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-400">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</p>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {filtered.map((log: any) => (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                          ACTION_COLORS[log.action] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MetadataCell metadata={log.metadata} />
                    </td>
                    <td className="px-4 py-3">
                      {log.tenantId ? (
                        <a
                          href={`/admin/tenants/${log.tenantId}`}
                          className="font-mono text-xs text-brand-600 hover:underline"
                        >
                          {log.tenantId.slice(0, 8)}…
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-400">platform</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
