"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ProfileData = {
  email: string;
  username: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  catalogPublic: boolean;
  itemCount: number;
  createdAt: string;
};

export default function ProfileForm({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [name, setName] = useState(profile.name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [catalogPublic, setCatalogPublic] = useState(profile.catalogPublic);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, bio, location, catalogPublic }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setProfileError(body?.error || "Could not save profile");
        return;
      }
      setUsername(body.username);
      setCatalogPublic(body.catalogPublic);
      setProfileMessage(
        body.catalogPublic
          ? `Profile saved. Public catalog: /${body.username}`
          : "Profile saved. Catalog is private."
      );
      router.refresh();
    } catch {
      setProfileError("Couldn't reach the server.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/profile/export");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setExportError(body?.error || `Export failed (HTTP ${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "guitar-tracker-export.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Couldn't download the export.");
    } finally {
      setExporting(false);
    }
  }

  async function importCsv() {
    if (!importFile) {
      setImportError("Choose a CSV file first.");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/profile/import", {
        method: "POST",
        body: form,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const detail =
          Array.isArray(body?.errors) && body.errors.length
            ? ` First issue (row ${body.errors[0].row ?? "?"}): ${body.errors[0].message}`
            : "";
        setImportError((body?.error || body?.message || `Import failed (HTTP ${res.status}).`) + detail);
        return;
      }
      setImportMessage(body?.message || `Imported ${body?.created ?? 0} items.`);
      setImportFile(null);
      router.refresh();
    } catch {
      setImportError("Couldn't upload the import.");
    } finally {
      setImporting(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setSavingPw(true);
    setPwError(null);
    setPwMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setPwError(body?.error || "Could not change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage("Password updated. Sign in again with the new password.");
      window.location.assign("/login");
    } catch {
      setPwError("Couldn't reach the server.");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-1">Profile</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          {profile.itemCount} item{profile.itemCount === 1 ? "" : "s"} in your catalog · joined{" "}
          {new Date(profile.createdAt).toLocaleDateString()}
        </p>

        <form onSubmit={saveProfile} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Email</label>
            <input value={profile.email} disabled className="opacity-60" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">
              Username <span className="text-[var(--accent)]">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--muted)]">/</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-z0-9_]{3,30}"
                className="flex-1"
                autoComplete="username"
              />
            </div>
            <span className="text-xs text-[var(--muted)]">
              3–30 chars: lowercase letters, numbers, underscore. Used for your public URL.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, region…"
              maxLength={120}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What you play, what you collect…"
            />
          </div>

          <label className="flex items-start gap-2 text-sm pt-2">
            <input
              type="checkbox"
              checked={catalogPublic}
              onChange={(e) => setCatalogPublic(e.target.checked)}
              className="w-auto mt-0.5"
            />
            <span>
              <span className="font-medium">Public catalog</span>
              <span className="block text-xs text-[var(--muted)] mt-0.5">
                Anyone can view your gear at{" "}
                <code className="text-[var(--accent)]">/{username || "username"}</code>. Leave
                off to keep it private (login required).
              </span>
            </span>
          </label>

          {catalogPublic && username && (
            <p className="text-xs text-[var(--muted)]">
              Public link:{" "}
              <Link
                href={`/${username}`}
                className="text-[var(--accent)] hover:underline"
                target="_blank"
              >
                /{username}
              </Link>
            </p>
          )}

          {profileError && (
            <p role="alert" className="text-xs text-red-400">
              {profileError}
            </p>
          )}
          {profileMessage && <p className="text-xs text-[var(--accent)]">{profileMessage}</p>}
          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>

      <section className="card p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold mb-1">Import / export</h2>
          <p className="text-xs text-[var(--muted)]">
            Backup or restore collection <strong>text data</strong> (shared fields,
            specs, mod history). Photo files are not included in CSV — only counts on
            export, and import never creates photos.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Export</h3>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting || profile.itemCount === 0}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--background)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {exporting
              ? "Preparing…"
              : profile.itemCount === 0
                ? "No items to export"
                : `Export ${profile.itemCount} item${profile.itemCount === 1 ? "" : "s"} as CSV`}
          </button>
          {exportError && (
            <p role="alert" className="text-xs text-red-400 mt-2">
              {exportError}
            </p>
          )}
        </div>

        <div className="border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-medium mb-1">Import</h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            Upload a CSV in the same format as export (e.g. from another machine or
            backup). Rows always create <strong>new</strong> items — existing ids are
            ignored. Max 500 rows per upload. Privacy flags default to private when
            missing.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] ?? null);
                setImportError(null);
                setImportMessage(null);
              }}
              className="text-sm max-w-full"
            />
            <button
              type="button"
              onClick={() => void importCsv()}
              disabled={importing || !importFile}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {importing ? "Importing…" : "Import CSV"}
            </button>
          </div>
          {importFile && (
            <p className="text-xs text-[var(--muted)] mt-2">
              Selected: {importFile.name} ({Math.round(importFile.size / 1024)} KB)
            </p>
          )}
          {importError && (
            <p role="alert" className="text-xs text-red-400 mt-2">
              {importError}
            </p>
          )}
          {importMessage && (
            <p className="text-xs text-[var(--accent)] mt-2">{importMessage}</p>
          )}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-1">Change password</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Use a strong password you don&apos;t reuse elsewhere.
        </p>
        <form onSubmit={changePassword} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--muted)]">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {pwError && (
            <p role="alert" className="text-xs text-red-400">
              {pwError}
            </p>
          )}
          {pwMessage && <p className="text-xs text-[var(--accent)]">{pwMessage}</p>}
          <button
            type="submit"
            disabled={savingPw}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}
