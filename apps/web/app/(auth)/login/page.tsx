"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginDto } from "@saas/shared-types";
import { useLogin, useCompleteTwoFactorLogin } from "@/lib/hooks";
import { setAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const completeTwoFactor = useCompleteTwoFactorLogin();

  // When the server returns requiresTwoFactor: true
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginDto>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((dto) => {
    login.mutate(dto, {
      onSuccess: (data: any) => {
        if (data.requiresTwoFactor) {
          setChallengeToken(data.challengeToken);
        } else {
          setAccessToken(data.tokens.accessToken);
          router.push("/dashboard");
        }
      },
    });
  });

  const handleTotpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    completeTwoFactor.mutate(
      { challengeToken, code: totpCode },
      {
        onSuccess: (data) => {
          setAccessToken(data.tokens.accessToken);
          router.push("/dashboard");
        },
      },
    );
  };

  // 2FA challenge screen
  if (challengeToken) {
    return (
      <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Two-factor verification
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>

          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="input text-center font-mono tracking-widest"
              autoFocus
            />

            {completeTwoFactor.isError && (
              <p className="text-sm text-red-600">
                {completeTwoFactor.error instanceof ApiError
                  ? completeTwoFactor.error.message
                  : "Verification failed."}
              </p>
            )}

            <button
              type="submit"
              disabled={totpCode.length !== 6 || completeTwoFactor.isPending}
              className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {completeTwoFactor.isPending ? "Verifying…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={() => { setChallengeToken(null); setTotpCode(""); }}
              className="w-full text-sm text-zinc-500 hover:underline"
            >
              Back to login
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Log in</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Phase 1's dashboard has no subdomain routing yet (see proxy.ts's
              comment) — in production this is reached AT the tenant's own
              subdomain and resolved from the Host header automatically,
              so a person never sees this field. */}
          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Store subdomain</span>
            <input {...register("subdomain")} className="input" placeholder="your-store" />
            {errors.subdomain && <span className="block text-xs text-red-600">{errors.subdomain.message}</span>}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
            <input {...register("email")} type="email" className="input" placeholder="you@acme.com" />
            {errors.email && <span className="block text-xs text-red-600">{errors.email.message}</span>}
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
            <input {...register("password")} type="password" className="input" />
            {errors.password && <span className="block text-xs text-red-600">{errors.password.message}</span>}
          </label>

          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>

          {login.isError && (
            <p className="text-sm text-red-600">
              {login.error instanceof ApiError ? login.error.message : "Something went wrong."}
            </p>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {login.isPending ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Don&apos;t have a store yet?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">
            Start a free trial
          </Link>
        </p>
      </div>
    </main>
  );
}
