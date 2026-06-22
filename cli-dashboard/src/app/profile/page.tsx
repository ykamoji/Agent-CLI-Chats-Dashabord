"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getProfile,
  getStoredUser,
  isAuthenticated,
  updatePassword,
  type User,
} from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth");
      return;
    }
    // Show cached user immediately, then refresh from the server.
    setUser(getStoredUser());
    getProfile()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/auth");
        }
      });
  }, [router]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Please fill in both fields." });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSaving(true);
    try {
      await updatePassword(newPassword, confirmPassword);
      setMessage({ type: "ok", text: "Password updated successfully." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/auth");
        return;
      }
      setMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "Update failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper text-ink-muted">
        Loading…
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-paper text-ink">
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-2xl px-6 py-10">
        {/* Back button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-medium shadow-material transition-colors hover:bg-paper-soft"
        >
          ← Back to dashboard
        </button>

        <div className="mt-8">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-xl font-bold text-paper">
              {(user.username ?? "U").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h1 className="font-display text-3xl tracking-tight">
                {user.username}
              </h1>
              <p className="text-sm text-ink-muted">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Account details */}
        <section className="mt-10 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-material">
          <div className="border-b border-ink/10 px-6 py-4">
            <h2 className="font-display text-lg font-bold">Account details</h2>
          </div>
          <dl className="divide-y divide-ink/5">
            <Detail label="User ID" value={user.user_id} mono />
            <Detail label="Username" value={user.username} />
            <Detail label="Email" value={user.email} />
            <Detail label="Password" value="••••••••••••" mono />
          </dl>
        </section>

        {/* Update password */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-material">
          <div className="border-b border-ink/10 px-6 py-4">
            <h2 className="font-display text-lg font-bold">Update password</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Enter a new password and confirm it to update.
            </p>
          </div>
          <form onSubmit={handleUpdate} className="space-y-4 p-6">
            <Field
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="••••••••"
            />
            <Field
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
            />

            {message && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${message.type === "ok"
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
                  }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-paper shadow-material transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <dt className="text-xs uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className={`text-sm ${mono ? "font-mono" : "font-medium"}`}>
        {value}
      </dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
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
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-ink-muted/50 focus:border-ink focus:ring-2 focus:ring-ink/10"
      />
    </label>
  );
}
