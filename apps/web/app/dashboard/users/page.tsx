"use client";

import { useState } from "react";
import { useUsers, useInviteUser, useUpdateUser, useRemoveUser, useRoles } from "@/lib/hooks-catalog";
import { ApiError } from "@/lib/api-client";

export default function UsersPage() {
  const users = useUsers();
  const roles = useRoles();
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();
  const removeUser = useRemoveUser();

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInvitedEmail(null);
    if (!email || !roleId) return;
    inviteUser.mutate(
      { email, roleId },
      {
        onSuccess: () => {
          setInvitedEmail(email);
          setEmail("");
          setRoleId("");
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : "Failed to send invite."),
      },
    );
  }

  function handleChangeRole(userId: string, newRoleId: string) {
    updateUser.mutate({ id: userId, dto: { roleId: newRoleId } });
  }

  function handleToggleActive(user: any) {
    updateUser.mutate({ id: user.id, dto: { isActive: !user.isActive } });
  }

  function handleRemove(userId: string) {
    if (!confirm("Remove this user from the team?")) return;
    removeUser.mutate(userId);
  }

  if (users.isLoading) return <p className="text-sm text-zinc-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Team</h1>

      {/* Invite form */}
      <div className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Invite a team member</h2>
        <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Role</label>
            <select
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="">Select role…</option>
              {roles.data?.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteUser.isPending}
            className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {inviteUser.isPending ? "Sending…" : "Send invite"}
          </button>
        </form>
        {invitedEmail && (
          <p className="mt-2 text-xs text-green-700 dark:text-green-400">Invite sent to {invitedEmail}.</p>
        )}
        {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
      </div>

      {/* Team list */}
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 font-medium">Email</th>
            <th className="py-1 font-medium">Role</th>
            <th className="py-1 font-medium">Status</th>
            <th className="py-1 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {users.data?.map((u: any) => {
            const currentRole = u.userRoles?.[0]?.role;
            return (
              <tr key={u.id}>
                <td className="py-1.5">{u.email}</td>
                <td className="py-1.5">
                  <select
                    value={currentRole?.id ?? ""}
                    onChange={(e) => handleChangeRole(u.id, e.target.value)}
                    disabled={updateUser.isPending}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {roles.data?.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1.5">
                  <button
                    onClick={() => handleToggleActive(u)}
                    disabled={updateUser.isPending}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      u.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="py-1.5">
                  <button
                    onClick={() => handleRemove(u.id)}
                    disabled={removeUser.isPending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {users.data?.length === 0 && <p className="mt-4 text-sm text-zinc-500">No team members yet.</p>}
    </div>
  );
}
