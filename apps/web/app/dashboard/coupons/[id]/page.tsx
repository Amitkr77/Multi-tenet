"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateCouponSchema, type UpdateCouponDto } from "@saas/shared-types";
import { useCoupon, useUpdateCoupon, useDeleteCoupon } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function EditCouponPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const coupon = useCoupon(id);
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateCouponDto>({ resolver: zodResolver(updateCouponSchema) });

  useEffect(() => {
    if (!coupon.data) return;
    const c = coupon.data;
    reset({
      code: c.code,
      type: c.type,
      value: c.value,
      usageLimit: c.usageLimit ?? undefined,
      perCustomerLimit: c.perCustomerLimit ?? undefined,
      minOrderValue: c.minOrderValue ?? undefined,
      isActive: c.isActive,
    });
  }, [coupon.data, reset]);

  if (coupon.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!coupon.data) return <p className="text-sm text-red-600">Coupon not found.</p>;

  const onSubmit = handleSubmit((dto) => {
    updateCoupon.mutate({ id, dto }, { onSuccess: () => router.push("/dashboard/coupons") });
  });

  const handleDelete = () => {
    if (!window.confirm(`Delete coupon "${coupon.data.code}"? This cannot be undone.`)) return;
    deleteCoupon.mutate(id, { onSuccess: () => router.push("/dashboard/coupons") });
  };

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Edit coupon</h1>
        <button
          onClick={handleDelete}
          disabled={deleteCoupon.isPending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-950"
        >
          Delete
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</span>
          <input {...register("code")} className="input uppercase" />
          {errors.code && <span className="block text-xs text-red-600">{errors.code.message}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</span>
          <select {...register("type")} className="input">
            <option value="fixed">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Value</span>
          <input {...register("value", { valueAsNumber: true })} type="number" step="0.01" className="input" />
          {errors.value && <span className="block text-xs text-red-600">{errors.value.message}</span>}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Usage limit (optional)</span>
          <input {...register("usageLimit", { valueAsNumber: true })} type="number" className="input" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Per-customer limit (optional)</span>
          <input {...register("perCustomerLimit", { valueAsNumber: true })} type="number" className="input" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Minimum order value (optional)</span>
          <input {...register("minOrderValue", { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded" />
          Active
        </label>

        {updateCoupon.isError && (
          <p className="text-sm text-red-600">
            {updateCoupon.error instanceof ApiError ? updateCoupon.error.message : "Something went wrong."}
          </p>
        )}

        <button
          type="submit"
          disabled={updateCoupon.isPending}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {updateCoupon.isPending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
