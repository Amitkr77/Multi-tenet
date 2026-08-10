"use client";

import { useParams, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  useProduct,
  useUpdateProduct,
  useUploadProductImage,
  useAddVariant,
  useCategories,
  useBrands,
  useTenantProfile,
} from "@/lib/hooks-catalog";
import { formatMoney } from "@/lib/format-currency";
import { ApiError } from "@/lib/api-client";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useProduct(id);
  const updateProduct = useUpdateProduct();
  const uploadImage = useUploadProductImage();
  const addVariant = useAddVariant();
  const categories = useCategories();
  const brands = useBrands();
  const profile = useTenantProfile();
  const currency = (profile.data?.currency ?? "usd").toUpperCase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Variant form state
  const [newSku, setNewSku] = useState("");
  const [newStock, setNewStock] = useState(0);

  // Populate form from loaded product
  useEffect(() => {
    if (!product.data) return;
    const p = product.data;
    setName(p.name ?? "");
    setSlug(p.slug ?? "");
    setDescription(p.description ?? "");
    setBasePrice(String(p.basePrice ?? ""));
    setStatus(p.status ?? "draft");
    setCategoryId(p.categoryId ?? "");
    setBrandId(p.brandId ?? "");
  }, [product.data]);

  if (product.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!product.data) return <p className="text-sm text-red-600">Product not found.</p>;

  const p = product.data;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage.mutate({ productId: p.id, file });
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    updateProduct.mutate(
      {
        id: p.id,
        dto: {
          name: name || undefined,
          slug: slug || undefined,
          description: description || undefined,
          basePrice: Number(basePrice),
          status,
          categoryId: categoryId || undefined,
          brandId: brandId || undefined,
        },
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setSaveError(err instanceof ApiError ? err.message : "Failed to save."),
      },
    );
  };

  const onAddVariant = (e: React.FormEvent) => {
    e.preventDefault();
    addVariant.mutate(
      { productId: p.id, dto: { sku: newSku, options: {}, initialStock: newStock } },
      { onSuccess: () => setNewSku("") },
    );
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Details edit form */}
      <section>
        <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Edit Product</h1>
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Base price</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                className="input"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
                <option value="">— none —</option>
                {categories.data?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Brand</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="input">
                <option value="">— none —</option>
                {brands.data?.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saved && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={updateProduct.isPending}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {updateProduct.isPending ? "Saving…" : "Save changes"}
            </button>
            <span className="text-sm text-zinc-500">
              Currently {formatMoney(Number(p.basePrice), currency)} · {p.status}
            </span>
          </div>
        </form>
      </section>

      {/* Images */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Images</h2>
        <div className="flex flex-wrap gap-3">
          {p.images.map((img: any) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={img.id}
              src={img.url}
              alt=""
              className="h-24 w-24 rounded-md border border-zinc-200 object-cover dark:border-zinc-800"
            />
          ))}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="text-sm" />
        {uploadImage.isPending && <p className="text-xs text-zinc-500">Uploading…</p>}
      </section>

      {/* Variants */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Variants</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-1 font-medium">SKU</th>
              <th className="py-1 font-medium">Options</th>
              <th className="py-1 font-medium">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {p.variants.map((v: any) => (
              <tr key={v.id}>
                <td className="py-1.5">{v.sku}</td>
                <td className="py-1.5">
                  {v.options && Object.keys(v.options).length > 0
                    ? Object.entries(v.options)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(", ")
                    : "—"}
                </td>
                <td className="py-1.5">{v.inventory.reduce((s: number, i: any) => s + i.quantityOnHand, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <form onSubmit={onAddVariant} className="flex items-end gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">New SKU</span>
            <input value={newSku} onChange={(e) => setNewSku(e.target.value)} className="input" required />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Stock</span>
            <input
              type="number"
              value={newStock}
              onChange={(e) => setNewStock(Number(e.target.value))}
              className="input w-24"
            />
          </label>
          <button
            type="submit"
            disabled={addVariant.isPending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Add variant
          </button>
        </form>
      </section>
    </div>
  );
}
