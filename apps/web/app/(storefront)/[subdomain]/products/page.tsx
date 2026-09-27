"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useStorefrontProducts, useStorefrontCategories, useStorefrontTenant, useStorefrontBrands } from "@/lib/hooks-storefront";
import { formatMoney } from "@/lib/format-currency";

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="h-52 w-full animate-pulse bg-zinc-100 dark:bg-zinc-800" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export default function StorefrontProductsPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "");
  const [brandId, setBrandId] = useState("");
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  const tenant = useStorefrontTenant(subdomain);
  const currency = tenant.data?.currency ?? "USD";
  const categories = useStorefrontCategories(subdomain);
  const brands = useStorefrontBrands(subdomain);
  const products = useStorefrontProducts(subdomain, {
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    sort: sort !== "newest" ? sort : undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
  });

  const hasFilters = !!(search || categoryId || brandId || sort !== "newest" || minPrice || maxPrice);

  const clearAll = () => {
    setSearch(""); setCategoryId(""); setBrandId(""); setSort("newest"); setMinPrice(""); setMaxPrice("");
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {categoryId ? (categories.data?.find((c: any) => c.id === categoryId)?.name ?? "Products") : "All Products"}
        </h1>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters{hasFilters && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-brand-600" />}
        </button>
      </div>

      {/* Search bar */}
      <div className="mb-4 relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Sort by</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A–Z</option>
              </select>
            </div>

            {brands.data && brands.data.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Brand</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <option value="">All brands</option>
                  {brands.data.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Min price</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Max price</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Any"
                min="0"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          {hasFilters && (
            <button onClick={clearAll} className="mt-3 text-xs text-zinc-500 hover:text-zinc-700 hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Category pills */}
      {categories.data && categories.data.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryId("")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              !categoryId
                ? "bg-brand-600 text-white"
                : "border border-zinc-200 text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
            }`}
          >
            All
          </button>
          {categories.data.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id === categoryId ? "" : c.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                categoryId === c.id
                  ? "bg-brand-600 text-white"
                  : "border border-zinc-200 text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {products.isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : (products.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-20 text-center dark:border-zinc-800">
          <svg className="mx-auto mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-zinc-500">
            {hasFilters ? "No products match your filters." : "No products yet."}
          </p>
          {hasFilters && (
            <button onClick={clearAll} className="mt-2 text-sm text-brand-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.data!.map((p: any) => {
              const stock = p.variants?.reduce((s: number, v: any) =>
                s + (v.inventory?.reduce((si: number, i: any) => si + i.quantityOnHand, 0) ?? 0), 0) ?? 0;
              return (
                <Link
                  key={p.id}
                  href={`/${subdomain}/products/${p.slug}`}
                  className="group block overflow-hidden rounded-xl border border-zinc-200 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700"
                >
                  <div className="overflow-hidden bg-zinc-50 dark:bg-zinc-900">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0].url}
                        alt={p.name}
                        className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-52 w-full items-center justify-center text-zinc-300 dark:text-zinc-700">
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-zinc-900 transition-colors group-hover:text-brand-600 dark:text-zinc-50 dark:group-hover:text-brand-400">
                      {p.name}
                    </p>
                    {p.brand && <p className="mt-0.5 text-xs text-zinc-400">{p.brand.name}</p>}
                    {!p.brand && p.category && <p className="mt-0.5 text-xs text-zinc-400">{p.category.name}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {formatMoney(Number(p.basePrice), currency)}
                      </p>
                      {stock === 0 ? (
                        <span className="text-xs text-red-500">Out of stock</span>
                      ) : stock <= 5 ? (
                        <span className="text-xs text-amber-500">Only {stock} left</span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-zinc-400">{products.data!.length} products</p>
        </>
      )}
    </div>
  );
}
