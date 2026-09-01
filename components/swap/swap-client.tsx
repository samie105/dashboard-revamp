"use client"

/**
 * Compatibility export for callers that still import the former swap client.
 * All swap entry points now render the modern-wallet-only implementation.
 * The props are intentionally accepted and ignored so older dashboard layout
 * code cannot accidentally bring back the legacy quote/sign/submit flow.
 */
import { ModernSwapClient } from "./modern-swap-client"

export function SwapClient({ compact }: {
  coins?: unknown[]
  prices?: Record<string, number>
  error?: string
  compact?: boolean
}) {
  return <ModernSwapClient compact={compact} />
}
