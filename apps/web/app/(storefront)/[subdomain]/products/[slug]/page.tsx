import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

async function fetchProductForMeta(subdomain: string, slug: string) {
  try {
    const res = await fetch(`${API_BASE}/storefront/products/${slug}`, {
      headers: { "X-Tenant-Subdomain": subdomain },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ name: string; description?: string; images?: { url: string }[] }>;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string; slug: string }>;
}): Promise<Metadata> {
  const { subdomain, slug } = await params;
  const product = await fetchProductForMeta(subdomain, slug);
  if (!product) return { title: "Product" };

  const description = product.description ?? `Buy ${product.name} from ${subdomain}`;
  const image = product.images?.[0]?.url;

  return {
    title: `${product.name} | ${subdomain}`,
    description,
    openGraph: {
      title: product.name,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
