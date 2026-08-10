"use client";

import { useState } from "react";
import { useCustomers, useUpdateCustomer } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  const customers = useCustomers(debouncedSearch || undefined);
  const updateCustomer = useUpdateCustomer();

  function handleSearch(value: string) {
    setSearch(value);
    // Simple debounce via a short timeout reset
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(value), 350);
  }

  function openEdit(customer: any) {
    setEditId(customer.id);
    setEditTags((customer.tags ?? []).join(", "));
    setError(null);
  }

  function closeEdit() {
    setEditId(null);
    setError(null);
  }

  function handleToggleActive(customer: any) {
    updateCustomer.mutate({ id: customer.id, dto: { isActive: !customer.isActive } });
  }

  function handleSaveTags(customer: any) {
    const tags = editTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateCustomer.mutate(
      { id: customer.id, dto: { tags } },
      {
        onSuccess: () => closeEdit(),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Failed to save."),
      },
    );
  }

  if (customers.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Customers</h1>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Email</th>
            <th className="py-1 font-medium">Name</th>
            <th className="py-1 font-medium">Tags</th>
            <th className="py-1 font-medium">Active</th>
            <th className="py-1 font-medium">Joined</th>
            <th className="py-1 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {customers.data?.map((c: any) => (
            <tr key={c.id}>
              <td className="py-1.5">{c.email}</td>
              <td className="py-1.5">
                {c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : <span className="text-zinc-400">—</span>}
              </td>
              <td className="py-1.5">
                {editId === c.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="tag1, tag2"
                      className="w-40 rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    />
                    <button
                      onClick={() => handleSaveTags(c)}
                      disabled={updateCustomer.isPending}
                      className="rounded bg-brand-600 px-2 py-0.5 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button onClick={closeEdit} className="text-xs text-zinc-500 hover:text-zinc-700">
                      Cancel
                    </button>
                    {error && <span className="text-xs text-red-600">{error}</span>}
                  </div>
                ) : (
                  <span
                    className="cursor-pointer text-zinc-700 hover:text-brand-600 dark:text-zinc-300"
                    onClick={() => openEdit(c)}
                    title="Click to edit tags"
                  >
                    {(c.tags ?? []).length > 0 ? (c.tags as string[]).join(", ") : <span className="text-zinc-400">—</span>}
                  </span>
                )}
              </td>
              <td className="py-1.5">
                <button
                  onClick={() => handleToggleActive(c)}
                  disabled={updateCustomer.isPending}
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    c.isActive
                      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-400"
                      : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-400"
                  }`}
                >
                  {c.isActive ? "Active" : "Inactive"}
                </button>
              </td>
              <td className="py-1.5 text-zinc-500">{new Date(c.createdAt).toLocaleDateString()}</td>
              <td className="py-1.5">
                <button onClick={() => openEdit(c)} className="text-xs text-brand-600 hover:underline">
                  Edit tags
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {customers.data?.length === 0 && <p className="mt-4 text-sm text-zinc-500">No customers found.</p>}
    </div>
  );
}
