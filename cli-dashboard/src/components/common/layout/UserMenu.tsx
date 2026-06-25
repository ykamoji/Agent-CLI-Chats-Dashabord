"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, logout, type User } from "@/lib/api";

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setLocalUser] = useState<User | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalUser(getStoredUser());
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = (user?.username ?? "User")
    .split(/[\s_]+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    await logout();
    router.push("/auth");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1 pl-1 pr-3 shadow-material transition-colors hover:bg-paper-soft"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-xs font-bold text-paper">
          {initials}
        </span>
        <span className="hidden text-sm font-medium sm:block">
          {user?.username ?? "Account"}
        </span>
        <svg
          className={`h-4 w-4 text-ink-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-material-lg">
          <div className="border-b border-ink/10 px-4 py-3">
            <p className="truncate text-sm font-semibold">{user?.username}</p>
            <p className="truncate text-xs text-ink-muted">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-paper-soft"
          >
            <span aria-hidden>👤</span> Profile
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 border-t border-ink/10 px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <span aria-hidden>⏻</span> Logout
          </button>
        </div>
      )}
    </div>
  );
}
