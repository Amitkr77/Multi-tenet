"use client";

import { useState } from "react";
import { useMe } from "@/lib/hooks";
import { useSetup2fa, useEnable2fa, useDisable2fa } from "@/lib/hooks";
import { ApiError } from "@/lib/api-client";

export default function SecuritySettingsPage() {
  const me = useMe();
  const setup2fa = useSetup2fa();
  const enable2fa = useEnable2fa();
  const disable2fa = useDisable2fa();

  const [step, setStep] = useState<"idle" | "setup" | "disable">("idle");
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState<"enabled" | "disabled" | null>(null);

  const twoFactorEnabled = (me.data?.user as any)?.twoFactorEnabled ?? false;

  const handleStartSetup = () => {
    setup2fa.mutate(undefined, {
      onSuccess: (data) => {
        setSetupData(data);
        setStep("setup");
        setCode("");
        setDone(null);
      },
    });
  };

  const handleEnable = (e: React.FormEvent) => {
    e.preventDefault();
    enable2fa.mutate(code, {
      onSuccess: () => {
        setStep("idle");
        setSetupData(null);
        setCode("");
        setDone("enabled");
      },
    });
  };

  const handleDisable = (e: React.FormEvent) => {
    e.preventDefault();
    disable2fa.mutate(code, {
      onSuccess: () => {
        setStep("idle");
        setCode("");
        setDone("disabled");
      },
    });
  };

  if (me.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="max-w-xl space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Security</h1>

      {/* 2FA section */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Two-factor authentication
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) to generate
              one-time codes.
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              twoFactorEnabled
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        {done === "enabled" && (
          <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            Two-factor authentication is now enabled on your account.
          </div>
        )}
        {done === "disabled" && (
          <div className="mb-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Two-factor authentication has been disabled.
          </div>
        )}

        {/* Not set up — show enroll button */}
        {!twoFactorEnabled && step === "idle" && (
          <button
            onClick={handleStartSetup}
            disabled={setup2fa.isPending}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {setup2fa.isPending ? "Generating…" : "Set up 2FA"}
          </button>
        )}

        {/* Setup flow */}
        {step === "setup" && setupData && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Scan this QR code with your authenticator app, or enter the secret key manually.
            </p>

            {/* QR code — rendered client-side via a public QR API (no library needed) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(setupData.otpauthUrl)}`}
              alt="2FA QR code"
              width={180}
              height={180}
              className="rounded-md border border-zinc-200 dark:border-zinc-700"
            />

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Manual entry key
              </p>
              <code className="block break-all rounded bg-zinc-100 px-3 py-2 font-mono text-xs tracking-widest text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                {setupData.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </div>

            <form onSubmit={handleEnable} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Enter the 6-digit code from your app to confirm
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="w-40 rounded-md border border-zinc-300 px-3 py-1.5 text-center font-mono text-sm tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              {enable2fa.isError && (
                <p className="text-sm text-red-600">
                  {enable2fa.error instanceof ApiError ? enable2fa.error.message : "Verification failed."}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={code.length !== 6 || enable2fa.isPending}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {enable2fa.isPending ? "Verifying…" : "Verify & enable"}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("idle"); setSetupData(null); setCode(""); }}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Disable flow */}
        {twoFactorEnabled && step === "idle" && (
          <button
            onClick={() => { setStep("disable"); setCode(""); setDone(null); }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Disable 2FA
          </button>
        )}

        {step === "disable" && (
          <form onSubmit={handleDisable} className="space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Enter your current 6-digit authenticator code to confirm you want to disable 2FA.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="w-40 rounded-md border border-zinc-300 px-3 py-1.5 text-center font-mono text-sm tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
            />
            {disable2fa.isError && (
              <p className="text-sm text-red-600">
                {disable2fa.error instanceof ApiError ? disable2fa.error.message : "Failed to disable 2FA."}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={code.length !== 6 || disable2fa.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {disable2fa.isPending ? "Disabling…" : "Disable 2FA"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("idle"); setCode(""); }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
