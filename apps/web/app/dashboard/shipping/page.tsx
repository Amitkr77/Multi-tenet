"use client";

import { useState } from "react";
import { useShippingZones, useCreateShippingZone, useAddShippingRate } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function ShippingPage() {
  const zones = useShippingZones();
  const createZone = useCreateShippingZone();
  const addRate = useAddShippingRate();

  const [zoneName, setZoneName] = useState("");
  const [regions, setRegions] = useState("");
  const [rateZoneId, setRateZoneId] = useState("");
  const [rateName, setRateName] = useState("");
  const [rateType, setRateType] = useState<"flat_rate" | "free_above_threshold">("flat_rate");
  const [rateAmount, setRateAmount] = useState("0");
  const [freeAboveAmount, setFreeAboveAmount] = useState("");

  const handleCreateZone = (e: React.FormEvent) => {
    e.preventDefault();
    createZone.mutate(
      { name: zoneName, regions: regions.split(",").map((r) => r.trim()).filter(Boolean) },
      { onSuccess: () => { setZoneName(""); setRegions(""); } },
    );
  };

  const handleAddRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateZoneId) return;
    addRate.mutate(
      {
        zoneId: rateZoneId,
        dto: {
          name: rateName,
          type: rateType,
          amount: Number(rateAmount),
          freeAboveAmount: freeAboveAmount ? Number(freeAboveAmount) : undefined,
        },
      },
      { onSuccess: () => { setRateName(""); setRateAmount("0"); setFreeAboveAmount(""); } },
    );
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Shipping</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Zones</h2>
        {zones.isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <ul className="mb-4 space-y-2 text-sm">
            {zones.data?.map((z: any) => (
              <li key={z.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {z.name} <span className="text-zinc-500">({(z.regions as string[]).join(", ")})</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                  {z.rates.map((r: any) => (
                    <li key={r.id}>
                      {r.name}: {r.type === "flat_rate" ? `$${Number(r.amount).toFixed(2)}` : `Free above $${Number(r.freeAboveAmount).toFixed(2)}`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreateZone} className="flex items-end gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Zone name</span>
            <input value={zoneName} onChange={(e) => setZoneName(e.target.value)} className="input" placeholder="Domestic US" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">Regions (comma-separated)</span>
            <input value={regions} onChange={(e) => setRegions(e.target.value)} className="input" placeholder="US" />
          </label>
          <button
            type="submit"
            disabled={createZone.isPending || !zoneName || !regions}
            className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Add zone
          </button>
        </form>
        {createZone.isError && (
          <p className="mt-2 text-sm text-red-600">
            {createZone.error instanceof ApiError ? createZone.error.message : "Something went wrong."}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Add a rate</h2>
        <form onSubmit={handleAddRate} className="space-y-2">
          <select value={rateZoneId} onChange={(e) => setRateZoneId(e.target.value)} className="input">
            <option value="">Select a zone</option>
            {zones.data?.map((z: any) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <input value={rateName} onChange={(e) => setRateName(e.target.value)} className="input" placeholder="Standard" />
          <select value={rateType} onChange={(e) => setRateType(e.target.value as any)} className="input">
            <option value="flat_rate">Flat rate</option>
            <option value="free_above_threshold">Free above threshold</option>
          </select>
          {rateType === "flat_rate" ? (
            <input value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} type="number" step="0.01" className="input" placeholder="Amount" />
          ) : (
            <input value={freeAboveAmount} onChange={(e) => setFreeAboveAmount(e.target.value)} type="number" step="0.01" className="input" placeholder="Free above amount" />
          )}
          <button
            type="submit"
            disabled={addRate.isPending || !rateZoneId || !rateName}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Add rate
          </button>
        </form>
      </section>
    </div>
  );
}
