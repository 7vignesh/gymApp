"use client";
import { useEffect, useState } from "react";
import { API_URL } from "./env";

/**
 * Combines navigator.onLine with a periodic API ping.
 *   - true  → browser online AND API reachable
 *   - false → otherwise (UI should switch to offline mode)
 *
 * Ping interval: 30s while online, 10s while offline (to recover fast).
 */
export function useConnectivity(): { online: boolean; apiReachable: boolean } {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [apiReachable, setApiReachable] = useState<boolean>(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let stopped = false;

    async function ping() {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(`${API_URL}/health`, {
          cache: "no-store",
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!stopped) setApiReachable(res.ok);
      } catch {
        if (!stopped) setApiReachable(false);
      }
    }

    void ping();
    const interval = setInterval(ping, apiReachable && online ? 30_000 : 10_000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [online, apiReachable]);

  return { online, apiReachable };
}
