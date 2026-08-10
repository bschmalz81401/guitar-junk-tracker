"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LogoMark } from "@/components/ui/Logo";

export default function SignupForm() {
  const router = useRouter();
  const nameId = useId();
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Sign-up failed");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-sm mx-auto mt-12">
      <div className="flex items-center gap-2 mb-4">
        <LogoMark className="w-8 h-8 text-[var(--accent)]" />
        <div>
          <h1 className="text-xl font-semibold">Create account</h1>
          <p className="text-sm text-[var(--muted)]">
            Start your own gear catalog — separate from everyone else&apos;s.
          </p>
        </div>
      </div>
      <label htmlFor={nameId} className="text-xs text-[var(--muted)]">
        Display name (optional)
      </label>
      <input
        id={nameId}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full mb-3"
        autoComplete="name"
      />
      <label htmlFor={usernameId} className="text-xs text-[var(--muted)]">
        Username <span className="text-[var(--accent)]">*</span>
      </label>
      <input
        id={usernameId}
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase())}
        className="w-full mb-1"
        required
        minLength={3}
        maxLength={30}
        pattern="[a-z0-9_]{3,30}"
        autoComplete="username"
        placeholder="your_name"
      />
      <p className="text-xs text-[var(--muted)] mb-3">
        Public URL will be /{username || "username"} if you make your catalog public.
      </p>
      <label htmlFor={emailId} className="text-xs text-[var(--muted)]">
        Email
      </label>
      <input
        id={emailId}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full mb-3"
        required
        autoComplete="email"
      />
      <label htmlFor={passwordId} className="text-xs text-[var(--muted)]">
        Password (min 8 characters)
      </label>
      <input
        id={passwordId}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full mb-3"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <Alert className="mb-3">{error}</Alert>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Creating..." : "Sign up"}
      </Button>
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)] hover:underline cursor-pointer">
          Log in
        </Link>
      </p>
    </form>
  );
}
