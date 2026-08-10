"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminTenants } from "@/lib/hooks-catalog";

const STATUS_COLORS: Record<string, string> = {
  trial: "text-zinc-500",
  active: "text-green-700 dark:text-green-400",
  past_due: "text-amber-700 dark:text-amber-400",
  suspended: "text-red-700 dark:text-red-400",
  offboarded: "text-zinc-400",
};

export default function AdminTenantsPage() {
  const [page, setPage] = useState(1);
  const tenants = useAdminTenants(page, 20);

  if (tenants.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const meta = tenants.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.limit)) : 1;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Tenants</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Name</th>
            <th className="py-1 font-medium">Subdomain</th>
            <th className="py-1 font-medium">Status</th>
            <th className="py-1 font-medium">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {tenants.data?.data?.map((t: any) => (
            <tr key={t.id}>
              <td className="py-1.5">
                <Link href={`/admin/tenants/${t.id}`} className="text-brand-600 hover:underline">
                  {t.name}
                </Link>
              </td>
              <td className="py-1.5 font-mono">{t.subdomain}</td>
              <td className={`py-1.5 capitalize ${STATUS_COLORS[t.status] ?? ""}`}>{t.status.replace("_", " ")}</td>
              <td className="py-1.5">{new Date(t.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {meta && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
          >
            Previous
          </button>
          <span className="text-zinc-500">
            Page {page} of {totalPages} ({meta.total} tenants)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-zinc-300 px-2 py-1 disabled:opacity-50 dark:border-zinc-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
