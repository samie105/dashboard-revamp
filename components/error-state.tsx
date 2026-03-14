"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon, WifiOffIcon } from "@hugeicons/core-free-icons"

/**
 * Inline error state designed to sit inside existing card/section containers.
 * Keeps the surrounding UI structure intact.
 */
export function ErrorState({ message, compact }: { message?: string; compact?: boolean }) {
  const router = useRouter()
  const [retrying, setRetrying] = React.useState(false)

  function handleRetry() {
    setRetrying(true)
    router.refresh()
  }

  if (compact) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
        <HugeiconsIcon icon={WifiOffIcon} className="h-3.5 w-3.5 text-red-400" />
        <span>{message || "Failed to load"}</span>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="ml-1 inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium hover:bg-accent/80 disabled:opacity-60"
        >
          <HugeiconsIcon icon={RefreshIcon} className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
          {retrying ? "…" : "Retry"}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
        <HugeiconsIcon icon={WifiOffIcon} className="h-5 w-5 text-red-500" />
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-xs font-semibold">Unable to Load Data</h3>
        <p className="max-w-xs text-[11px] text-muted-foreground">
          {message || "Could not connect to data providers. Please try again."}
        </p>
      </div>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        <HugeiconsIcon icon={RefreshIcon} className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  )
}
