"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCustomerMe,
  useUpdateMe,
  useMyAddresses,
  useAddAddress,
  useUpdateAddress,
  useRemoveAddress,
  useMyCoupons,
} from "@/lib/hooks-storefront";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { ApiError } from "@/lib/api-client";

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function AccountPage() {
  const { subdomain } = useParams<{ subdomain: string }>();
  const router = useRouter();
  const hasToken = typeof window !== "undefined" && !!getCustomerAccessToken();
  const me = useCustomerMe(subdomain, hasToken);
  const updateMe = useUpdateMe(subdomain);
  const addresses = useMyAddresses(subdomain, hasToken);
  const addAddress = useAddAddress(subdomain);
  const updateAddress = useUpdateAddress(subdomain);
  const removeAddress = useRemoveAddress(subdomain);
  const myCoupons = useMyCoupons(subdomain, hasToken);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken) { router.replace(`/${subdomain}/login`); }
  }, [hasToken, router, subdomain]);

  useEffect(() => {
    if (!me.data) return;
    setFirstName(me.data.firstName ?? "");
    setLastName(me.data.lastName ?? "");
    setPhone(me.data.phone ?? "");
  }, [me.data]);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaved(false);
    setProfileError(null);
    updateMe.mutate(
      { firstName: firstName || undefined, lastName: lastName || undefined, phone: phone || undefined },
      {
        onSuccess: () => setProfileSaved(true),
        onError: (err) => setProfileError(err instanceof ApiError ? err.message : "Failed to save."),
      },
    );
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddrError(null);
    addAddress.mutate(
      { line1, line2: line2 || undefined, city, state: state || undefined, postalCode: postalCode || undefined, country, isDefault },
      {
        onSuccess: () => {
          setShowAddForm(false);
          setLine1(""); setLine2(""); setCity(""); setState(""); setPostalCode(""); setCountry(""); setIsDefault(false);
        },
        onError: (err) => setAddrError(err instanceof ApiError ? err.message : "Failed to add address."),
      },
    );
  };

  if (!hasToken || me.isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="h-8 w-40 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">My Account</h1>
        <Link href={`/${subdomain}/orders`} className="text-sm text-brand-600 hover:underline">
          View orders →
        </Link>
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Profile</h2>
        <p className="mb-4 text-xs text-zinc-400">{me.data?.email}</p>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className={inputClass} />
          </div>
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileSaved && <p className="text-sm text-green-600 dark:text-green-400">Profile saved.</p>}
          <button
            type="submit"
            disabled={updateMe.isPending}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {updateMe.isPending ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      {/* Addresses */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Saved addresses</h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="text-sm text-brand-600 hover:underline"
          >
            {showAddForm ? "Cancel" : "+ Add address"}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddAddress} className="mb-5 space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">New address</p>
            <input value={line1} onChange={(e) => setLine1(e.target.value)} required placeholder="Address line 1 *" className={inputClass} />
            <input value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="Address line 2 (optional)" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={city} onChange={(e) => setCity(e.target.value)} required placeholder="City *" className={inputClass} />
              <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State / Province" className={inputClass} />
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" className={inputClass} />
              <input value={country} onChange={(e) => setCountry(e.target.value)} required placeholder="Country *" className={inputClass} />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
              Set as default address
            </label>
            {addrError && <p className="text-sm text-red-600">{addrError}</p>}
            <button
              type="submit"
              disabled={addAddress.isPending}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {addAddress.isPending ? "Adding…" : "Add address"}
            </button>
          </form>
        )}

        {addresses.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (addresses.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-zinc-500">No saved addresses.</p>
        ) : (
          <ul className="space-y-3">
            {addresses.data?.map((addr: any) => (
              <li key={addr.id} className="flex items-start justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
                <div className="space-y-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                  <p className="text-zinc-500">
                    {addr.city}{addr.state ? `, ${addr.state}` : ""}
                    {addr.postalCode ? ` ${addr.postalCode}` : ""}
                  </p>
                  <p className="text-zinc-500">{addr.country}</p>
                  {addr.isDefault && (
                    <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  {!addr.isDefault && (
                    <button
                      onClick={() => updateAddress.mutate({ addressId: addr.id, dto: { isDefault: true } })}
                      className="text-zinc-400 hover:text-zinc-700 hover:underline"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    onClick={() => { if (window.confirm("Remove this address?")) removeAddress.mutate(addr.id); }}
                    className="text-red-400 hover:text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Coupon history */}
      <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Coupon history</h2>
        {myCoupons.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (myCoupons.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-zinc-500">No coupons used yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {myCoupons.data!.map((r: any) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{r.coupon.code}</span>
                  <span className="ml-2 text-xs text-zinc-400">
                    {r.coupon.type === "percentage"
                      ? `${r.coupon.value}% off`
                      : `$${r.coupon.value} off`}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">{new Date(r.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
