"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { useCustomerMe, useCustomerLogout } from "@/lib/hooks-storefront";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasCustomerToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const me = useCustomerMe(subdomain, hasCustomerToken);
  const logout = useCustomerLogout(subdomain);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <Link href={`/${subdomain}`} className="font-semibold text-zinc-900 dark:text-zinc-50">
          {subdomain}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href={`/${subdomain}/products`} className="text-zinc-600 hover:underline dark:text-zinc-400">
            Products
          </Link>
          {hasCustomerToken && me.data ? (
            <>
              <Link href={`/${subdomain}/cart`} className="text-zinc-600 hover:underline dark:text-zinc-400">
                Cart
              </Link>
              <Link href={`/${subdomain}/orders`} className="text-zinc-600 hover:underline dark:text-zinc-400">
                My Orders
              </Link>
              <Link href={`/${subdomain}/account`} className="text-zinc-600 hover:underline dark:text-zinc-400">
                Account
              </Link>
              <button
                onClick={() => logout.mutate(undefined, { onSuccess: () => router.push(`/${subdomain}`) })}
                className="text-zinc-600 hover:underline dark:text-zinc-400"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href={`/${subdomain}/login`} className="text-zinc-600 hover:underline dark:text-zinc-400">
                Log in
              </Link>
              <Link href={`/${subdomain}/register`} className="font-medium text-brand-600 hover:underline">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
