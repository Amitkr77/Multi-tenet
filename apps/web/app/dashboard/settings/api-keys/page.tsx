"use client";

import { useState } from "react";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function ApiKeysPage() {
  const apiKeys = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [name, setName] = useState("");
  // The plain key is only ever present in the CREATE response — shown once
  // here, then never again (same one-time-reveal discipline as the
  // webhooks page's signing-secret reveal).
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    createApiKey.mutate(
      { name },
      {
        onSuccess: (created: any) => {
          setName("");
          setRevealedKey(created.key);
        },
      },
    );
  };

  if (apiKeys.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">API Keys</h1>
      <p className="text-sm text-zinc-500">
        Use an API key to call this store&apos;s entire API programmatically — pass it in an{" "}
        <code>X-API-Key</code> header instead of logging in. A key authenticates as the teammate who created
        it and is subject to that teammate&apos;s real, current permissions, just like their own session.
      </p>

      {revealedKey && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p className="mb-1 font-medium text-amber-900 dark:text-amber-200">
            Save this key now — it won&apos;t be shown again:
          </p>
          <p className="break-all font-mono text-xs text-amber-900 dark:text-amber-200">{revealedKey}</p>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-amber-700 underline dark:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <section className="space-y-4">
        {apiKeys.data?.length === 0 && <p className="text-sm text-zinc-500">No API keys yet.</p>}
        {apiKeys.data?.map((k: any) => (
          <div
            key={k.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{k.name}</p>
              <p className="font-mono text-xs text-zinc-500">••••••••{k.keyPreview}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Created {new Date(k.createdAt).toLocaleString()}
                {k.lastUsedAt && <> · Last used {new Date(k.lastUsedAt).toLocaleString()}</>}
                {k.revokedAt && (
                  <span className="text-red-600 dark:text-red-400"> · Revoked {new Date(k.revokedAt).toLocaleString()}</span>
                )}
              </p>
            </div>
            {!k.revokedAt && (
              <button
                onClick={() => revokeApiKey.mutate(k.id)}
                disabled={revokeApiKey.isPending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Revoke
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Create an API key</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Inventory sync script"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={createApiKey.isPending || !name}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createApiKey.isPending ? "Creating…" : "Create"}
          </button>
          {createApiKey.isError && (
            <p className="text-sm text-red-600">
              {createApiKey.error instanceof ApiError ? createApiKey.error.message : "Something went wrong."}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
