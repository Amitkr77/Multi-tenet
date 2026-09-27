"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useMe, useLogout } from "@/lib/hooks";
import { getAccessToken } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { hasAnyPermission } from "@/lib/permissions";

// ─── Nav structure ────────────────────────────────────────────────────────────
// Groups keep the sidebar scannable. Permission arrays are OR'd — any one
// matching permission grants visibility. Empty array = always visible.

const NAV_GROUPS = [
  {
    label: "Store",
    items: [
      { href: "/dashboard", label: "Overview", icon: "grid", permissions: [], exact: true },
      { href: "/dashboard/orders", label: "Orders", icon: "inbox", permissions: ["orders.view"] },
      { href: "/dashboard/products", label: "Products", icon: "tag", permissions: ["products.view", "products.manage"] },
      { href: "/dashboard/inventory", label: "Inventory", icon: "archive", permissions: ["inventory.view", "inventory.adjust"] },
      { href: "/dashboard/customers", label: "Customers", icon: "users", permissions: ["customers.view", "customers.manage"] },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/dashboard/coupons", label: "Coupons", icon: "ticket", permissions: ["coupons.manage"] },
      { href: "/dashboard/reviews", label: "Reviews", icon: "star", permissions: ["reviews.view", "reviews.moderate"] },
      { href: "/dashboard/analytics", label: "Analytics", icon: "bar-chart", permissions: ["analytics.view"] },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/dashboard/catalog", label: "Categories & Brands", icon: "folder", permissions: ["products.manage"] },
      { href: "/dashboard/warehouses", label: "Warehouses", icon: "building", permissions: ["inventory.view", "inventory.adjust"] },
      { href: "/dashboard/shipping", label: "Shipping", icon: "truck", permissions: ["shipping.view", "shipping.manage"] },
      { href: "/dashboard/tax", label: "Tax", icon: "percent", permissions: ["tax.view", "tax.manage"] },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/dashboard/users", label: "Team Members", icon: "user-plus", permissions: ["team.manage"] },
      { href: "/dashboard/roles", label: "Roles", icon: "shield", permissions: ["team.manage"] },
      { href: "/dashboard/audit-log", label: "Audit Log", icon: "list", permissions: ["audit_log.view"] },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/settings/general", label: "Store Settings", icon: "settings", permissions: ["settings.view", "settings.manage"] },
      { href: "/dashboard/settings/payments", label: "Payments", icon: "credit-card", permissions: ["payments.view", "billing.connect_payment_account"] },
      { href: "/dashboard/settings/billing", label: "Billing", icon: "receipt", permissions: ["billing.view", "billing.change_plan", "billing.view_invoices"] },
      { href: "/dashboard/settings/domains", label: "Domains", icon: "globe", permissions: ["settings.manage"] },
      { href: "/dashboard/settings/webhooks", label: "Webhooks", icon: "zap", permissions: ["webhooks.manage"] },
      { href: "/dashboard/settings/api-keys", label: "API Keys", icon: "key", permissions: ["api_keys.manage"] },
      { href: "/dashboard/settings/security", label: "Security", icon: "lock", permissions: [] },
      { href: "/dashboard/settings/compliance", label: "Data Export", icon: "download", permissions: ["compliance.manage"] },
    ],
  },
];

// Flat list for permission resolution on arbitrary paths
const NAV_ITEMS_FLAT = NAV_GROUPS.flatMap((g) => g.items);

function permissionsForPath(pathname: string): readonly string[] {
  if (pathname === "/dashboard/products/new") return ["products.manage"];
  const candidates = NAV_ITEMS_FLAT
    .filter((item) => !("exact" in item && item.exact) && item.href !== "/dashboard" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length);
  return candidates[0]?.permissions ?? [];
}

function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
      title={resolved === "dark" ? "Light mode" : "Dark mode"}
      className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
    >
      {resolved === "dark" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    if (!hasToken) { router.replace("/login"); return; }
    if (!me.isFetching && me.isError) router.replace("/login");
  }, [hasToken, me.isFetching, me.isError, router]);

  if (!hasToken || me.isFetching || me.isPending || me.isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  function isActive(item: { href: string; exact?: boolean }) {
    if ("exact" in item && item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  // Find the label of the current nav item for the top header
  const currentItem = NAV_ITEMS_FLAT.find((item) =>
    "exact" in item && item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <div className="flex min-h-screen flex-1">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {/* Store header */}
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {me.data?.tenant?.name ?? "Platform"}
              </p>
              <p className="truncate text-xs text-zinc-500">{me.data?.user.email}</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) =>
              hasAnyPermission(me.data?.permissions, item.permissions)
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label} className="mb-4">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const active = isActive(item);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center rounded-md px-2 py-1.5 text-sm transition-colors ${
                            active
                              ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                              : "font-normal text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                          }`}
                        >
                          {active && (
                            <span className="mr-2 h-1.5 w-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                          )}
                          {!active && <span className="mr-2 h-1.5 w-1.5" />}
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-2 py-3 dark:border-zinc-800">
          {me.data?.tenant && (
            <a
              href={`/${me.data.tenant.subdomain}`}
              target="_blank"
              rel="noreferrer"
              className="mb-1 flex w-full items-center rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
            >
              <svg className="mr-2 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View storefront
            </a>
          )}
          <button
            onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/login") })}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
          >
            <svg className="mr-2 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {currentItem?.label ?? "Dashboard"}
          </p>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {me.data?.tenant?.status === "trial" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Trial
              </span>
            )}
            <span className="hidden sm:inline">{me.data?.tenant?.subdomain}</span>
          </div>
        </header>

        {/* Status banners */}
        <div>
          {me.data?.tenant?.status === "past_due" && (
            <div className="border-b border-amber-300 bg-amber-50 px-6 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Your last payment failed.{" "}
              <Link href="/dashboard/settings/billing" className="font-medium underline">Update billing</Link>{" "}
              to avoid suspension.
            </div>
          )}
          {me.data?.tenant?.status === "suspended" && (
            <div className="border-b border-red-300 bg-red-50 px-6 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              Your account is suspended — storefront is offline.{" "}
              <Link href="/dashboard/settings/billing" className="font-medium underline">Resolve billing</Link>{" "}
              to reactivate.
            </div>
          )}
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {canAccessPage ? (
            children
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950">
              <h1 className="font-semibold text-amber-900 dark:text-amber-100">Access denied</h1>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                You don't have permission to view this page. Ask a store admin to update your role.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
