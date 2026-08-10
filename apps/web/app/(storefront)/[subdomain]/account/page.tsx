"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useCustomerMe,
  useUpdateMe,
  useMyAddresses,
  useAddAddress,
  useUpdateAddress,
  useRemoveAddress,
} from "@/lib/hooks-storefront";
import { getCustomerAccessToken } from "@/lib/customer-auth";
import { ApiError } from "@/lib/api-client";

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

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // New address form
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
    if (!hasToken) { router.replace(`/${subdomain}/login`); return; }
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
        onSuccess: () => { setShowAddForm(false); setLine1(""); setLine2(""); setCity(""); setState(""); setPostalCode(""); setCountry(""); setIsDefault(false); },
        onError: (err) => setAddrError(err instanceof ApiError ? err.message : "Failed to add address."),
      },
    );
  };

  if (!hasToken || me.isLoading) return <p className="p-8 text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-xl space-y-8 p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">My Account</h1>

      {/* Profile */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">Profile</h2>
        <p className="text-sm text-zinc-500">{me.data?.email}</p>
        <form onSubmit={handleProfileSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="input" />
          </div>
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileSaved && <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>}
          <button type="submit" disabled={updateMe.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {updateMe.isPending ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      {/* Addresses */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">Addresses</h2>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="text-sm text-brand-600 hover:underline"
          >
            {showAddForm ? "Cancel" : "Add address"}
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddAddress} className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">Address line 1 *</label>
                <input value={line1} onChange={(e) => setLine1(e.target.value)} required className="input" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">Address line 2</label>
                <input value={line2} onChange={(e) => setLine2(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">City *</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} required className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">State / Province</label>
                <input value={state} onChange={(e) => setState(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">Postal code</label>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="input" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">Country *</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} required className="input" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default
            </label>
            {addrError && <p className="text-sm text-red-600">{addrError}</p>}
            <button type="submit" disabled={addAddress.isPending} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {addAddress.isPending ? "Adding…" : "Add address"}
            </button>
          </form>
        )}

        {addresses.isLoading && <p className="text-sm text-zinc-500">Loading addresses…</p>}
        <div className="space-y-3">
          {addresses.data?.map((addr: any) => (
            <div key={addr.id} className="flex items-start justify-between rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="space-y-0.5 text-zinc-700 dark:text-zinc-300">
                <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                <p>{addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.postalCode}</p>
                <p>{addr.country}</p>
                {addr.isDefault && <span className="inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">Default</span>}
              </div>
              <div className="flex gap-2">
                {!addr.isDefault && (
                  <button
                    onClick={() => updateAddress.mutate({ addressId: addr.id, dto: { isDefault: true } })}
                    className="text-zinc-500 hover:underline"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => { if (window.confirm("Remove this address?")) removeAddress.mutate(addr.id); }}
                  className="text-red-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {!addresses.isLoading && addresses.data?.length === 0 && (
            <p className="text-sm text-zinc-500">No saved addresses.</p>
          )}
        </div>
      </section>
    </div>
  );
}
