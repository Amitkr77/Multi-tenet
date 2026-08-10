"use client";

import { useState } from "react";
import { useAuditLog } from "@/lib/hooks-catalog";

export default function AuditLogPage() {
  const auditLog = useAuditLog();
  const [search, setSearch] = useState("");

  const rows = (auditLog.data ?? []).filter(
    (log: any) => !search || log.action.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Audit Log</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action…"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {auditLog.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Details</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((log: any) => (
              <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">{log.action}</td>
                <td className="px-4 py-2 text-zinc-500">{log.actorUserId ? log.actorUserId.slice(0, 8) + "…" : "system"}</td>
                <td className="max-w-xs px-4 py-2">
                  {log.metadata && Object.keys(log.metadata).length > 0 ? (
                    <pre className="truncate font-mono text-xs text-zinc-500">{JSON.stringify(log.metadata)}</pre>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!auditLog.isLoading && rows.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">{search ? "No matching entries." : "No audit log entries yet."}</p>
        )}
      </div>
      <p className="text-xs text-zinc-400">Showing the last 200 entries.</p>
    </div>
  );
}
