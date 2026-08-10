"use client";

import Link from "next/link";
import { useProducts, useTenantProfile } from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";

export default function ProductsListPage() {
  const products = useProducts();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Products</h1>
        <Link href="/dashboard/products/new" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          New product
        </Link>
      </div>

      {products.isLoading && <p className="text-sm text-zinc-500">Loading…</p>}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">Variants</th>
              <th className="px-4 py-2 font-medium">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {products.data?.map((p: any) => {
              const totalStock = p.variants.reduce(
                (sum: number, v: any) => sum + v.inventory.reduce((s: number, i: any) => s + i.quantityOnHand, 0),
                0,
              );
              return (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/products/${p.id}`} className="font-medium text-brand-600 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.status === "published"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{formatMoney(Number(p.basePrice), currency)}</td>
                  <td className="px-4 py-2">{p.variants.length}</td>
                  <td className="px-4 py-2">{totalStock}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.data?.length === 0 && <p className="p-4 text-sm text-zinc-500">No products yet.</p>}
      </div>
    </div>
  );
}
