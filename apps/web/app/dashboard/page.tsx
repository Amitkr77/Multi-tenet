"use client";

import Link from "next/link";
import { useMe } from "@/lib/hooks";
import { useProducts, useTenantProfile, useWarehouses, useShippingZones } from "@/lib/hooks-catalog";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
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
    <svg className="h-5 w-5 shrink-0 text-zinc-300 dark:text-zinc-600" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  );
}

export default function DashboardHomePage() {
  const me = useMe();
  const profile = useTenantProfile();
  const products = useProducts();
  const warehouses = useWarehouses();
  const shipping = useShippingZones();

  const tenant = me.data?.tenant;
  const isLoading = profile.isLoading || products.isLoading || warehouses.isLoading || shipping.isLoading;

  const checklist: ChecklistItem[] = [
    {
      id: "store_name",
      label: "Name your store",
      description: "Set your store name and currency in Store Settings.",
      href: "/dashboard/settings/general",
      done: !!(profile.data?.name && profile.data.name !== profile.data?.subdomain),
    },
    {
      id: "first_product",
      label: "Add your first product",
      description: "Create a product with at least one variant so customers can browse and buy.",
      href: "/dashboard/products/new",
      done: (products.data?.length ?? 0) > 0,
    },
    {
      id: "warehouse",
      label: "Create a warehouse",
      description: "Add a warehouse so you can track inventory levels.",
      href: "/dashboard/warehouses",
      done: (warehouses.data?.length ?? 0) > 0,
    },
    {
      id: "shipping",
      label: "Set up a shipping zone",
      description: "Define where you ship and the rates you charge.",
      href: "/dashboard/shipping",
      done: (shipping.data?.length ?? 0) > 0,
    },
    {
      id: "payment",
      label: "Configure payments",
      description: "Connect Stripe to accept credit card payments in your store.",
      href: "/dashboard/settings/payments",
      done: !!(profile.data as any)?.stripeConnected,
    },
    {
      id: "domain",
      label: "Add a custom domain",
      description: "Point your own domain at your storefront for a professional look.",
      href: "/dashboard/settings/domains",
      done: false, // always prompt — we don't track custom domain state in the profile
    },
  ];

  const completedCount = checklist.filter((c) => c.done).length;
  const progress = Math.round((completedCount / checklist.length) * 100);
  const allDone = completedCount === checklist.length;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome back{me.data?.user.email ? `, ${me.data.user.email.split("@")[0]}` : ""}
        </h1>
        {tenant && (
          <p className="mt-1 text-sm text-zinc-500">
            {tenant.name} · <span className="font-mono">{tenant.subdomain}</span>
          </p>
        )}
      </div>

      {/* Onboarding checklist */}
      {!isLoading && !allDone && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Getting started — {completedCount}/{checklist.length} done
            </h2>
            <span className="text-xs text-zinc-500">{progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
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
                      <Link
                        href={item.href}
                        className="text-xs text-brand-600 hover:underline"
                      >
                        Go →
                      </Link>
                    )}
                  </div>
                  {!item.done && (
                    <p className="mt-0.5 text-xs text-zinc-500">{item.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {allDone && !isLoading && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          Your store is fully set up. Everything looks good!
        </div>
      )}

      {/* Quick stats */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Quick links</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Products", href: "/dashboard/products" },
            { label: "Orders", href: "/dashboard/orders" },
            { label: "Customers", href: "/dashboard/customers" },
            { label: "Coupons", href: "/dashboard/coupons" },
            { label: "Analytics", href: "/dashboard/analytics" },
            { label: "Audit Log", href: "/dashboard/audit-log" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-zinc-200 p-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
