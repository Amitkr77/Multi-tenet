"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordDto } from "@saas/shared-types";
import { useForgotPassword } from "@/lib/hooks";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordDto>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit((dto) => {
    forgotPassword.mutate(dto.email, { onSuccess: () => setSent(true) });
  });

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Reset your password</h1>

        {sent ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
              <input {...register("email")} type="email" className="input" placeholder="you@acme.com" />
              {errors.email && <span className="block text-xs text-red-600">{errors.email.message}</span>}
            </label>

            <button
              type="submit"
              disabled={forgotPassword.isPending}
              className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {forgotPassword.isPending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
