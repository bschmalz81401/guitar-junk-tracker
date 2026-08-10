"use client";

import Link from "next/link";
import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

export default function ForgotPasswordForm({ smtpReady }: { smtpReady: boolean }) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!smtpReady) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(body?.error || "Request failed");
      return;
    }
    setMessage(body?.message || "Check your email for a reset link.");
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-sm mx-auto mt-12">
      <h1 className="text-xl font-semibold mb-1">Forgot password</h1>
      {!smtpReady ? (
        <p className="text-sm text-[var(--muted)] mt-2">
          Password reset isn&apos;t available yet — an admin needs to configure SMTP in the
          Admin settings.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--muted)] mb-4">
            Enter your email and we&apos;ll send a reset link if an account exists.
          </p>
          <label htmlFor={emailId} className="text-xs text-[var(--muted)]">
            Email
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full mb-3"
            required
            autoComplete="email"
          />
          <Alert className="mb-3">{error}</Alert>
          <Alert variant="success" className="mb-3">
            {message}
          </Alert>
          <Button type="submit" disabled={submitting || !email} className="w-full">
            {submitting ? "Sending..." : "Send reset link"}
          </Button>
        </>
      )}
      <p className="mt-4 text-sm text-[var(--muted)]">
        <Link href="/login" className="hover:text-[var(--foreground)] cursor-pointer">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
