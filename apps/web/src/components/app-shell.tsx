"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/add", label: "Add", icon: "➕" },
  { href: "/upload", label: "Scan", icon: "📷" },
  { href: "/history", label: "Trends", icon: "📈" },
  { href: "/settings", label: "Me", icon: "⚙️" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, user, setUser, logout } = useAuthStore();

  // Hydrate user profile once we have a token.
  useEffect(() => {
    if (!token || user) return;
    api.get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {/* invalid token handled by api client */});
  }, [token, user, setUser]);

  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/auth");

  if (isAuthRoute) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-5 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white">🥗</span>
          <span className="text-lg font-semibold tracking-tight">CalAI</span>
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">
                {user.name ?? user.email}
              </span>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5 sm:px-6">{children}</main>

      {/* Mobile-first bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto max-w-5xl border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <ul className="grid grid-cols-5">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`flex flex-col items-center gap-0.5 py-3 text-xs ${
                    active ? "text-emerald-600" : "text-zinc-500"
                  }`}
                >
                  <span className="text-xl leading-none">{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
