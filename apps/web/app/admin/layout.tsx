"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMe, useLogout } from "@/lib/hooks";
import { getAccessToken } from "@/lib/auth";

/**
 * Same client-side auth-gate shape as dashboard/layout.tsx, plus one extra
 * check: `platform.super_admin` must be in the caller's permissions array.
 * Reuses the EXISTING staff login flow unmodified — a `super_admin`-role
 * User already has `tenantId: null`, and AuthService#login's subdomain-less
 * path already resolves that correctly (confirmed by reading auth.service.ts
 * directly) — no separate login system needed for the platform console.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  return (
    <div className="flex flex-1">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Platform Admin</p>
        <p className="mb-6 truncate text-xs text-zinc-500">{me.data?.user.email}</p>
        <nav className="space-y-1 text-sm">
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/admin">
            Overview
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/admin/tenants">
            Tenants
          </Link>
          <Link className="block rounded px-2 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900" href="/admin/plans">
            Plans
          </Link>
        </nav>
        <button
          onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/login") })}
          className="mt-6 w-full rounded-md border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
