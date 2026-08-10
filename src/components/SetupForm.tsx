"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LogoMark } from "@/components/ui/Logo";

export default function SetupForm() {
  const router = useRouter();
  const nameId = useId();
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Setup failed.");
        return;
      }

      // Admin created and logged in — go to the app.
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 max-w-md mx-auto mt-12">
      <div className="flex items-center gap-2 mb-1">
        <LogoMark className="w-8 h-8 text-[var(--accent)]" />
        <h1 className="text-xl font-semibold">Welcome — let&apos;s set up</h1>
      </div>
      <p className="text-sm text-[var(--muted)] mb-5">
        This is a fresh install. Create the administrator account for your Guitar
        Junk Tracker. You can add more users later from the admin panel.
      </p>

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
        3–30 chars: lowercase letters, numbers, underscores. Used for your public
        catalog URL /{username || "username"} if you make it public.
      </p>

      <label htmlFor={emailId} className="text-xs text-[var(--muted)]">
        Email <span className="text-[var(--accent)]">*</span>
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
        Password <span className="text-[var(--accent)]">*</span> (min 8 characters)
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

      <label htmlFor={confirmId} className="text-xs text-[var(--muted)]">
        Confirm password <span className="text-[var(--accent)]">*</span>
      </label>
      <input
        id={confirmId}
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full mb-3"
        required
        minLength={8}
        autoComplete="new-password"
      />

      <Alert className="mb-3">{error}</Alert>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Creating admin…" : "Create admin & continue"}
      </Button>
    </form>
  );
}
