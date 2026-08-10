"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  customerRegisterSchema,
  type CustomerRegisterDto,
} from "@saas/shared-types";
import { useCustomerRegister } from "@/lib/hooks-storefront";
import { ApiError } from "@/lib/api-client";

export default function StorefrontRegisterPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const register_ = useCustomerRegister(subdomain);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerRegisterDto>({
    resolver: zodResolver(customerRegisterSchema),
  });

  const onSubmit = handleSubmit((dto) => {
    register_.mutate(dto, { onSuccess: () => router.push(`/${subdomain}`) });
  });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Create an account
        </h1>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              First name
            </span>
            <input {...register("firstName")} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Last name
            </span>
            <input {...register("lastName")} className="input" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Email
            </span>
            <input {...register("email")} type="email" className="input" />
            {errors.email && (
              <span className="block text-xs text-red-600">
                {errors.email.message}
              </span>
            )}
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </span>
            <input
              {...register("password")}
              type="password"
              className="input"
            />
            {errors.password && (
              <span className="block text-xs text-red-600">
                {errors.password.message}
              </span>
            )}
          </label>

          {register_.isError && (
            <p className="text-sm text-red-600">
              {register_.error instanceof ApiError
                ? register_.error.message
                : "Something went wrong."}
            </p>
          )}

          <button
            type="submit"
            disabled={register_.isPending}
            className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {register_.isPending ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link
            href={`/${subdomain}/login`}
            className="font-medium text-brand-600 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
