"use client";

import { useState } from "react";
import { usePlans, useCreatePlan, useUpdatePlan, useArchivePlan } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

const METRICS = ["staff_seats", "product_count", "order_volume"] as const;

const METRIC_LABELS: Record<string, string> = {
  staff_seats: "Staff seats",
  product_count: "Product count",
  order_volume: "Order volume",
};

function PlanCard({ plan, onEdit }: { plan: any; onEdit: (p: any) => void }) {
  const archivePlan = useArchivePlan();

  return (
    <div className={`rounded-lg border p-5 transition-opacity ${plan.isArchived ? "border-zinc-200 opacity-60 dark:border-zinc-800" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{plan.name}</p>
            {plan.isDefault && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                Default
              </span>
            )}
            {plan.isArchived && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800">
                Archived
              </span>
            )}
          </div>
          <p className="mt-0.5 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            ${Number(plan.price ?? plan.priceMonthly ?? 0).toFixed(2)}
            <span className="text-sm font-normal text-zinc-500">/{plan.billingInterval ?? "mo"}</span>
          </p>
        </div>

        {!plan.isArchived && (
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(plan)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Archive plan "${plan.name}"? Existing subscribers won't be affected.`)) {
                  archivePlan.mutate(plan.id);
                }
              }}
              disabled={archivePlan.isPending}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              Archive
            </button>
          </div>
        )}
      </div>

      {plan.limits?.length > 0 && (
        <div className="mt-3 space-y-1">
          {plan.limits.map((l: any) => (
            <div key={l.metric} className="flex justify-between text-sm text-zinc-500">
              <span>{METRIC_LABELS[l.metric] ?? l.metric}</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{l.maxValue.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPlansPage() {
  const plans = usePlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [showCreate, setShowCreate] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [billingInterval, setBillingInterval] = useState("month");
  const [limits, setLimits] = useState<Record<string, string>>({});

  // Edit form state — mirrors create
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editInterval, setEditInterval] = useState("month");
  const [editLimits, setEditLimits] = useState<Record<string, string>>({});

  function openEdit(plan: any) {
    setEditingPlan(plan);
    setEditName(plan.name);
    setEditPrice(String(plan.price ?? plan.priceMonthly ?? ""));
    setEditInterval(plan.billingInterval ?? "month");
    const lims: Record<string, string> = {};
    for (const l of plan.limits ?? []) lims[l.metric] = String(l.maxValue);
    setEditLimits(lims);
  }

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
          setName(""); setPrice(""); setLimits({}); setShowCreate(false);
        },
      },
    );
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !editName || !editPrice) return;
    updatePlan.mutate(
      {
        id: editingPlan.id,
        dto: {
          name: editName,
          price: Number(editPrice),
          billingInterval: editInterval,
          limits: METRICS.filter((m) => editLimits[m]).map((m) => ({ metric: m, maxValue: Number(editLimits[m]) })),
        },
      },
      { onSuccess: () => setEditingPlan(null) },
    );
  };

  const activePlans = plans.data?.filter((p: any) => !p.isArchived) ?? [];
  const archivedPlans = plans.data?.filter((p: any) => p.isArchived) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plans</h1>
        <button
          onClick={() => { setShowCreate(true); setEditingPlan(null); }}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New plan
        </button>
      </div>

      {/* Edit modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Edit "{editingPlan.name}"
            </h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Plan name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Price</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Interval</label>
                  <select
                    value={editInterval}
                    onChange={(e) => setEditInterval(e.target.value)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Limits (blank = unlimited)</p>
                {METRICS.map((m) => (
                  <div key={m} className="mb-2 flex items-center gap-2">
                    <label className="w-32 text-sm text-zinc-500">{METRIC_LABELS[m]}</label>
                    <input
                      type="number"
                      value={editLimits[m] ?? ""}
                      onChange={(e) => setEditLimits((prev) => ({ ...prev, [m]: e.target.value }))}
                      className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                ))}
              </div>

              {updatePlan.isError && (
                <p className="text-sm text-red-600">
                  {updatePlan.error instanceof ApiError ? updatePlan.error.message : "Something went wrong."}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePlan.isPending}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {updatePlan.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {plans.isLoading ? (
        <p className="text-sm text-zinc-500">Loading plans…</p>
      ) : (
        <>
          {/* Active plans */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Active plans</h2>
            {activePlans.length === 0 ? (
              <p className="text-sm text-zinc-500">No active plans. Create one below.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activePlans.map((p: any) => (
                  <PlanCard key={p.id} plan={p} onEdit={openEdit} />
                ))}
              </div>
            )}
          </section>

          {/* Create form */}
          {showCreate && (
            <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Create a new plan</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Plan name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Starter, Growth, Enterprise"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Price</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="29"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Interval</label>
                    <select
                      value={billingInterval}
                      onChange={(e) => setBillingInterval(e.target.value)}
                      className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    >
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Limits (blank = unlimited)</p>
                  {METRICS.map((m) => (
                    <div key={m} className="mb-2 flex items-center gap-2">
                      <label className="w-32 text-sm text-zinc-500">{METRIC_LABELS[m]}</label>
                      <input
                        type="number"
                        value={limits[m] ?? ""}
                        onChange={(e) => setLimits((prev) => ({ ...prev, [m]: e.target.value }))}
                        className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    </div>
                  ))}
                </div>

                {createPlan.isError && (
                  <p className="text-sm text-red-600">
                    {createPlan.error instanceof ApiError ? createPlan.error.message : "Something went wrong."}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={createPlan.isPending || !name || !price}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {createPlan.isPending ? "Creating…" : "Create plan"}
                </button>
              </form>
            </section>
          )}

          {/* Archived plans */}
          {archivedPlans.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-500">Archived plans</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {archivedPlans.map((p: any) => (
                  <PlanCard key={p.id} plan={p} onEdit={openEdit} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
