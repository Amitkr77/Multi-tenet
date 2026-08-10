"use client";

import { useState } from "react";
import { usePlans, useCreatePlan, useArchivePlan } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const METRICS = ["staff_seats", "product_count", "order_volume"];

export default function AdminPlansPage() {
  const plans = usePlans();
  const createPlan = useCreatePlan();
  const archivePlan = useArchivePlan();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [billingInterval, setBillingInterval] = useState("month");
  const [limits, setLimits] = useState<Record<string, string>>({});

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    createPlan.mutate(
      {
        name,
        price: Number(price),
        billingInterval,
        limits: METRICS.filter((m) => limits[m]).map((m) => ({ metric: m, maxValue: Number(limits[m]) })),
      },
      {
        onSuccess: () => {
          setName("");
          setPrice("");
          setLimits({});
        },
      },
    );
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plans</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Existing plans</h2>
        <div className="space-y-2">
          {plans.data?.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {p.name} {p.isDefault && <span className="text-xs text-zinc-500">(default)</span>}
                </p>
                <p className="text-sm text-zinc-500">
                  ${Number(p.price).toFixed(2)}/{p.billingInterval} —{" "}
                  {p.limits.map((l: any) => `${l.metric}: ${l.maxValue}`).join(", ") || "no limits"}
                </p>
              </div>
              <button
                onClick={() => archivePlan.mutate(p.id)}
                disabled={archivePlan.isPending}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Archive
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Create a new plan</h2>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Plan name"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={billingInterval}
              onChange={(e) => setBillingInterval(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Limits (blank = unlimited)</p>
          {METRICS.map((m) => (
            <div key={m} className="flex items-center gap-2">
              <label className="w-32 text-sm text-zinc-500">{m}</label>
              <input
                type="number"
                value={limits[m] ?? ""}
                onChange={(e) => setLimits((prev) => ({ ...prev, [m]: e.target.value }))}
                className="flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          ))}
          <button
            type="submit"
            disabled={createPlan.isPending}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createPlan.isPending ? "Creating…" : "Create plan"}
          </button>
          {createPlan.isError && (
            <p className="text-sm text-red-600">
              {createPlan.error instanceof ApiError ? createPlan.error.message : "Something went wrong."}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
