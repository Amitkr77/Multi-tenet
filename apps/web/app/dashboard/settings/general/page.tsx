"use client";

import { useEffect, useState } from "react";
import { useTenantProfile, useUpdateTenantProfile } from "@/lib/hooks-catalog";
import { COMMON_CURRENCIES, COMMON_TIMEZONES } from "@/lib/format-currency";
import { ApiError } from "@/lib/api-client";

export default function StoreSettingsPage() {
  const profile = useTenantProfile();
  const update = useUpdateTenantProfile();

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form once data loads
  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name ?? "");
    setLogoUrl(profile.data.logoUrl ?? "");
    setCurrency((profile.data.currency ?? "usd").toUpperCase());
    setTimezone(profile.data.timezone ?? "UTC");
  }, [profile.data]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    update.mutate(
      {
        name: name || undefined,
        logoUrl: logoUrl || undefined,
        currency: currency.toLowerCase(),
        timezone: timezone || undefined,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to save settings."),
      },
    );
  }

  if (profile.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Store Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Store name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Inc"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Logo URL <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://cdn.example.com/logo.png"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Store currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {COMMON_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            This currency is used to display all prices and order totals in your dashboard.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700 dark:text-green-400">Settings saved.</p>}

        <button
          type="submit"
          disabled={update.isPending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {update.isPending ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
