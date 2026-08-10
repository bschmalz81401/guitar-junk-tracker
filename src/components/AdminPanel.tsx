"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

type UserRow = {
  id: number;
  email: string;
  username: string;
  name: string | null;
  role: "admin" | "user";
  catalogPublic?: boolean;
  createdAt: string;
  itemCount: number;
};

type SettingsState = {
  allowSignup: boolean;
  showcaseEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordSet: boolean;
  smtpFrom: string;
  smtpConfigured: boolean;
};

function formLooksConfigured(s: SettingsState): boolean {
  return Boolean(s.smtpHost?.trim() && s.smtpPort && s.smtpFrom?.trim());
}

export default function AdminPanel({
  currentUserId,
  initialUsers,
  initialSettings,
}: {
  currentUserId: number;
  initialUsers: UserRow[];
  initialSettings: SettingsState;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editPassword, setEditPassword] = useState("");
  const [editPublic, setEditPublic] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);

  const [smtpPassword, setSmtpPassword] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<"idle" | "ok" | "err">("idle");
  const [smtpFeedback, setSmtpFeedback] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; email: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: number; email: string } | null>(null);

  async function reloadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          username: newUsername,
          name: newName,
          password: newPassword,
          role: newRole,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Could not create user");
        return;
      }
      setNewEmail("");
      setNewUsername("");
      setNewName("");
      setNewPassword("");
      setNewRole("user");
      setMessage(`Created ${body.email} (@${body.username})`);
      await reloadUsers();
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteUserConfirmed() {
    if (!deleteTarget) return;
    const { id, email } = deleteTarget;
    setDeletingUser(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Delete failed");
        setDeletingUser(false);
        return;
      }
      setMessage(`Deleted ${email}`);
      if (editingId === id) setEditingId(null);
      setDeleteTarget(null);
      setDeletingUser(false);
      await reloadUsers();
    } catch {
      setError("Couldn't reach the server.");
      setDeletingUser(false);
    }
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setEditEmail(u.email);
    setEditUsername(u.username);
    setEditName(u.name ?? "");
    setEditRole(u.role);
    setEditPassword("");
    setEditPublic(Boolean(u.catalogPublic));
    setError(null);
    setMessage(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setSavingEdit(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          username: editUsername,
          name: editName,
          role: editRole,
          catalogPublic: editPublic,
          password: editPassword || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Could not update user");
        return;
      }
      setMessage(`Updated @${body.username} (${body.email})`);
      setEditingId(null);
      setEditPassword("");
      await reloadUsers();
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function sendResetConfirmed() {
    if (!resetTarget) return;
    const { id, email } = resetTarget;
    setResettingId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sendPasswordReset" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Could not send reset email");
        return;
      }
      setMessage(body?.message || `Reset email sent to ${email}`);
      setResetTarget(null);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setResettingId(null);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    setMessage(null);
    setSmtpFeedback(null);
    setSmtpStatus("idle");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowSignup: settings.allowSignup,
          showcaseEmail: settings.showcaseEmail,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser,
          smtpFrom: settings.smtpFrom,
          smtpPassword: smtpPassword || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error || "Save failed");
        return;
      }
      setSettings(body);
      setSmtpPassword("");
      setMessage("Settings saved.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function testSmtp() {
    setTestingSmtp(true);
    setError(null);
    setMessage(null);
    setSmtpFeedback(null);
    setSmtpStatus("idle");

    if (!formLooksConfigured(settings)) {
      setSmtpStatus("err");
      setSmtpFeedback(
        "Enter SMTP host, port, and from address first, then try again."
      );
      setTestingSmtp(false);
      return;
    }

    try {
      // Persist current form values, then verify + send (server logs the attempt).
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser,
          smtpFrom: settings.smtpFrom,
          smtpPassword: smtpPassword || undefined,
        }),
      });
      const body = await res.json().catch(() => null);

      if (body?.settings) {
        setSettings(body.settings);
        if (smtpPassword) setSmtpPassword("");
      }

      if (!res.ok) {
        setSmtpStatus("err");
        setSmtpFeedback(body?.error || `SMTP test failed (HTTP ${res.status}).`);
        return;
      }

      setSmtpStatus("ok");
      setSmtpFeedback(body?.message || "Test email sent.");
      setMessage(body?.message || "Test email sent.");
      router.refresh();
    } catch (err) {
      setSmtpStatus("err");
      setSmtpFeedback(
        err instanceof Error
          ? err.message
          : "Couldn't reach the app server to run the SMTP test."
      );
    } finally {
      setTestingSmtp(false);
    }
  }

  return (
    <div className="space-y-8">
      {(error || message) && (
        <div className="space-y-1">
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          {message && <p className="text-sm text-[var(--accent)]">{message}</p>}
        </div>
      )}

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-1">Users</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Each user gets a private catalog. Creating a user does not share your gear with them.
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Public</th>
                <th className="py-2 pr-3 font-medium">Items</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3">
                    <div>{u.email}</div>
                    <div className="text-xs text-[var(--muted)]">@{u.username}</div>
                  </td>
                  <td className="py-2 pr-3">{u.name || "—"}</td>
                  <td className="py-2 pr-3 capitalize">{u.role}</td>
                  <td className="py-2 pr-3">{u.catalogPublic ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3">{u.itemCount}</td>
                  <td className="py-2 text-right">
                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 justify-end items-end">
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="text-[var(--accent)] hover:underline text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetTarget({ id: u.id, email: u.email })}
                        disabled={resettingId === u.id || !settings.smtpConfigured}
                        className="text-[var(--accent)] hover:underline text-xs disabled:opacity-40"
                        title={
                          settings.smtpConfigured
                            ? "Email a password-reset link"
                            : "Configure SMTP first"
                        }
                      >
                        {resettingId === u.id ? "Sending…" : "Reset pw"}
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ id: u.id, email: u.email })}
                          className="text-red-400 hover:underline text-xs"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editingId != null && (
          <form
            onSubmit={saveEdit}
            className="mb-6 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface-hover)] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <h3 className="sm:col-span-2 text-sm font-semibold text-[var(--accent)]">
              Edit user
            </h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Email</label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Username</label>
              <input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9_]{3,30}"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                disabled={editingId === currentUserId}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-[var(--muted)]">
                New password (optional — leave blank to keep)
              </label>
              <input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={editPublic}
                onChange={(e) => setEditPublic(e.target.checked)}
                className="w-auto"
              />
              Public catalog
            </label>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {savingEdit ? "Saving…" : "Save user"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface)]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <form onSubmit={createUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <h3 className="sm:col-span-2 text-sm font-semibold text-[var(--accent)]">
            Create user
          </h3>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Username</label>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9_]{3,30}"
              placeholder="unique_username"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-1">Settings</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Configure SMTP for password resets, landing showcase, and public sign-up.
        </p>

        <form onSubmit={saveSettings} className="space-y-4">
          <label className="flex items-center gap-2 text-sm flex-wrap">
            <input
              type="checkbox"
              checked={settings.allowSignup}
              onChange={(e) =>
                setSettings({ ...settings, allowSignup: e.target.checked })
              }
              className="w-auto"
            />
            Allow public sign-up at{" "}
            <code className="text-[var(--accent)]">/signup</code>
          </label>

          <div className="flex flex-col gap-1 max-w-md">
            <label className="text-xs text-[var(--muted)]">Landing showcase email</label>
            <input
              type="email"
              value={settings.showcaseEmail}
              onChange={(e) =>
                setSettings({ ...settings, showcaseEmail: e.target.value })
              }
              placeholder="Leave blank for first admin"
            />
            <p className="text-xs text-[var(--muted)]">
              Whose collection guests see on the home page. Must match an existing user.
            </p>
          </div>

          <h3 className="text-sm font-semibold text-[var(--accent)] pt-2">SMTP</h3>
          <p className="text-xs text-[var(--muted)]">
            Typical: port <strong>587</strong> with STARTTLS (leave TLS/SSL unchecked), or
            port <strong>465</strong> with TLS/SSL checked. Username/password required by
            most servers.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-[var(--muted)]">Host</label>
              <input
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Port</label>
              <input
                type="number"
                value={settings.smtpPort}
                onChange={(e) =>
                  setSettings({ ...settings, smtpPort: Number(e.target.value) || 587 })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm self-end pb-2">
              <input
                type="checkbox"
                checked={settings.smtpSecure}
                onChange={(e) =>
                  setSettings({ ...settings, smtpSecure: e.target.checked })
                }
                className="w-auto"
              />
              TLS/SSL (use for port 465)
            </label>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">Username</label>
              <input
                value={settings.smtpUser}
                onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--muted)]">
                Password{settings.smtpPasswordSet ? " (saved — leave blank to keep)" : ""}
              </label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={settings.smtpPasswordSet ? "••••••••" : ""}
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-[var(--muted)]">From address</label>
              <input
                type="email"
                value={settings.smtpFrom}
                onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                placeholder="noreply@yourdomain.com"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="submit"
              disabled={savingSettings}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {savingSettings ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              onClick={() => void testSmtp()}
              disabled={testingSmtp}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {testingSmtp ? "Testing… (up to ~20s)" : "Send test email to me"}
            </button>
          </div>

          {smtpFeedback && (
            <p
              className={`text-sm rounded-md border px-3 py-2 ${
                smtpStatus === "ok"
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : "border-red-500/40 text-red-400 bg-red-500/10"
              }`}
            >
              {smtpFeedback}
            </p>
          )}

          <p className="text-xs text-[var(--muted)]">
            Status:{" "}
            {settings.smtpConfigured || formLooksConfigured(settings) ? (
              <span className="text-emerald-400">
                {settings.smtpConfigured
                  ? "SMTP fields saved"
                  : "Form looks complete — click Test or Save"}
              </span>
            ) : (
              <span className="text-amber-400">
                Incomplete (need host, port, and from address)
              </span>
            )}
            {settings.smtpPasswordSet
              ? " · password stored"
              : " · no password stored yet"}
          </p>
        </form>
      </section>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete user?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.email} and all of their gear? This cannot be undone.`
            : undefined
        }
        error={deleteTarget ? error : null}
        confirmLabel="Delete user"
        destructive
        busy={deletingUser}
        onConfirm={() => void deleteUserConfirmed()}
        onCancel={() => {
          if (!deletingUser) {
            setDeleteTarget(null);
            setError(null);
          }
        }}
      />
      <ConfirmDialog
        open={resetTarget != null}
        title="Send password reset?"
        description={
          resetTarget
            ? `Send a password-reset email to ${resetTarget.email}?`
            : undefined
        }
        error={resetTarget ? error : null}
        confirmLabel="Send email"
        busy={resettingId != null}
        onConfirm={() => void sendResetConfirmed()}
        onCancel={() => {
          if (resettingId == null) {
            setResetTarget(null);
            setError(null);
          }
        }}
      />
    </div>
  );
}
