"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useStorefrontProducts, useStorefrontTenant, useStorefrontCategories } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";
import { ApiError } from "@/lib/api-client";

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="h-52 w-full animate-pulse bg-zinc-100 dark:bg-zinc-800" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

function ProductCard({ p, subdomain, currency }: { p: any; subdomain: string; currency: string }) {
  return (
    <Link
      href={`/${subdomain}/products/${p.slug}`}
      className="group block overflow-hidden rounded-xl border border-zinc-200 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
    >
      <div className="relative overflow-hidden bg-zinc-50 dark:bg-zinc-900">
        {p.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.images[0].url}
            alt={p.name}
            className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-52 w-full items-center justify-center text-zinc-300 dark:text-zinc-700">
            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {p.status === "draft" && (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-200">Draft</span>
        )}
      </div>
      <div className="p-4">
        <p className="font-medium text-zinc-900 dark:text-zinc-50 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {p.name}
        </p>
        {p.category && <p className="mt-0.5 text-xs text-zinc-400">{p.category.name}</p>}
        <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {formatMoney(Number(p.basePrice), currency)}
        </p>
      </div>
    </Link>
  );
}

export default function StorefrontHomePage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const products = useStorefrontProducts(subdomain);
  const tenant = useStorefrontTenant(subdomain);
  const categories = useStorefrontCategories(subdomain);
  const currency = tenant.data?.currency ?? "USD";
  const storeName = tenant.data?.name ?? subdomain;

  if (products.isError) {
    const suspended = products.error instanceof ApiError && products.error.code === "TENANT_SUSPENDED";
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          {suspended ? "This store is temporarily unavailable." : "This store couldn't be found."}
        </p>
      </div>
    );
  }

  const featured = products.data?.slice(0, 8) ?? [];
  const hasCategories = (categories.data?.length ?? 0) > 0;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-zinc-100 bg-linear-to-br from-zinc-50 to-white px-6 py-16 text-center dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <div className="mx-auto max-w-2xl">
          {tenant.isLoading ? (
            <div className="mx-auto mb-4 h-10 w-48 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          ) : (
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{storeName}</h1>
          )}
          <p className="mt-3 text-base text-zinc-500 dark:text-zinc-400">
            Discover our curated collection of quality products
          </p>
          <Link
            href={`/${subdomain}/products`}
            className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Shop all products
          </Link>
        </div>
      </section>

      {/* Category pills */}
      {hasCategories && (
        <section className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl flex flex-wrap gap-2">
            <Link
              href={`/${subdomain}/products`}
              className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
            >
              All
            </Link>
            {categories.data?.map((c: any) => (
              <Link
                key={c.id}
                href={`/${subdomain}/products?categoryId=${c.id}`}
                className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Featured products</h2>
          <Link href={`/${subdomain}/products`} className="text-sm text-brand-600 hover:underline">
            View all →
          </Link>
        </div>

        {products.isLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : featured.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 py-16 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500">No products yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p: any) => (
              <ProductCard key={p.id} p={p} subdomain={subdomain} currency={currency} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
