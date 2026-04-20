"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function AuthCallback() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const token = params.get("token");
    if (token) {
      setAuth(token);
      router.replace("/");
    } else {
      router.replace("/login");
    }
  }, [router, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="text-sm text-zinc-500">Signing you in…</span>
    </div>
  );
}
