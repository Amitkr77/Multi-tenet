"use client";

import { useState } from "react";
import {
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouse,
  useSetDefaultWarehouse,
  useDeleteWarehouse,
} from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function WarehousesPage() {
  const warehouses = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const setDefault = useSetDefaultWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Warehouse name is required.");
      return;
    }
    createWarehouse.mutate(
      { name: newName.trim() },
      {
        onSuccess: () => setNewName(""),
        onError: (err) => setCreateError(err instanceof ApiError ? err.message : "Failed to create warehouse."),
      },
    );
  }

  function openEdit(wh: any) {
    setEditId(wh.id);
    setEditName(wh.name);
    setEditError(null);
  }

  function closeEdit() {
    setEditId(null);
    setEditError(null);
  }

  function handleUpdate() {
    if (!editId) return;
    setEditError(null);
    updateWarehouse.mutate(
      { id: editId, dto: { name: editName.trim() } },
      {
        onSuccess: () => closeEdit(),
        onError: (err) => setEditError(err instanceof ApiError ? err.message : "Failed to update warehouse."),
      },
    );
  }

  function handleSetDefault(id: string) {
    setActionError(null);
    setDefault.mutate(id, {
      onError: (err) => setActionError(err instanceof ApiError ? err.message : "Failed to set default."),
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete warehouse "${name}"? This cannot be undone.`)) return;
    setActionError(null);
    deleteWarehouse.mutate(id, {
      onError: (err) => setActionError(err instanceof ApiError ? err.message : "Failed to delete warehouse."),
    });
  }

  if (warehouses.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Warehouses</h1>

      {actionError && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Default</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {warehouses.data?.map((wh: any) => (
              <tr key={wh.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <td className="px-4 py-2">
                  {editId === wh.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        onClick={handleUpdate}
                        disabled={updateWarehouse.isPending}
                        className="rounded-md bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        {updateWarehouse.isPending ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={closeEdit}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        Cancel
                      </button>
                      {editError && <span className="text-xs text-red-600">{editError}</span>}
                    </div>
                  ) : (
                    <span className="text-zinc-700 dark:text-zinc-300">{wh.name}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {wh.isDefault ? (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                      default
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-3">
                    {editId !== wh.id && (
                      <button onClick={() => openEdit(wh)} className="text-xs text-brand-600 hover:underline">
                        Rename
                      </button>
                    )}
                    <button
                      onClick={() => handleSetDefault(wh.id)}
                      disabled={wh.isDefault || setDefault.isPending}
                      className="text-xs text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Set default
                    </button>
                    <button
                      onClick={() => handleDelete(wh.id, wh.name)}
                      disabled={wh.isDefault || deleteWarehouse.isPending}
                      className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {warehouses.data?.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-sm text-zinc-500">
                  No warehouses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add warehouse</h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. East Coast DC"
              className="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>
          <button
            type="submit"
            disabled={createWarehouse.isPending}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createWarehouse.isPending ? "Creating…" : "Create"}
          </button>
        </form>
        {createError && <p className="mt-2 text-xs text-red-600">{createError}</p>}
      </div>
    </div>
  );
}
