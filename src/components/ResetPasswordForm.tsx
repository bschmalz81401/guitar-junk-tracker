"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const passwordId = useId();
  const confirmId = useId();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error || "Reset failed");
      return;
    }

    router.push("/login");
    router.refresh();
  }

  if (!token) {
    return (
      <div className="card p-6 max-w-sm mx-auto mt-12">
        <h1 className="text-xl font-semibold mb-2">Invalid link</h1>
        <p className="text-sm text-[var(--muted)]">
          This reset link is missing a token.{" "}
          <Link href="/forgot-password" className="text-[var(--accent)] hover:underline cursor-pointer">
            Request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-sm mx-auto mt-12">
      <h1 className="text-xl font-semibold mb-1">Set new password</h1>
      <p className="text-sm text-[var(--muted)] mb-4">Choose a new password for your account.</p>
      <label htmlFor={passwordId} className="text-xs text-[var(--muted)]">
        New password
      </label>
      <input
        id={passwordId}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-3"
        minLength={8}
        required
        autoComplete="new-password"
      />
      <label htmlFor={confirmId} className="text-xs text-[var(--muted)]">
        Confirm password
      </label>
      <input
        id={confirmId}
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full mb-3"
        minLength={8}
        required
        autoComplete="new-password"
      />
      <Alert className="mb-3">{error}</Alert>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Saving..." : "Update password"}
      </Button>
    </form>
  );
}
