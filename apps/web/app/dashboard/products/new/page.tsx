"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProductSchema, type CreateProductDto } from "@saas/shared-types";
import { useCategories, useBrands, useCreateProduct } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function NewProductPage() {
  const router = useRouter();
  const categories = useCategories();
  const brands = useBrands();
  const createProduct = useCreateProduct();
  const [autoSlug, setAutoSlug] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateProductDto>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { status: "draft", variant: { sku: "", options: {}, initialStock: 0 } },
  });

  const name = watch("name");

  const onNameChange = (value: string) => {
    setValue("name", value);
    if (autoSlug) {
      setValue("slug", value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    }
  };

  const onSubmit = handleSubmit((dto) => {
    createProduct.mutate(dto, {
      onSuccess: (product) => router.push(`/dashboard/products/${product.id}`),
    });
  });

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">New product</h1>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</span>
          <input className="input" value={name ?? ""} onChange={(e) => onNameChange(e.target.value)} />
          {errors.name && <span className="block text-xs text-red-600">{errors.name.message}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Slug</span>
          <input {...register("slug")} className="input" onChange={() => setAutoSlug(false)} />
          {errors.slug && <span className="block text-xs text-red-600">{errors.slug.message}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Base price</span>
          <input {...register("basePrice", { valueAsNumber: true })} type="number" step="0.01" className="input" />
          {errors.basePrice && <span className="block text-xs text-red-600">{errors.basePrice.message}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Category</span>
          <select {...register("categoryId")} className="input">
            <option value="">—</option>
            {categories.data?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Brand</span>
          <select {...register("brandId")} className="input">
            <option value="">—</option>
            {brands.data?.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</span>
          <select {...register("status")} className="input">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <fieldset className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">First variant</legend>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">SKU</span>
            <input {...register("variant.sku")} className="input" />
            {errors.variant?.sku && <span className="block text-xs text-red-600">{errors.variant.sku.message}</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Initial stock</span>
            <input {...register("variant.initialStock", { valueAsNumber: true })} type="number" className="input" />
          </label>
        </fieldset>

        {createProduct.isError && (
          <p className="text-sm text-red-600">
            {createProduct.error instanceof ApiError ? createProduct.error.message : "Something went wrong."}
          </p>
        )}

        <button
          type="submit"
          disabled={createProduct.isPending}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {createProduct.isPending ? "Creating…" : "Create product"}
        </button>
      </form>
    </div>
  );
}
