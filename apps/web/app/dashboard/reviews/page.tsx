"use client";

import { useState } from "react";
import { useReviewsQueue, useModerateReview } from "@/lib/hooks-catalog";

const STATUSES = ["pending", "approved", "rejected", "hidden"] as const;

export default function ReviewsPage() {
  const [status, setStatus] = useState<string>("pending");
  const reviews = useReviewsQueue(status || undefined);
  const moderate = useModerateReview();

  if (reviews.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reviews</h1>
        <select
          className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Product</th>
            <th className="py-1 font-medium">Customer</th>
            <th className="py-1 font-medium">Rating</th>
            <th className="py-1 font-medium">Comment</th>
            <th className="py-1 font-medium">Status</th>
            <th className="py-1 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {reviews.data?.map((r: any) => (
            <tr key={r.id}>
              <td className="py-1.5">{r.product?.name}</td>
              <td className="py-1.5">
                {r.customer?.firstName} {r.customer?.lastName}
              </td>
              <td className="py-1.5">{"★".repeat(r.rating)}</td>
              <td className="max-w-xs truncate py-1.5">{r.comment}</td>
              <td className="py-1.5 capitalize">{r.status}</td>
              <td className="space-x-2 py-1.5">
                {r.status !== "approved" && (
                  <button
                    onClick={() => moderate.mutate({ id: r.id, status: "approved" })}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Approve
                  </button>
                )}
                {r.status !== "rejected" && (
                  <button
                    onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Reject
                  </button>
                )}
                {r.status !== "hidden" && (
                  <button
                    onClick={() => moderate.mutate({ id: r.id, status: "hidden" })}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Hide
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reviews.data?.length === 0 && <p className="mt-4 text-sm text-zinc-500">No reviews.</p>}
    </div>
  );
}
