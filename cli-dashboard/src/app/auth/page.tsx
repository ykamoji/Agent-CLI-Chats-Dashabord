"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login } from "@/lib/api";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("mode") === "signup" ? "signup" : "signin"
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (isSignup) {
      if (!name) {
        setError("Please enter a username.");
        return;
      }
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    // The backend exposes a single /api/authenticate endpoint.
    // When signing up, we send the signup flag along with the email.
    const identifier = isSignup ? name : email;

    setLoading(true);
    try {
      await login(
        identifier,
        password,
        isSignup ? { signup: true, email } : undefined
      );
      router.push("/dashboard");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Invalid credentials."
            : err.status === 409
              ? err.message
              : err.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      {/* Toggle */}
      <div className="mb-8 grid grid-cols-2 gap-1 rounded-full border border-ink/10 bg-paper-soft p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-full py-2 text-sm font-medium transition-colors ${mode === m
              ? "bg-ink text-paper shadow-material"
              : "text-ink-muted hover:text-ink"
              }`}
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <h1 className="font-display text-3xl  tracking-tight">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {isSignup
          ? "Start analyzing your agent conversations."
          : "Sign in to open your dashboard."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <Field
            label="Username"
            type="text"
            value={name}
            onChange={setName}
            placeholder="jane_dev"
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
        />
        {isSignup && (
          <Field
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
          />
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-ink py-3.5 text-sm font-semibold text-paper shadow-material transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : isSignup
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <button
          type="button"
          onClick={() => setMode(isSignup ? "signin" : "signup")}
          className="font-medium text-ink underline underline-offset-4"
        >
          {isSignup ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted/50 focus:border-ink focus:ring-2 focus:ring-ink/10"
      />
    </label>
  );
}

export default function AuthPage() {
  return (
    <main className="relative grid min-h-screen place-items-center bg-paper px-6 py-12 text-ink">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <Link
        href="/"
        className="absolute left-6 top-6 z-10 flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        ← Back home
      </Link>
      <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-ink/10 bg-white p-8 shadow-material-lg sm:p-10">
        <Suspense fallback={<div className="h-96 w-full max-w-xl" />}>
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
