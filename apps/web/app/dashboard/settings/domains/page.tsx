"use client";

import { useState } from "react";
import { useDomains, useAddDomain, useVerifyDomain, useRemoveDomain } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const STATUS_COLORS: Record<string, string> = {
  pending_verification: "text-amber-700 dark:text-amber-400",
  verified: "text-green-700 dark:text-green-400",
  failed: "text-red-700 dark:text-red-400",
};

export default function DomainsPage() {
  const domains = useDomains();
  const addDomain = useAddDomain();
  const verifyDomain = useVerifyDomain();
  const removeDomain = useRemoveDomain();

  const [domain, setDomain] = useState("");
  const [verifyErrorFor, setVerifyErrorFor] = useState<string | null>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    addDomain.mutate(domain, { onSuccess: () => setDomain("") });
  };

  const handleVerify = (id: string) => {
    setVerifyErrorFor(null);
    verifyDomain.mutate(id, {
      onError: () => setVerifyErrorFor(id),
    });
  };

  if (domains.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Custom Domains</h1>
      <p className="text-sm text-zinc-500">
        Point your own domain at your store. Add a domain, then create the DNS record shown below at your
        registrar and click Verify — DNS changes can take a little while to propagate.
      </p>

      <section className="space-y-4">
        {domains.data?.length === 0 && (
          <p className="text-sm text-zinc-500">No custom domains yet.</p>
        )}
        {domains.data?.map((d: any) => (
          <div key={d.id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{d.domain}</p>
              <span className={`text-xs capitalize ${STATUS_COLORS[d.status] ?? ""}`}>
                {d.status.replace(/_/g, " ")}
              </span>
            </div>
            {d.status !== "verified" && d.dnsInstructions && (
              <div className="mb-3 rounded bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                <p className="mb-1 text-zinc-500">Add this DNS TXT record, then click Verify:</p>
                <p className="font-mono">
                  <span className="text-zinc-500">Name:</span> {d.dnsInstructions.recordName}
                </p>
                <p className="font-mono break-all">
                  <span className="text-zinc-500">Value:</span> {d.dnsInstructions.value}
                </p>
              </div>
            )}
            {verifyErrorFor === d.id && verifyDomain.error instanceof ApiError && (
              <p className="mb-2 text-sm text-red-600">{verifyDomain.error.message}</p>
            )}
            <div className="flex gap-2">
              {d.status !== "verified" && (
                <button
                  onClick={() => handleVerify(d.id)}
                  disabled={verifyDomain.isPending}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {verifyDomain.isPending ? "Verifying…" : "Verify"}
                </button>
              )}
              <button
                onClick={() => removeDomain.mutate(d.id)}
                disabled={removeDomain.isPending}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Add a domain</h2>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="shop.example.com"
            className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={addDomain.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {addDomain.isPending ? "Adding…" : "Add"}
          </button>
        </form>
        {addDomain.isError && (
          <p className="mt-2 text-sm text-red-600">
            {addDomain.error instanceof ApiError ? addDomain.error.message : "Something went wrong."}
          </p>
        )}
      </section>
    </div>
  );
}
