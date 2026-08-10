"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useVerifyEmail } from "@/lib/hooks";

function VerifyEmailStatus() {
  const token = useSearchParams().get("token") ?? "";
  const verifyEmail = useVerifyEmail();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (token && !attemptedRef.current) {
      attemptedRef.current = true;
      verifyEmail.mutate(token);
    }
  }, [token, verifyEmail]);

  if (!token) return <p className="text-sm text-red-600">No verification token provided.</p>;
  if (verifyEmail.isPending || verifyEmail.isIdle) return <p className="text-sm text-zinc-500">Verifying…</p>;
  if (verifyEmail.isError) return <p className="text-sm text-red-600">This verification link is invalid or expired.</p>;
  return <p className="text-sm text-zinc-600 dark:text-zinc-400">Your email is verified.</p>;
}

export default function VerifyEmailPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Email verification</h1>
        <Suspense fallback={<p className="text-sm text-zinc-500">Verifying…</p>}>
          <VerifyEmailStatus />
        </Suspense>
        <Link href="/login" className="block text-sm font-medium text-brand-600 hover:underline">
          Go to log in
        </Link>
      </div>
    </main>
  );
}
