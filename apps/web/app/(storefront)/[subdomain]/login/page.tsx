"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerLoginSchema, type CustomerLoginDto } from "@saas/shared-types";
import { useCustomerLogin } from "@/lib/hooks-storefront";
import { ApiError } from "@/lib/api-client";

export default function StorefrontLoginPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const login = useCustomerLogin(subdomain);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerLoginDto>({ resolver: zodResolver(customerLoginSchema) });

  const onSubmit = handleSubmit((dto) => {
    login.mutate(dto, { onSuccess: () => router.push(`/${subdomain}`) });
  });

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Log in</h1>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
            <input {...register("email")} type="email" className="input" />
            {errors.email && <span className="block text-xs text-red-600">{errors.email.message}</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
            <input {...register("password")} type="password" className="input" />
            {errors.password && <span className="block text-xs text-red-600">{errors.password.message}</span>}
          </label>

          {login.isError && (
            <p className="text-sm text-red-600">{login.error instanceof ApiError ? login.error.message : "Something went wrong."}</p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {login.isPending ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href={`/${subdomain}/register`} className="font-medium text-brand-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
