import Link from "next/link";

export default function MarketingHomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-24 text-center dark:bg-black">
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Launch your own online store in minutes
      </h1>
      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        Products, inventory, orders, and staff — one platform, your own subdomain.
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="rounded-full bg-brand-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700"
        >
          Start free trial
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-zinc-300 px-6 py-3 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
        >
          Log in
        </Link>
      </div>
      <div className="mt-12 flex gap-6 text-sm text-zinc-400">
        <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-200">Privacy Policy</Link>
        <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-200">Terms of Service</Link>
      </div>
    </main>
  );
}
