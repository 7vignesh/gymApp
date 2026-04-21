"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const NAV = [
  { href: "/",          label: "Home",   icon: HomeIcon },
  { href: "/add",       label: "Add",    icon: PlusIcon },
  { href: "/upload",    label: "Scan",   icon: CameraIcon },
  { href: "/exercises", label: "Gym",    icon: DumbbellIcon },
  { href: "/history",   label: "Trends", icon: ChartIcon },
  { href: "/settings",  label: "Me",     icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, user, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!token || user) return;
    api.get<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, [token, user, setUser]);

  const isAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/auth");
  if (isAuthRoute) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-ink-900/60 px-5 py-3 backdrop-blur-xl animate-fade-down"
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]"
            style={{ backgroundImage: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }}
          >
            <LeafIcon className="h-4.5 w-4.5" />
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-white/0 transition-colors group-hover:bg-white/10" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight text-white">
              calorie<span className="brand-text">X</span>
            </span>
            <span className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              AI nutrition
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-[140px] truncate text-sm text-zinc-400 sm:inline">
                {user.name ?? user.email}
              </span>
              <button
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-glow-brand transition-transform hover:-translate-y-0.5"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5 sm:px-6">{children}</main>

      {/* floating glass bottom nav */}
      <nav className="pointer-events-none fixed bottom-4 left-0 right-0 z-20 mx-auto flex max-w-5xl justify-center px-4 animate-fade-up">
        <ul className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/[0.08] bg-ink-900/80 p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.href;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex flex-col items-center gap-0.5 rounded-xl px-3.5 py-2 text-[10px] font-medium transition-all ${
                    active
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-xl shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] animate-scale-in"
                      style={{ backgroundImage: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }}
                    />
                  )}
                  <span className="relative z-10 transition-transform group-hover:-translate-y-0.5">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="relative z-10 tracking-wide">{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/* ---------- inline icons (no new dep) ---------- */
type IconProps = React.SVGProps<SVGSVGElement>;
function svg(props: IconProps, path: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {path}
    </svg>
  );
}
function HomeIcon(p: IconProps)   { return svg(p, <><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></>); }
function PlusIcon(p: IconProps)   { return svg(p, <><path d="M12 5v14" /><path d="M5 12h14" /></>); }
function CameraIcon(p: IconProps) { return svg(p, <><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>); }
function ChartIcon(p: IconProps)  { return svg(p, <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>); }
function UserIcon(p: IconProps)   { return svg(p, <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>); }
function LeafIcon(p: IconProps)   { return svg(p, <><path d="M4 20c4-10 9-14 16-16-2 10-6 15-16 16Z" /><path d="M4 20c4-4 8-6 12-8" /></>); }
function DumbbellIcon(p: IconProps) { return svg(p, <><path d="M3 10v4M7 7v10M17 7v10M21 10v4" /><path d="M7 12h10" /></>); }
