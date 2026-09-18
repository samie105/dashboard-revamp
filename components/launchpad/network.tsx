"use client"

/**
 * Devnet or mainnet — the launchpad the user is looking at.
 *
 * They are separate launchpads (separate curve configs, separate tokens), so
 * the choice scopes the feed and the create form. The options come from the
 * backend: mainnet appears only once it has a curve config. The choice is a
 * per-viewer convenience, kept in localStorage and read through
 * useSyncExternalStore (hydration-safe; no setState in an effect).
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Segmented } from "@/components/ui/system"
import {
  cryptoBackendClient,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { LaunchpadNetworkId } from "@/lib/crypto-backend/types"
import { cn } from "@/lib/utils"

const KEY = "ws:launchpad:network"
const EVENT = "ws-launchpad-network"

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function useLaunchNetwork() {
  const options = useQuery({
    queryKey: ["launchpad", "networks"],
    queryFn: ({ signal }) => cryptoBackendClient.getLaunchpadNetworks(signal),
    enabled: isCryptoBackendEnabled,
    staleTime: 5 * 60_000,
  })
  const stored = React.useSyncExternalStore(subscribe, read, () => null)
  const networks = options.data?.networks ?? []
  // A stored choice only counts if the backend still offers it.
  const networkId: LaunchpadNetworkId | null = (networks.find(
    (n) => n.networkId === stored
  )?.networkId ??
    options.data?.defaultNetworkId ??
    null) as LaunchpadNetworkId | null

  const setNetworkId = React.useCallback((next: LaunchpadNetworkId) => {
    try {
      window.localStorage.setItem(KEY, next)
    } catch {
      /* a blocked store costs the memory of the choice, not the switch */
    }
    window.dispatchEvent(new Event(EVENT))
  }, [])

  return {
    networks,
    networkId,
    setNetworkId,
    isLoading: options.isLoading,
    error: options.error,
  }
}

export const isDevnet = (networkId: string | null | undefined) =>
  networkId === "solana-devnet"

/** The switch, or — when only one network is offered — a plain badge. */
export function NetworkSwitch({
  networks,
  networkId,
  onChange,
}: {
  networks: Array<{ networkId: LaunchpadNetworkId; label: string }>
  networkId: LaunchpadNetworkId | null
  onChange: (next: LaunchpadNetworkId) => void
}) {
  if (!networkId) return null
  if (networks.length < 2) return <NetworkBadge networkId={networkId} />
  return (
    <Segmented
      size="sm"
      options={networks.map((n) => ({ key: n.networkId, label: n.label }))}
      value={networkId}
      onChange={(next) => onChange(next as LaunchpadNetworkId)}
    />
  )
}

/** Devnet is flagged in the warning tone: its tokens have no value, and
 *  nobody should mistake a devnet launch for a real one. */
export function NetworkBadge({
  networkId,
  className,
}: {
  networkId: string
  className?: string
}) {
  const devnet = isDevnet(networkId)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] uppercase",
        devnet
          ? "bg-warning-chip text-warning"
          : "bg-foreground/[0.07] text-foreground",
        className
      )}
    >
      {devnet ? "Devnet" : "Mainnet"}
    </span>
  )
}
