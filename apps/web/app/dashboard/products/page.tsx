"use client";

import { useState } from "react";
import Link from "next/link";
import { useProducts, useTenantProfile, useImportProductsCsv } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";
import { useMe } from "@/lib/hooks";
import { downloadReport } from "@/lib/api-client";

const STATUS_FILTERS = ["all", "published", "draft"] as const;

export default function ProductsListPage() {
  const products = useProducts();
  const me = useMe();
  const canManage = me.data?.permissions.includes("products.manage") ?? false;
  const importCsv = useImportProductsCsv();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  const filtered = (products.data ?? []).filter((p: any) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Products</h1>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/catalog" className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
              Catalog
            </Link>
            <button
              onClick={() => downloadReport("/products/export", "products.csv")}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Export CSV
            </button>
            <label className="cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
              {importCsv.isPending ? "Importing…" : "Import CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) importCsv.mutate(await file.text());
                  e.target.value = "";
                }}
              />
            </label>
            <Link
              href="/dashboard/products/new"
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              + New product
            </Link>
          </div>
        )}
      </div>

      {importCsv.isError && (
        <p className="text-sm text-red-600">Import failed. Check the CSV columns and values.</p>
      )}
      {importCsv.isSuccess && (
        <p className="text-sm text-green-600">Import complete.</p>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="flex-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-brand-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {products.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            {search || statusFilter !== "all" ? "No products match your filters." : "No products yet."}
          </p>
          {canManage && !search && statusFilter === "all" && (
            <Link href="/dashboard/products/new" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
              Add your first product →
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Variants</th>
                <th className="px-4 py-3">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
              {filtered.map((p: any) => {
                const totalStock = p.variants.reduce(
                  (sum: number, v: any) =>
                    sum + v.inventory.reduce((s: number, i: any) => s + i.quantityOnHand, 0),
                  0,
                );
                const hasLowStock = p.variants.some((v: any) =>
                  v.inventory.some(
                    (i: any) =>
                      i.lowStockThreshold != null && i.quantityOnHand <= i.lowStockThreshold,
                  ),
                );
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          p.status === "published"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {formatMoney(Number(p.basePrice), currency)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{p.variants.length}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${hasLowStock ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {totalStock}
                      </span>
                      {hasLowStock && (
                        <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          low
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            {filtered.length} of {products.data?.length ?? 0} products
          </div>
        </div>
      )}
    </div>
  );
}
