"use client";

import { useState } from "react";
import { WEBHOOK_EVENT_TYPES } from "@saas/shared-types";
import {
  useWebhookSubscriptions,
  useCreateWebhookSubscription,
  useUpdateWebhookSubscription,
  useRemoveWebhookSubscription,
  useWebhookDeliveries,
} from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const DELIVERY_STATUS_COLORS: Record<string, string> = {
  pending: "text-amber-700 dark:text-amber-400",
  delivered: "text-green-700 dark:text-green-400",
  failed: "text-red-700 dark:text-red-400",
};

export default function WebhooksPage() {
  const subscriptions = useWebhookSubscriptions();
  const createSubscription = useCreateWebhookSubscription();
  const updateSubscription = useUpdateWebhookSubscription();
  const removeSubscription = useRemoveWebhookSubscription();

  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  // The secret is only ever present in the CREATE response — shown once
  // here, then never again (see WebhookSubscriptionsService's own comment).
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deliveries = useWebhookDeliveries(selectedId ?? undefined);

  const toggleEventType = (type: string) => {
    setEventTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || eventTypes.length === 0) return;
    createSubscription.mutate(
      { url, eventTypes },
      {
        onSuccess: (created: any) => {
          setUrl("");
          setEventTypes([]);
          setRevealedSecret(created.secret);
        },
      },
    );
  };

  if (subscriptions.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Webhooks</h1>
      <p className="text-sm text-zinc-500">
        Configure endpoints that receive real-time events from your store. Every delivery is signed with your
        endpoint&apos;s secret via an <code>X-Webhook-Signature</code> header (HMAC-SHA256) so you can verify it
        genuinely came from us.
      </p>

      {revealedSecret && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-1 font-medium text-amber-900 dark:text-amber-200">
            Save this signing secret now — it won&apos;t be shown again:
          </p>
          <p className="break-all font-mono text-xs text-amber-900 dark:text-amber-200">{revealedSecret}</p>
          <button
            onClick={() => setRevealedSecret(null)}
            className="mt-2 text-xs text-amber-700 underline dark:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="space-y-4">
        {subscriptions.data?.length === 0 && (
          <p className="text-sm text-zinc-500">No webhook subscriptions yet.</p>
        )}
        {subscriptions.data?.map((s: any) => (
          <div key={s.id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between">
              <p className="break-all font-medium text-zinc-900 dark:text-zinc-50">{s.url}</p>
              <span className={s.isActive ? "text-xs text-green-700 dark:text-green-400" : "text-xs text-zinc-500"}>
                {s.isActive ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1">
              {s.eventTypes.map((t: string) => (
                <span
                  key={t}
                  className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateSubscription.mutate({ id: s.id, dto: { isActive: !s.isActive } })}
                disabled={updateSubscription.isPending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {s.isActive ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                {selectedId === s.id ? "Hide deliveries" : "View deliveries"}
              </button>
              <button
                onClick={() => removeSubscription.mutate(s.id)}
                disabled={removeSubscription.isPending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Remove
              </button>
            </div>

            {selectedId === s.id && (
              <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                {deliveries.isLoading && <p className="text-sm text-zinc-500">Loading deliveries…</p>}
                {deliveries.data?.length === 0 && <p className="text-sm text-zinc-500">No deliveries yet.</p>}
                {deliveries.data && deliveries.data.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="text-left text-zinc-500">
                      <tr>
                        <th className="py-1 font-medium">Event</th>
                        <th className="py-1 font-medium">Status</th>
                        <th className="py-1 font-medium">Response</th>
                        <th className="py-1 font-medium">Attempts</th>
                        <th className="py-1 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {deliveries.data.map((d: any) => (
                        <tr key={d.id}>
                          <td className="py-1.5 font-mono text-xs">{d.eventType}</td>
                          <td className={`py-1.5 capitalize ${DELIVERY_STATUS_COLORS[d.status] ?? ""}`}>
                            {d.status}
                          </td>
                          <td className="py-1.5">{d.responseStatus ?? "—"}</td>
                          <td className="py-1.5">{d.attempt}</td>
                          <td className="py-1.5">{new Date(d.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Add a webhook endpoint</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/saas"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Events</p>
            {WEBHOOK_EVENT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={eventTypes.includes(type)}
                  onChange={() => toggleEventType(type)}
                />
                <span className="font-mono text-xs">{type}</span>
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={createSubscription.isPending || !url || eventTypes.length === 0}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createSubscription.isPending ? "Creating…" : "Create"}
          </button>
          {createSubscription.isError && (
            <p className="text-sm text-red-600">
              {createSubscription.error instanceof ApiError ? createSubscription.error.message : "Something went wrong."}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
