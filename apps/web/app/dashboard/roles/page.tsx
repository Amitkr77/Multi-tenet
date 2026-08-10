"use client";

import { useState } from "react";
import { useRoles, usePermissionCatalogue, useCreateRole, useUpdateRole, useDeleteRole } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function RolesPage() {
  const roles = useRoles();
  const permissions = usePermissionCatalogue();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCodes, setEditCodes] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  // New role form
  const [newName, setNewName] = useState("");
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [newError, setNewError] = useState<string | null>(null);

  function openEdit(role: any) {
    setEditId(role.id);
    setEditName(role.name);
    setEditCodes((role.permissions ?? []).map((p: any) => p.code ?? p));
    setEditError(null);
  }

  function closeEdit() {
    setEditId(null);
    setEditError(null);
  }

  function toggleCode(code: string, selected: string[], setSelected: (v: string[]) => void) {
    setSelected(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setNewError(null);
    if (!newName || newCodes.length === 0) {
      setNewError("Name and at least one permission are required.");
      return;
    }
    createRole.mutate(
      { name: newName, permissionCodes: newCodes },
      {
        onSuccess: () => {
          setNewName("");
          setNewCodes([]);
        },
        onError: (err) => setNewError(err instanceof ApiError ? err.message : "Failed to create role."),
      },
    );
  }

  function handleUpdate() {
    if (!editId) return;
    setEditError(null);
    updateRole.mutate(
      { id: editId, dto: { name: editName, permissionCodes: editCodes } },
      {
        onSuccess: () => closeEdit(),
        onError: (err) => setEditError(err instanceof ApiError ? err.message : "Failed to update role."),
      },
    );
  }

  function handleDelete(roleId: string, roleName: string) {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return;
    deleteRole.mutate(roleId);
  }

  if (roles.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const permList: any[] = permissions.data ?? [];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Roles</h1>

      {/* Role list */}
      <div className="mb-8 space-y-2">
        {roles.data?.map((role: any) => {
          const isEditing = editId === role.id;
          const isExpanded = expandedId === role.id;
          const roleCodes: string[] = (role.permissions ?? []).map((p: any) => p.code ?? p);

          return (
            <div key={role.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : role.id)}
                  className="flex-1 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                >
                  {role.name}
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    ({roleCodes.length} permission{roleCodes.length !== 1 ? "s" : ""})
                  </span>
                </button>
                {!role.isSystem && (
                  <>
                    <button
                      onClick={() => (isEditing ? closeEdit() : openEdit(role))}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
                      disabled={deleteRole.isPending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
                {role.isSystem && (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    system
                  </span>
                )}
              </div>

              {/* Edit form */}
              {isEditing && (
                <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div className="mb-3">
                    <label className="mb-1 block text-xs text-zinc-500">Role name</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <PermissionPicker
                    all={permList}
                    selected={editCodes}
                    onChange={(code) => toggleCode(code, editCodes, setEditCodes)}
                  />
                  {editError && <p className="mt-2 text-xs text-red-600">{editError}</p>}
                  <button
                    onClick={handleUpdate}
                    disabled={updateRole.isPending}
                    className="mt-3 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {updateRole.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              )}

              {/* Expanded permission list (read-only, non-edit mode) */}
              {isExpanded && !isEditing && (
                <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <div className="flex flex-wrap gap-1.5">
                    {roleCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new role */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Create custom role</h2>
        <form onSubmit={handleCreate}>
          <div className="mb-3">
            <label className="mb-1 block text-xs text-zinc-500">Role name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Fulfillment Staff"
              className="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <PermissionPicker
            all={permList}
            selected={newCodes}
            onChange={(code) => toggleCode(code, newCodes, setNewCodes)}
          />
          {newError && <p className="mt-2 text-xs text-red-600">{newError}</p>}
          <button
            type="submit"
            disabled={createRole.isPending}
            className="mt-3 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {createRole.isPending ? "Creating…" : "Create role"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PermissionPicker({
  all,
  selected,
  onChange,
}: {
  all: any[];
  selected: string[];
  onChange: (code: string) => void;
}) {
  if (all.length === 0) return <p className="text-xs text-zinc-500">Loading permissions…</p>;

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">Permissions ({selected.length} selected)</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        {all
          .filter((p) => p.code !== "platform.super_admin")
          .map((p) => (
            <label key={p.code} className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(p.code)}
                onChange={() => onChange(p.code)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-zinc-700 dark:text-zinc-300">{p.code}</span>
            </label>
          ))}
      </div>
    </div>
  );
}
