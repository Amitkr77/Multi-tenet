"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useMe, useLogout } from "@/lib/hooks";
import { getAccessToken } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/tenants", label: "Tenants", exact: false },
  { href: "/admin/plans", label: "Plans", exact: false },
  { href: "/admin/activity", label: "Activity Log", exact: false },
  { href: "/admin/settings", label: "Settings", exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasToken = typeof window !== "undefined" && !!getAccessToken();
  const me = useMe(hasToken);
  const logout = useLogout();
  const isSuperAdmin = me.data?.permissions?.includes("platform.super_admin") ?? false;

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
      return;
    }
    if (!me.isFetching && (me.isError || (me.data && !isSuperAdmin))) {
      router.replace("/login");
    }
  }, [hasToken, me.isFetching, me.isError, me.data, isSuperAdmin, router]);

  if (!hasToken || me.isFetching || me.isPending || me.isError || !isSuperAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  function isActive(item: { href: string; exact: boolean }) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <div className="flex min-h-screen flex-1">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {/* Brand header */}
        <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
              P
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Platform Admin</p>
              <p className="truncate text-xs text-zinc-500">{me.data?.user.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Console
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                    }`}
                  >
                    <span
                      className={`mr-2 h-1.5 w-1.5 rounded-full ${
                        active ? "bg-brand-600" : "bg-transparent"
                      }`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
          <button
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => router.push("/login") })
            }
            className="flex w-full items-center rounded-md px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
          >
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-12 items-center border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
          <Breadcrumb pathname={pathname} />
        </header>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  // Build crumbs: ["admin"] → ["admin", "tenants"] → etc.
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label =
      seg === "admin" ? "Platform Admin" :
      seg.length === 36 && /^[0-9a-f-]+$/.test(seg) ? "Detail" :
      seg.charAt(0).toUpperCase() + seg.slice(1);
    return { href, label };
  });

  return (
    <nav className="flex items-center gap-1 text-sm text-zinc-500">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">/</span>}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-zinc-700 dark:hover:text-zinc-300">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
