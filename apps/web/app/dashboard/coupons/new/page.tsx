"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCouponSchema, type CreateCouponDto } from "@saas/shared-types";
import { useCreateCoupon } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function NewCouponPage() {
  const router = useRouter();
  const createCoupon = useCreateCoupon();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCouponDto>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: { type: "fixed", isActive: true, restrictedProductIds: [], restrictedCategoryIds: [] },
  });

  const onSubmit = handleSubmit((dto) => {
    createCoupon.mutate(dto, { onSuccess: () => router.push("/dashboard/coupons") });
  });

  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">New coupon</h1>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Code</span>
          <input {...register("code")} className="input uppercase" placeholder="SAVE10" />
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

        {createCoupon.isError && (
          <p className="text-sm text-red-600">
            {createCoupon.error instanceof ApiError ? createCoupon.error.message : "Something went wrong."}
          </p>
        )}

        <button
          type="submit"
          disabled={createCoupon.isPending}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {createCoupon.isPending ? "Creating…" : "Create coupon"}
        </button>
      </form>
    </div>
  );
}
