"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useMe, useLogout } from "@/lib/hooks";
import { getAccessToken } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { hasAnyPermission } from "@/lib/permissions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", permissions: [] },
  { href: "/dashboard/products", label: "Products", permissions: ["products.view", "products.manage"] },
  { href: "/dashboard/catalog", label: "Categories & Brands", permissions: ["products.manage"] },
  { href: "/dashboard/inventory", label: "Inventory", permissions: ["inventory.view", "inventory.adjust"] },
  { href: "/dashboard/warehouses", label: "Warehouses", permissions: ["inventory.view", "inventory.adjust"] },
  { href: "/dashboard/orders", label: "Orders", permissions: ["orders.view"] },
  { href: "/dashboard/customers", label: "Customers", permissions: ["customers.view", "customers.manage"] },
  { href: "/dashboard/coupons", label: "Coupons", permissions: ["coupons.manage"] },
  { href: "/dashboard/shipping", label: "Shipping", permissions: ["shipping.view", "shipping.manage"] },
  { href: "/dashboard/tax", label: "Tax", permissions: ["tax.view", "tax.manage"] },
  { href: "/dashboard/reviews", label: "Reviews", permissions: ["reviews.view", "reviews.moderate"] },
  { href: "/dashboard/analytics", label: "Analytics", permissions: ["analytics.view"] },
  { href: "/dashboard/users", label: "Team", permissions: ["team.manage"] },
  { href: "/dashboard/roles", label: "Roles", permissions: ["team.manage"] },
  { href: "/dashboard/settings/general", label: "Store Settings", permissions: ["settings.view", "settings.manage"] },
  { href: "/dashboard/settings/payments", label: "Payments", permissions: ["payments.view", "billing.connect_payment_account"] },
  { href: "/dashboard/settings/billing", label: "Billing", permissions: ["billing.view", "billing.change_plan", "billing.view_invoices"] },
  { href: "/dashboard/settings/domains", label: "Domains", permissions: ["settings.manage"] },
  { href: "/dashboard/settings/webhooks", label: "Webhooks", permissions: ["webhooks.manage"] },
  { href: "/dashboard/settings/api-keys", label: "API Keys", permissions: ["api_keys.manage"] },
  { href: "/dashboard/settings/security", label: "Security (2FA)", permissions: [] },
  { href: "/dashboard/settings/compliance", label: "Data Export", permissions: ["compliance.manage"] },
  { href: "/dashboard/audit-log", label: "Audit Log", permissions: ["audit_log.view"] },
] as const;

function permissionsForPath(pathname: string): readonly string[] {
  if (pathname === "/dashboard/products/new") return ["products.manage"];
  const candidates = NAV_ITEMS
    .filter((item) => item.href !== "/dashboard" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length);
  return candidates[0]?.permissions ?? [];
}

/**
 * Client-side auth gate. Note this is NOT edge middleware (see the mostly-
 * empty middleware.ts) — the refresh-token cookie is set on the API's own
 * origin (localhost:3001) scoped to `/api/v1/auth`, so a Next.js middleware
 * running for localhost:3000 requests has no access to it at all (different
 * origin, cookies aren't shared cross-origin). Gating here, client-side,
 * against the in-memory/sessionStorage access token + a live `/auth/me`
 * call, is the correct boundary until both apps share an origin (e.g. behind
 * one reverse proxy) — deferred, not needed for Phase 1's localhost dev flow.
 */
function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {resolved === "dark" ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasToken = typeof window !== "undefined" && !!getAccessToken();
  const me = useMe(hasToken);
  const logout = useLogout();
  const canAccessPage = hasAnyPermission(me.data?.permissions, permissionsForPath(pathname));

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
      return;
    }
    // `me.isError` alone isn't trustworthy on the FIRST render of a freshly
    // mounted observer — TanStack Query serves the (possibly stale/errored)
    // cached entry for this queryKey synchronously before its own enabled
    // fetch has resolved. A prior failed /auth/me (e.g. from logout, whose
    // `invalidateQueries(["me"])` marks the cache stale) can otherwise read
    // as an error for a few milliseconds even though this mount's own
    // request is already in flight and about to succeed — redirecting away
    // from a dashboard the user just legitimately logged into. Waiting for
    // `!me.isFetching` means we only act once THIS mount's own attempt has
    // actually settled.
    if (!me.isFetching && me.isError) {
      router.replace("/login");
    }
  }, [hasToken, me.isFetching, me.isError, router]);

  if (!hasToken || me.isFetching || me.isPending || me.isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{me.data?.tenant?.name ?? "Platform"}</p>
          <ThemeToggle />
        </div>
        <p className="mb-6 truncate text-xs text-zinc-500">{me.data?.user.email}</p>
        <nav className="space-y-1 text-sm">
          {NAV_ITEMS.filter((item) => hasAnyPermission(me.data?.permissions, item.permissions)).map((item) => (
            <Link key={item.href} className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href={item.href}>
              {item.label}
            </Link>
          ))}
          {/*
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard">
            Overview
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/products">
            Products
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/inventory">
            Inventory
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/warehouses">
            Warehouses
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/orders">
            Orders
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/customers">
            Customers
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/coupons">
            Coupons
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/shipping">
            Shipping
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/tax">
            Tax
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/general">
            Store Settings
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/payments">
            Payments
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/reviews">
            Reviews
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/analytics">
            Analytics
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/users">
            Team
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/roles">
            Roles
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/billing">
            Billing
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/domains">
            Domains
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/webhooks">
            Webhooks
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/api-keys">
            API Keys
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/security">
            Security (2FA)
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/settings/compliance">
            Data Export
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/dashboard/audit-log">
            Audit Log
          </Link>
          */}
        </nav>
        <button
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/login") })}
          className="mt-6 w-full rounded-md border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 p-8">
        {/* Reachable BY DESIGN for a past_due/suspended tenant — the dashboard's
            own api-client.ts never sends X-Tenant-Subdomain, so TenantResolverGuard
            resolves tenantId purely from the JWT and never blocks these requests
            the way it blocks the customer-facing storefront. A suspended tenant
            must still be able to reach this page to fix their billing. */}
        {me.data?.tenant?.status === "past_due" && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Your last payment failed.{" "}
            <Link href="/dashboard/settings/billing" className="font-medium underline">
              Update your billing details
            </Link>{" "}
            to avoid your account being suspended.
          </div>
        )}
        {me.data?.tenant?.status === "suspended" && (
          <div className="mb-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            Your account is suspended and your storefront is unavailable to customers.{" "}
            <Link href="/dashboard/settings/billing" className="font-medium underline">
              Resolve billing
            </Link>{" "}
            to reactivate.
          </div>
        )}
        {canAccessPage ? (
          children
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950">
            <h1 className="font-semibold text-amber-900 dark:text-amber-100">You do not have access to this page</h1>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Ask a tenant administrator if your role needs additional permissions.</p>
          </div>
        )}
      </main>
    </div>
  );
}
