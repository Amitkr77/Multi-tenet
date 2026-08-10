"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResetPassword } from "@/lib/hooks";
import { ApiError } from "@/lib/api-client";

const formSchema = z.object({ password: z.string().min(10).max(128) });
type FormValues = z.infer<typeof formSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const resetPassword = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const onSubmit = handleSubmit((values) => {
    resetPassword.mutate(
      { token, password: values.password },
      { onSuccess: () => setDone(true) },
    );
  });

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Password updated. You can log in now.</p>
        <button onClick={() => router.push("/login")} className="text-sm font-medium text-brand-600 hover:underline">
          Go to log in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New password</span>
        <input {...register("password")} type="password" className="input" placeholder="At least 10 characters" />
        {errors.password && <span className="block text-xs text-red-600">{errors.password.message}</span>}
      </label>

      {resetPassword.isError && (
        <p className="text-sm text-red-600">
          {resetPassword.error instanceof ApiError ? resetPassword.error.message : "Something went wrong."}
        </p>
      )}

      <button
        type="submit"
        disabled={resetPassword.isPending || !token}
        className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        {resetPassword.isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Set a new password</h1>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
