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
    <div className="relative overflow-hidden rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100 backdrop-blur-xl animate-fade-down">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative h-2 w-2 rounded-full bg-amber-400" />
        </span>
        <span className="font-semibold">Offline mode active</span>
      </div>
      <p className="mt-1 text-xs text-amber-200/80">
        {online ? "Server is unreachable." : "You are offline."} Using local cache
        ({count} foods) for estimates. Entries will sync when you&apos;re back online.
      </p>
    </div>
  );
}
