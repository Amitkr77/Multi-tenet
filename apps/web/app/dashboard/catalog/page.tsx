"use client";

import { useState } from "react";
import { useBrands, useCategories, useCreateBrand, useCreateCategory } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CatalogSettingsPage() {
  const categories = useCategories();
  const brands = useBrands();
  const createCategory = useCreateCategory();
  const createBrand = useCreateBrand();
  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("");
  const [brandName, setBrandName] = useState("");

  const error = createCategory.error ?? createBrand.error;
  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Categories &amp; Brands</h1>
      {error && <p className="text-sm text-red-600">{error instanceof ApiError ? error.message : "Could not save catalog settings."}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 font-medium">Categories</h2>
          <div className="mb-4 space-y-2 text-sm">{categories.data?.map((item: any) => <p key={item.id}>{item.parent ? `${item.parent.name} / ` : ""}{item.name}</p>)}</div>
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); createCategory.mutate({ name: categoryName, slug: slugify(categoryName), parentId: parentId || undefined }, { onSuccess: () => { setCategoryName(""); setParentId(""); } }); }}>
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="input" placeholder="Category name" required />
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="input"><option value="">No parent</option>{categories.data?.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button disabled={createCategory.isPending} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add category</button>
          </form>
        </section>
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 font-medium">Brands</h2>
          <div className="mb-4 space-y-2 text-sm">{brands.data?.map((item: any) => <p key={item.id}>{item.name}</p>)}</div>
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); createBrand.mutate({ name: brandName, slug: slugify(brandName) }, { onSuccess: () => setBrandName("") }); }}>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="input" placeholder="Brand name" required />
            <button disabled={createBrand.isPending} className="rounded-md bg-brand-600 px-3 py-2 text-sm text-white disabled:opacity-50">Add brand</button>
          </form>
        </section>
      </div>
    </div>
  );
}
