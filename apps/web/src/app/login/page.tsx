"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/env";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/lib/types";
import { Button, Card, CardBody, CardHeader, Input } from "@calai/ui";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("dev@calai.local");
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
    <div className="flex min-h-screen items-center justify-center px-5">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-xl text-white">
              🥗
            </span>
            <div>
              <h1 className="text-lg font-semibold">Welcome to CalAI</h1>
              <p className="text-xs text-zinc-500">AI-powered calorie tracker</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <a
            href={`${API_URL}/auth/google`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <GoogleG /> Continue with Google
          </a>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs uppercase text-zinc-400">or dev login</span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
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
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
            <p className="text-center text-xs text-zinc-500">
              Dev-only (disabled in production). Uses a test user for API exploration.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
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
