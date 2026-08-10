"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterDto } from "@saas/shared-types";
import { useRegister } from "@/lib/hooks";
import { ApiError } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterDto>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit((dto) => {
    registerMutation.mutate(dto, { onSuccess: () => router.push("/dashboard") });
  });

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Start your free trial</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Business name" error={errors.businessName?.message}>
            <input {...register("businessName")} className="input" placeholder="Acme Inc." />
          </Field>

          <Field label="Subdomain" error={errors.subdomain?.message}>
            <div className="flex items-center gap-1">
              <input {...register("subdomain")} className="input" placeholder="acme" />
              <span className="whitespace-nowrap text-sm text-zinc-500">.yourapp.local</span>
            </div>
          </Field>

          <Field label="Work email" error={errors.email?.message}>
            <input {...register("email")} type="email" className="input" placeholder="you@acme.com" />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <input {...register("password")} type="password" className="input" placeholder="At least 10 characters" />
          </Field>

          {registerMutation.isError && (
            <p className="text-sm text-red-600">
              {registerMutation.error instanceof ApiError ? registerMutation.error.message : "Something went wrong."}
            </p>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {registerMutation.isPending ? "Creating your store…" : "Create store"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}
