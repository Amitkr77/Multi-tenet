"use client";

import { useMe } from "@/lib/hooks";
import { getAccessToken } from "@/lib/auth";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="ml-4 text-right text-sm font-medium text-zinc-900 dark:text-zinc-50">{value}</span>
    </div>
  );
}

const SERVICE_URLS = [
  { name: "Web (Next.js)", url: "http://localhost:3000" },
  { name: "API (NestJS)", url: "http://localhost:3001/api/v1" },
  { name: "API Docs (Swagger)", url: "http://localhost:3001/api/docs" },
  { name: "API Health", url: "http://localhost:3001/api/v1/health" },
];

const SEEDED_TENANTS = [
  { subdomain: "alpha", email: "owner@alpha.test" },
  { subdomain: "beta", email: "owner@beta.test" },
  { subdomain: "gamma", email: "owner@gamma.test" },
];

export default function AdminSettingsPage() {
  const hasToken = typeof window !== "undefined" && !!getAccessToken();
  const me = useMe(hasToken);

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>

      {/* Platform account */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Platform account</h2>
        <p className="mb-3 text-xs text-zinc-500">Your Super Admin identity on this platform.</p>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
          <InfoRow label="Email" value={me.data?.user.email ?? "—"} />
          <InfoRow label="User ID" value={
            <code className="font-mono text-xs text-zinc-500">{me.data?.user.id ?? "—"}</code>
          } />
          <InfoRow label="Roles" value={me.data?.roles.join(", ") ?? "—"} />
          <InfoRow label="2FA" value={
            me.data?.user.twoFactorEnabled ? (
              <span className="text-green-600 dark:text-green-400">Enabled</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">Disabled</span>
            )
          } />
        </div>
      </section>

      {/* Service URLs */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Service URLs</h2>
        <p className="mb-3 text-xs text-zinc-500">Local development service endpoints.</p>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-800">
          {SERVICE_URLS.map(({ name, url }) => (
            <div key={url} className="flex items-center justify-between py-3">
              <span className="text-sm text-zinc-500">{name}</span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-brand-600 hover:underline"
              >
                {url}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Seeded tenants quick links */}
      <section>
        <h2 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Seeded tenants</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Tenants created by the seed script. Password for all: <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Password123!</code>
        </p>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {SEEDED_TENANTS.map(({ subdomain, email }) => (
            <div key={subdomain} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{subdomain}</p>
                <p className="text-xs text-zinc-500">{email}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/${subdomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Storefront
                </a>
                <a
                  href="/login"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Dashboard login
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Admin credentials reminder */}
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Super Admin credentials</p>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-500">
          Email: <code className="font-mono">superadmin@platform.test</code> · Password:{" "}
          <code className="font-mono">Password123!</code> · Leave subdomain blank at login.
        </p>
      </section>
    </div>
  );
}
