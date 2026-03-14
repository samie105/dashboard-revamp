"use client"

import * as React from "react"
import Image from "next/image"
import { useWallet } from "@/components/wallet-provider"

export function WalletGenerationModal() {
  const { isLoading, walletsGenerated, wallets, setupStatus } = useWallet()

  // Only show while loading for the first time (no wallets yet)
  if (!isLoading || walletsGenerated || wallets) return null

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-background/90 backdrop-blur-lg animate-in fade-in duration-500">
      <div className="w-full max-w-md p-8 text-center">
        {/* Animated spinner with logo */}
        <div className="relative mx-auto mb-8 h-24 w-24">
          {/* Pulsing glow */}
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" />

          {/* Logo container */}
          <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full border-2 border-primary/30 bg-card shadow-[0_0_30px_rgba(var(--primary),0.15)]">
            <Image
              src="/worldstreet-logo/WorldStreet4x.png"
              alt="WorldStreet"
              width={48}
              height={48}
              className="animate-pulse"
            />
          </div>

          {/* Spinning ring */}
          <div className="absolute -inset-1 animate-spin rounded-full border-t-2 border-r-2 border-primary" />
        </div>

        <h2 className="mb-2 text-2xl font-bold tracking-tight">
          Initializing Secure Wallets
        </h2>

        {/* Status line */}
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
          {setupStatus ?? "Securing your cross-chain infrastructure…"}
        </p>

        {/* Progress bar */}
        <div className="mt-8 space-y-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-border bg-muted">
            <div className="h-full animate-indeterminate rounded-full bg-primary" />
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            <span>WorldStreet Gold Cloud</span>
            <span className="animate-pulse">Syncing…</span>
          </div>
        </div>

        <p className="mx-auto mt-12 max-w-xs text-[10px] text-muted-foreground/50">
          We are generating your unique crypto addresses across multiple chains.
        </p>
      </div>
    </div>
  )
}
