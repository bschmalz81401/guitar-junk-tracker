"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LogoMark } from "@/components/ui/Logo";

export default function LoginForm({
  from,
  allowSignup,
}: {
  from: string;
  allowSignup: boolean;
}) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Login failed");
      return;
    }

    router.push(from);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-sm mx-auto mt-12">
      <div className="flex items-center gap-2 mb-4">
        <LogoMark className="w-8 h-8 text-[var(--accent)]" />
        <div>
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="text-sm text-[var(--muted)]">
            Sign in to view and manage your gear collection.
          </p>
        </div>
      </div>
      <label htmlFor={emailId} className="text-xs text-[var(--muted)]">
        Email
      </label>
      <input
        id={emailId}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoFocus
        autoComplete="email"
        className="w-full mb-3"
        required
      />
      <label htmlFor={passwordId} className="text-xs text-[var(--muted)]">
        Password
      </label>
      <input
        id={passwordId}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="w-full mb-3"
        required
      />
      <Alert className="mb-3">{error}</Alert>
      <Button
        type="submit"
        disabled={submitting || !email || !password}
        className="w-full"
      >
        {submitting ? "Logging in..." : "Log in"}
      </Button>
      <div className="mt-4 flex flex-col gap-1 text-sm text-[var(--muted)]">
        <Link href="/forgot-password" className="hover:text-[var(--foreground)] cursor-pointer">
          Forgot password?
        </Link>
        {allowSignup && (
          <Link href="/signup" className="hover:text-[var(--foreground)] cursor-pointer">
            Create an account
          </Link>
        )}
      </div>
    </form>
  );
}
