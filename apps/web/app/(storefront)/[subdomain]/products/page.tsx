"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useStorefrontProducts, useStorefrontCategories } from "@/lib/hooks-storefront";

export default function StorefrontProductsPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  const categories = useStorefrontCategories(subdomain);
  const products = useStorefrontProducts(subdomain, {
    search: debouncedSearch || undefined,
    categoryId: categoryId || undefined,
  });

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">All Products</h1>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {categories.data && categories.data.length > 0 && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">All categories</option>
            {categories.data.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {(search || categoryId) && (
          <button
            onClick={() => { setSearch(""); setCategoryId(""); }}
            className="text-sm text-zinc-500 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {products.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.data?.map((p: any) => (
          <Link
            key={p.id}
            href={`/${subdomain}/products/${p.slug}`}
            className="block overflow-hidden rounded-lg border border-zinc-200 transition-shadow hover:shadow-md dark:border-zinc-800"
          >
            {p.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0].url} alt={p.name} className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
                No image
              </div>
            )}
            <div className="p-4">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
              {p.category && <p className="text-xs text-zinc-400">{p.category.name}</p>}
              <p className="mt-1 text-sm text-zinc-500">${Number(p.basePrice).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>

      {!products.isLoading && products.data?.length === 0 && (
        <p className="text-sm text-zinc-500">
          {search || categoryId ? "No products match your filters." : "No products yet."}
        </p>
      )}
    </div>
  );
}
