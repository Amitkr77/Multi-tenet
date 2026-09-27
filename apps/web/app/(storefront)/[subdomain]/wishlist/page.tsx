"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWishlist, useRemoveFromWishlist, useStorefrontTenant } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { getCustomerAccessToken } from "@/lib/customer-auth";

export default function WishlistPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";
  const wishlist = useWishlist(subdomain, hasToken);
  const remove = useRemoveFromWishlist(subdomain);

  useEffect(() => {
    if (!hasToken) router.replace(`/${subdomain}/login`);
  }, [hasToken, subdomain, router]);

  if (!hasToken || wishlist.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mb-8" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="h-48 animate-pulse bg-zinc-100 dark:bg-zinc-800" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const items = wishlist.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        My Wishlist
        {items.length > 0 && (
          <span className="ml-2 text-base font-normal text-zinc-400">
            ({items.length} item{items.length !== 1 ? "s" : ""})
          </span>
        )}
      </h1>

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-20 text-center dark:border-zinc-800">
          <p className="text-4xl mb-3">♡</p>
          <p className="text-sm text-zinc-500">Your wishlist is empty.</p>
          <Link href={`/${subdomain}/products`} className="mt-3 inline-block text-sm text-brand-600 hover:underline">
            Browse products →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item: any) => {
            const p = item.product;
            if (!p) return null;
            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-zinc-200 transition-all hover:shadow-md dark:border-zinc-800"
              >
                <button
                  onClick={() => remove.mutate(p.id)}
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-red-400 shadow hover:text-red-600 dark:bg-zinc-900/90"
                  title="Remove from wishlist"
                >
                  ♥
                </button>
                <Link href={`/${subdomain}/products/${p.slug}`} className="block">
                  <div className="overflow-hidden bg-zinc-50 dark:bg-zinc-900">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0].url}
                        alt={p.name}
                        className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center text-zinc-300 dark:text-zinc-700">
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {formatMoney(Number(p.basePrice), currency)}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
