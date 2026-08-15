"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { acceptInviteSchema, type AcceptInviteDto } from "@saas/shared-types";
import { useAcceptInvite } from "@/lib/hooks";
import { ApiError } from "@/lib/api-client";

export default function AcceptInvitePage() {
  const token = useSearchParams().get("token") ?? "";
  const acceptInvite = useAcceptInvite();
  const { register, handleSubmit, formState: { errors } } = useForm<AcceptInviteDto>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token, password: "" },
  });

  if (acceptInvite.isSuccess) {
    return (
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Invitation accepted</h1>
          <p className="text-sm text-zinc-500">Your account is active. Use the store subdomain from your invitation to sign in.</p>
          <Link href="/login" className="inline-block rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white">Continue to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Join your team</h1>
          <p className="mt-1 text-sm text-zinc-500">Choose a password to activate your staff account.</p>
        </div>
        {!token ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">This invitation link is missing its token. Ask your administrator for a new invitation.</p>
        ) : (
          <form onSubmit={handleSubmit((dto) => acceptInvite.mutate(dto))} className="space-y-4" noValidate>
            <input type="hidden" {...register("token")} />
            <label className="block space-y-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</span>
              <input {...register("password")} type="password" autoComplete="new-password" className="input" placeholder="At least 10 characters" />
              {errors.password && <span className="block text-xs text-red-600">{errors.password.message}</span>}
            </label>
            {acceptInvite.isError && <p className="text-sm text-red-600">{acceptInvite.error instanceof ApiError ? acceptInvite.error.message : "Could not accept this invitation."}</p>}
            <button type="submit" disabled={acceptInvite.isPending} className="w-full rounded-full bg-brand-600 py-3 text-sm font-medium text-white disabled:opacity-60">
              {acceptInvite.isPending ? "Activating…" : "Activate account"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
