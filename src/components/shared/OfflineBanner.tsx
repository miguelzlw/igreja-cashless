"use client";

import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      <div className="flex items-center justify-center gap-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01"
          />
        </svg>
        <span>Sem conexão com a internet. Verifique seu sinal.</span>
      </div>
    </div>
  );
}
