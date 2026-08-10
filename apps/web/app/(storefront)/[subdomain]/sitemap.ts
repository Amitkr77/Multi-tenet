import type { MetadataRoute } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function fetchPublicProducts(subdomain: string): Promise<{ slug: string; updatedAt?: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/storefront/products?limit=500`, {
      headers: { "X-Tenant-Subdomain": subdomain },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function sitemap({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<MetadataRoute.Sitemap> {
  const { subdomain } = await params;
  const base = `${APP_URL}/${subdomain}`;
  const products = await fetchPublicProducts(subdomain);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, priority: 1.0, changeFrequency: "weekly" },
    { url: `${base}/products`, priority: 0.9, changeFrequency: "daily" },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
    priority: 0.8,
    changeFrequency: "weekly",
  }));

  return [...staticRoutes, ...productRoutes];
}
