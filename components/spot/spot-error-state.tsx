"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon, WifiOffIcon } from "@hugeicons/core-free-icons"

export function SpotErrorState({ message }: { message?: string }) {
  const router = useRouter()
  const [retrying, setRetrying] = React.useState(false)

  function handleRetry() {
    setRetrying(true)
    router.refresh()
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-5 bg-background px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <HugeiconsIcon
          icon={WifiOffIcon}
          className="h-8 w-8 text-red-500"
        />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-lg font-semibold">Unable to Load Market Data</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {message || "Could not connect to market data providers. Please check your internet connection and try again."}
        </p>
      </div>

      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`}
        />
        {retrying ? "Retrying…" : "Retry"}
      </button>

      <a
        href="/"
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to Dashboard
      </a>
    </div>
  )
}
