"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerRegisterSchema, type CustomerRegisterDto } from "@saas/shared-types";
import { useCustomerRegister, useStorefrontTenant } from "@/lib/hooks-storefront";
import { ApiError } from "@/lib/api-client";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function StorefrontRegisterPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const tenant = useStorefrontTenant(subdomain);
  const register_ = useCustomerRegister(subdomain);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerRegisterDto>({ resolver: zodResolver(customerRegisterSchema) });

  const onSubmit = handleSubmit((dto) => {
    register_.mutate(dto, { onSuccess: () => router.push(`/${subdomain}`) });
  });

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">{tenant.data?.name ?? subdomain}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Create an account</h1>
          <p className="mt-1 text-sm text-zinc-500">Start shopping today</p>
        </div>

        <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">First name</label>
                <input {...register("firstName")} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Last name</label>
                <input {...register("lastName")} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
              <input {...register("email")} type="email" className={inputClass} placeholder="you@example.com" />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
              <input {...register("password")} type="password" className={inputClass} />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>

            {register_.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {register_.error instanceof ApiError ? register_.error.message : "Something went wrong."}
              </div>
            )}

            <button
              type="submit"
              disabled={register_.isPending}
              className="w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {register_.isPending ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href={`/${subdomain}/login`} className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
