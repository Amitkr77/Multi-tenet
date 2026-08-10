"use client";

import { useState } from "react";
import { useTaxRules, useCreateTaxRule, useCategories } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function TaxPage() {
  const taxRules = useTaxRules();
  const categories = useCategories();
  const createRule = useCreateTaxRule();

  const [region, setRegion] = useState("");
  const [rate, setRate] = useState("0");
  const [categoryId, setCategoryId] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate(
      { region, rate: Number(rate), categoryId: categoryId || undefined },
      { onSuccess: () => { setRegion(""); setRate("0"); setCategoryId(""); } },
    );
  };

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Tax rules</h1>

      {taxRules.isLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-1 font-medium">Region</th>
              <th className="py-1 font-medium">Rate</th>
              <th className="py-1 font-medium">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {taxRules.data?.map((r: any) => (
              <tr key={r.id}>
                <td className="py-1.5">{r.region}</td>
                <td className="py-1.5">{Number(r.rate)}%</td>
                <td className="py-1.5">{r.category?.name ?? "All"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form onSubmit={handleCreate} className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Region (e.g. US or US-CA)</span>
          <input value={region} onChange={(e) => setRegion(e.target.value)} className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Rate (%)</span>
          <input value={rate} onChange={(e) => setRate(e.target.value)} type="number" step="0.01" className="input" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">Category (optional)</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
            <option value="">All categories</option>
            {categories.data?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {createRule.isError && (
          <p className="text-sm text-red-600">
            {createRule.error instanceof ApiError ? createRule.error.message : "Something went wrong."}
          </p>
        )}
        <button
          type="submit"
          disabled={createRule.isPending || !region}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Add tax rule
        </button>
      </form>
    </div>
  );
}
