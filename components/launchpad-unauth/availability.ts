"use client"

/**
 * Stage 5 — which chains can launch right now.
 *
 * Three states, and the whole point of the stage is that they LOOK different:
 *
 *   soon    — no adapter for this chain yet. Greyed, "Soon".
 *   paused  — built, but switched off by operations. Visible, disabled, and
 *             it SAYS WHY. A paused chain that looked like an unbuilt one is
 *             how a support ticket gets opened about a feature that was
 *             switched off on purpose.
 *   live    — normal.
 *
 * In production this is `OperationalControl` — keys `launchpad_solana`,
 * `launchpad_ethereum`, `launchpad_intertrain` — a DB-backed switch that flips
 * without a redeploy (implementation plan §7). Its `paused` and `reason`
 * fields are exactly what this models. The preview has no server, so a
 * reviewer control writes the same shape to sessionStorage, and every
 * launchpad page reads it: pause Solana on the discovery page and the create
 * form and every curve ticket respond.
 *
 * Read through useSyncExternalStore for the same reasons as pending-launch:
 * hydration-safe (the server snapshot is the defaults) and no setState in an
 * effect.
 */

import * as React from "react"

export type ChainKey = "solana" | "ethereum" | "intertrain"

export type ChainAvailability = {
  state: "live" | "paused" | "soon"
  /** Operations' own words. Shown verbatim — never paraphrased by the UI. */
  reason?: string
}

export const CHAIN_LABEL: Record<ChainKey, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  intertrain: "Intertrain",
}

export const CHAIN_ORDER: ChainKey[] = ["solana", "ethereum", "intertrain"]

const DEFAULTS: Record<ChainKey, ChainAvailability> = {
  solana: { state: "live" },
  ethereum: { state: "soon" },
  intertrain: { state: "soon" },
}

/** Reasons a reviewer can pick, written the way operations would write them. */
export const PAUSE_REASONS = [
  "Scheduled maintenance on the curve program. Back within the hour.",
  "We're investigating an issue with the curve program. Funds on existing curves are safe.",
] as const

const KEY = "ws:launchpad-preview:availability"
const EVENT = "ws-launchpad-availability"

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(KEY)
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

/** Only Solana is built, so only Solana can be paused. Setting an unbuilt
 *  chain to "paused" would claim an adapter that does not exist. */
export function setSolana(next: ChainAvailability) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ solana: next }))
  } catch {
    /* a blocked store costs the review control, never the page */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function useAvailability(): Record<ChainKey, ChainAvailability> {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null)
  return React.useMemo(() => {
    if (!raw) return DEFAULTS
    try {
      const parsed = JSON.parse(raw) as Partial<
        Record<ChainKey, ChainAvailability>
      >
      const solana = parsed.solana
      if (!solana || (solana.state !== "live" && solana.state !== "paused"))
        return DEFAULTS
      return { ...DEFAULTS, solana }
    } catch {
      return DEFAULTS
    }
  }, [raw])
}
