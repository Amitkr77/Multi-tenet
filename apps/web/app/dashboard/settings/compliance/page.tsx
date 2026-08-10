"use client";

import { useExportRequests, useRequestExport } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-700 dark:text-amber-400",
  ready: "text-green-700 dark:text-green-400",
  failed: "text-red-700 dark:text-red-400",
};

export default function CompliancePage() {
  const exportRequests = useExportRequests();
  const requestExport = useRequestExport();

  if (exportRequests.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Data Export</h1>
      <p className="text-sm text-zinc-500">
        Request a copy of your store&apos;s data at any time (products, orders, customers, and more) —
        data portability, no need to close your account. Each export is available to download for 7 days.
      </p>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <button
          onClick={() => requestExport.mutate()}
          disabled={requestExport.isPending}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {requestExport.isPending ? "Requesting…" : "Request my data export"}
        </button>
        {requestExport.isError && (
          <p className="mt-2 text-sm text-red-600">
            {requestExport.error instanceof ApiError ? requestExport.error.message : "Something went wrong."}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Past requests</h2>
        {exportRequests.data?.length === 0 ? (
          <p className="text-sm text-zinc-500">No export requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-1 font-medium">Requested</th>
                <th className="py-1 font-medium">Status</th>
                <th className="py-1 font-medium">Expires</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {exportRequests.data?.map((r: any) => {
                const expired = r.expiresAt && new Date(r.expiresAt) < new Date();
                return (
                  <tr key={r.id}>
                    <td className="py-1.5">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className={`py-1.5 capitalize ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</td>
                    <td className="py-1.5">
                      {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-1.5">
                      {r.status === "ready" && r.downloadUrl && !expired && (
                        <a
                          href={r.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          Download
                        </a>
                      )}
                      {r.status === "ready" && expired && (
                        <span className="text-zinc-400">Expired</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
