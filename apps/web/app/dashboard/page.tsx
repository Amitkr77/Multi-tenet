"use client";

import Link from "next/link";
import { useMe } from "@/lib/hooks";
import {
  useProducts,
  useTenantProfile,
  useWarehouses,
  useShippingZones,
  useOrders,
  useAnalyticsRevenue,
  useAnalyticsOrders,
  useAnalyticsInventory,
} from "@/lib/hooks-catalog";
import { hasAnyPermission } from "@/lib/permissions";
import { formatMoney } from "@/lib/format-currency";

// Today's date range helper
function todayRange() {
  const today = new Date();
  const from = today.toISOString().split("T")[0];
  return { from, to: from, granularity: "day" as const };
}

function thisMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const to = now.toISOString().split("T")[0];
  return { from, to, granularity: "day" as const };
}

function StatCard({
  label, value, sub, trend, href, loading,
}: {
  label: string; value: string | number; sub?: string;
  trend?: { direction: "up" | "down" | "neutral"; label: string };
  href?: string; loading?: boolean;
}) {
  const inner = (
    <div className={`rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 ${href ? "transition-shadow hover:shadow-sm" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
          {trend && (
            <p className={`mt-2 text-xs font-medium ${
              trend.direction === "up" ? "text-green-600 dark:text-green-400" :
              trend.direction === "down" ? "text-red-500" : "text-zinc-400"
            }`}>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "—"} {trend.label}
            </p>
          )}
        </>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <svg className="h-5 w-5 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-600" />
  );
}

const ORDER_STATUS_BADGE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  paid: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  fulfilled: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  shipped: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  refunded: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function DashboardHomePage() {
  const me = useMe();
  const permissions = me.data?.permissions ?? [];

  const canOnboard = ["settings.manage", "products.manage", "inventory.manage_alerts", "shipping.manage"]
    .every((p) => permissions.includes(p));
  const canViewAnalytics = hasAnyPermission(permissions, ["analytics.view"]);
  const canViewOrders = hasAnyPermission(permissions, ["orders.view"]);
  const canViewInventory = hasAnyPermission(permissions, ["inventory.view", "inventory.adjust"]);

  const profile = useTenantProfile(canOnboard);
  const products = useProducts(canOnboard);
  const warehouses = useWarehouses(canOnboard);
  const shipping = useShippingZones(canOnboard);
  const orders = useOrders(undefined, canViewOrders);
  const revenueToday = useAnalyticsRevenue(todayRange());
  const revenueMonth = useAnalyticsRevenue(thisMonthRange());
  const ordersMonth = useAnalyticsOrders(thisMonthRange());
  const inventory = useAnalyticsInventory();

  const tenant = me.data?.tenant;
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  // Onboarding checklist
  const isOnboardingLoading = profile.isLoading || products.isLoading || warehouses.isLoading || shipping.isLoading;
  const checklist = [
    { id: "store_name", label: "Name your store", description: "Set your store name and currency.", href: "/dashboard/settings/general", done: !!(profile.data?.name && profile.data.name !== profile.data?.subdomain) },
    { id: "first_product", label: "Add your first product", description: "Create a product with at least one variant.", href: "/dashboard/products/new", done: (products.data?.length ?? 0) > 0 },
    { id: "warehouse", label: "Create a warehouse", description: "Add a warehouse to track inventory.", href: "/dashboard/warehouses", done: (warehouses.data?.length ?? 0) > 0 },
    { id: "shipping", label: "Set up shipping", description: "Define where you ship and rates.", href: "/dashboard/shipping", done: (shipping.data?.length ?? 0) > 0 },
    { id: "payment", label: "Configure payments", description: "Connect Stripe to accept payments.", href: "/dashboard/settings/payments", done: !!(profile.data as any)?.stripeConnected },
    { id: "domain", label: "Add a custom domain", description: "Point your own domain to your storefront.", href: "/dashboard/settings/domains", done: false },
  ];
  const completedCount = checklist.filter((c) => c.done).length;
  const progress = Math.round((completedCount / checklist.length) * 100);
  const allDone = completedCount === checklist.length;
  const showChecklist = canOnboard && !isOnboardingLoading && !allDone;

  // Stats
  const todayRevenue = revenueToday.data?.totalRevenue ?? 0;
  const monthRevenue = revenueMonth.data?.totalRevenue ?? 0;
  const totalOrdersMonth = ordersMonth.data?.totalOrders ?? 0;
  const lowStockCount = inventory.data?.lowStockItems?.length ?? 0;
  const recentOrders = (orders.data ?? []).slice(0, 8);
  const pendingOrderCount = (orders.data ?? []).filter((o: any) => o.status === "pending" || o.status === "paid").length;

  const statsLoading = revenueToday.isLoading || revenueMonth.isLoading || ordersMonth.isLoading;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome back{me.data?.user.email ? `, ${me.data.user.email.split("@")[0]}` : ""}
        </h1>
        {tenant && (
          <p className="mt-0.5 text-sm text-zinc-500">
            {tenant.name} · <span className="font-mono">{tenant.subdomain}</span>
          </p>
        )}
      </div>

      {/* Key metrics — only for users with analytics access */}
      {canViewAnalytics && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Today's revenue"
            value={formatMoney(todayRevenue, currency)}
            href="/dashboard/analytics"
            loading={statsLoading}
          />
          <StatCard
            label="This month"
            value={formatMoney(monthRevenue, currency)}
            sub="total revenue"
            href="/dashboard/analytics"
            loading={statsLoading}
          />
          <StatCard
            label="Orders this month"
            value={totalOrdersMonth}
            sub={pendingOrderCount > 0 ? `${pendingOrderCount} need attention` : "all clear"}
            trend={pendingOrderCount > 0 ? { direction: "neutral", label: `${pendingOrderCount} pending` } : undefined}
            href="/dashboard/orders"
            loading={statsLoading}
          />
          {canViewInventory && (
            <StatCard
              label="Low stock alerts"
              value={lowStockCount}
              sub={lowStockCount > 0 ? "items below threshold" : "all well stocked"}
              trend={lowStockCount > 0 ? { direction: "down", label: "needs restock" } : { direction: "neutral", label: "healthy" }}
              href="/dashboard/inventory"
              loading={inventory.isLoading}
            />
          )}
        </div>
      )}

      {/* Onboarding checklist */}
      {showChecklist && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Get your store ready — {completedCount}/{checklist.length}
              </h2>
              <p className="text-xs text-zinc-500">Complete these steps to start selling</p>
            </div>
            <span className="text-xs font-medium text-zinc-500">{progress}%</span>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <CheckIcon done={item.done} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${item.done ? "text-zinc-400 line-through dark:text-zinc-600" : "text-zinc-900 dark:text-zinc-50"}`}>
                      {item.label}
                    </span>
                    {!item.done && (
                      <Link href={item.href} className="text-xs text-brand-600 hover:underline">Set up →</Link>
                    )}
                  </div>
                  {!item.done && <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canOnboard && allDone && !isOnboardingLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Your store is fully set up and ready for customers!
        </div>
      )}

      {/* Recent orders */}
      {canViewOrders && recentOrders.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent orders</h2>
            <Link href="/dashboard/orders" className="text-xs text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {recentOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-xs font-medium text-brand-600 hover:underline">
                        #{order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {order.customer?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE[order.status] ?? ""}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                      {formatMoney(Number(order.grandTotal), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Quick links for lower-permission roles */}
      {!canViewAnalytics && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Quick links</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Products", href: "/dashboard/products", permissions: ["products.view", "products.manage"] },
              { label: "Orders", href: "/dashboard/orders", permissions: ["orders.view"] },
              { label: "Customers", href: "/dashboard/customers", permissions: ["customers.view", "customers.manage"] },
              { label: "Inventory", href: "/dashboard/inventory", permissions: ["inventory.view", "inventory.adjust"] },
              { label: "Coupons", href: "/dashboard/coupons", permissions: ["coupons.manage"] },
              { label: "Audit Log", href: "/dashboard/audit-log", permissions: ["audit_log.view"] },
            ].filter((l) => hasAnyPermission(permissions, l.permissions)).map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl border border-zinc-200 p-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
