"use client";
import { useConnectivity } from "@/lib/connectivity";
import { cacheSize } from "@/lib/food-cache";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const { online, apiReachable } = useConnectivity();
  const offline = !online || !apiReachable;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (offline) setCount(cacheSize());
  }, [offline]);

  if (!offline) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-medium">Offline mode active</span>
      </div>
      <p className="mt-1 text-xs opacity-90">
        {online
          ? "Server is unreachable."
          : "You are offline."}{" "}
        Using local cache ({count} foods) for estimates. Entries will sync when
        you're back online.
      </p>
    </div>
  );
}
