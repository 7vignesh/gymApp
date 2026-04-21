"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/env";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/lib/types";
import { Button, Input } from "@caloriex/ui";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("dev@caloriex.local");
  const [error, setError] = useState<string | null>(null);

  async function devLogin() {
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await api.post<{ token: string; user: User }>(
        "/auth/dev-login",
        { email },
      );
      setAuth(token, user);
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      {/* animated orb backdrop */}
      <Orbs />

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        {/* brand header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div
            className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow-brand animate-float-y"
            style={{ backgroundImage: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d="M4 20c4-10 9-14 16-16-2 10-6 15-16 16Z" />
              <path d="M4 20c4-4 8-6 12-8" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Welcome to <span className="brand-text">calorieX</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              AI-powered calorie tracker
            </p>
          </div>
        </div>

        {/* auth card */}
        <div className="glass-strong rounded-2xl p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]">
          <a
            href={`${API_URL}/auth/google`}
            className="group relative flex h-11 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-100 transition-all hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.98]"
          >
            <GoogleG />
            <span>Continue with Google</span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
          </a>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              or dev login
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="flex flex-col gap-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={devLogin} loading={loading}>
              Dev sign in
            </Button>
            {error && (
              <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300 animate-fade-in">
                {error}
              </p>
            )}
            <p className="text-center text-[11px] text-zinc-500">
              Dev-only (disabled in production). Uses a test user for API exploration.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          By continuing you agree to our Terms &amp; Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function Orbs() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full blur-3xl animate-float-y"
        style={{ background: "radial-gradient(closest-side, rgba(16,185,129,0.35), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full blur-3xl animate-float-y"
        style={{ background: "radial-gradient(closest-side, rgba(6,182,212,0.3), transparent)", animationDelay: "1.2s" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(167,139,250,0.22), transparent)" }}
      />
    </>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
