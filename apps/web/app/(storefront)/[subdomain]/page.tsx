"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useStorefrontProducts } from "@/lib/hooks-storefront";
import { ApiError } from "@/lib/api-client";

export default function StorefrontHomePage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const products = useStorefrontProducts(subdomain);

  if (products.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;
  if (products.isError) {
    // NFR-AV-06 — a suspended/offboarded tenant gets a distinct, graceful
    // message rather than the generic "not found" (TenantResolverGuard's
    // own 403 TENANT_SUSPENDED, surfaced here via ApiError.code — both
    // frontend clients already preserve this from the error envelope).
    const suspended = products.error instanceof ApiError && products.error.code === "TENANT_SUSPENDED";
    return (
      <p className="p-8 text-sm text-red-600">
        {suspended ? "This store is temporarily unavailable." : "This store couldn't be found."}
      </p>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Shop</h1>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="flex h-48 w-full items-center justify-center bg-zinc-100 text-zinc-400 dark:bg-zinc-900">No image</div>
            )}
            <div className="p-4">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{p.name}</p>
              <p className="text-sm text-zinc-500">${Number(p.basePrice).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
      {products.data?.length === 0 && <p className="text-sm text-zinc-500">No products yet.</p>}
    </div>
  );
}
