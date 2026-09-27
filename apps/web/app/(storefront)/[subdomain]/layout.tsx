"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { useCustomerMe, useCustomerLogout, useCart, useStorefrontTenant, useWishlist } from "@/lib/hooks-storefront";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const me = useCustomerMe(subdomain, hasToken);
  const logout = useCustomerLogout(subdomain);
  const cart = useCart(subdomain, hasToken);
  const tenant = useStorefrontTenant(subdomain);
  const storeName = tenant.data?.name ?? subdomain;
  const cartCount = cart.data?.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) ?? 0;
  const wishlist = useWishlist(subdomain, hasToken);
  const wishlistCount = wishlist.data?.length ?? 0;

  const linkClass = (href: string) => {
    const isActive = pathname === href || (href !== `/${subdomain}` && pathname.startsWith(href));
    return `text-sm transition-colors ${isActive ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href={`/${subdomain}`} className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {storeName}
          </Link>

          <nav className="flex items-center gap-5">
            <Link href={`/${subdomain}/products`} className={linkClass(`/${subdomain}/products`)}>
              Products
            </Link>

            {hasToken && me.data ? (
              <>
                <Link href={`/${subdomain}/cart`} className={`relative ${linkClass(`/${subdomain}/cart`)}`}>
                  Cart
                  {cartCount > 0 && (
                    <span className="absolute -right-3 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      {cartCount > 9 ? "9+" : cartCount}
                    </span>
                  )}
                </Link>
                <Link href={`/${subdomain}/wishlist`} className={`relative ${linkClass(`/${subdomain}/wishlist`)}`}>
                  Wishlist
                  {wishlistCount > 0 && (
                    <span className="absolute -right-4 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {wishlistCount > 9 ? "9+" : wishlistCount}
                    </span>
                  )}
                </Link>
                <Link href={`/${subdomain}/orders`} className={linkClass(`/${subdomain}/orders`)}>
                  Orders
                </Link>
                <Link href={`/${subdomain}/account`} className={linkClass(`/${subdomain}/account`)}>
                  Account
                </Link>
                <button
                  onClick={() => logout.mutate(undefined, { onSuccess: () => router.push(`/${subdomain}`) })}
                  className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href={`/${subdomain}/login`} className={linkClass(`/${subdomain}/login`)}>
                  Log in
                </Link>
                <Link
                  href={`/${subdomain}/register`}
                  className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        {storeName} · Powered by SaaS Commerce
      </footer>
    </div>
  );
}
