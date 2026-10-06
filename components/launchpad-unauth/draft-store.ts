"use client"

/**
 * The create-flow draft, kept in localStorage so it survives a reload, a
 * closed tab or a crash — the guided steps pick up on the step you left,
 * with every field (and the icon) as you left them.
 *
 * Read through useSyncExternalStore, the same pattern pending-launch.ts uses:
 * hydration-safe by construction (the server snapshot is the empty draft) and
 * no setState-in-an-effect to copy storage into React. Components don't hold
 * the draft in local state at all — they read it from here and write it back,
 * so there is one copy and it's always the saved one.
 *
 * The icon is stored as a data URL (an object URL dies with the page). The
 * form caps icons at 1 MB, which fits comfortably in the ~5 MB quota; a write
 * that fails anyway is reported to the caller rather than thrown.
 */

import * as React from "react"
import type { ChainKey } from "@/components/launchpad-unauth/availability"
import type { Draft } from "@/components/launchpad-unauth/launch-data"

export const STEPS = ["Chain", "Identity", "Story", "Allocation", "Review"] as const
export type StepIndex = 0 | 1 | 2 | 3 | 4

export type CreateState = {
  draft: Draft
  chain: ChainKey
  step: StepIndex
  /** Furthest step reached — the stepper lets you jump back to any of these. */
  reached: StepIndex
  /** Epoch ms of the last save, for the "Saved" hint. */
  savedAt: number | null
}

export const EMPTY_DRAFT: Draft = { name: "", symbol: "", description: "", website: "", x: "", telegram: "", creatorBps: 0 }
const EMPTY: CreateState = { draft: EMPTY_DRAFT, chain: "solana", step: 0, reached: 0, savedAt: null }

const KEY = "ws:launchpad-preview:create"
const EVENT = "ws-launchpad-create"

function readRaw(): string | null {
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

function parse(raw: string | null): CreateState {
  if (!raw) return EMPTY
  try {
    const p = JSON.parse(raw) as Partial<CreateState>
    // Another build or a hand-edit can write this key: take what's valid.
    const step = (typeof p.step === "number" && p.step >= 0 && p.step <= 4 ? p.step : 0) as StepIndex
    return {
      draft: { ...EMPTY_DRAFT, ...(p.draft ?? {}) },
      chain: p.chain ?? "solana",
      step,
      reached: (typeof p.reached === "number" ? Math.max(step, Math.min(4, p.reached)) : step) as StepIndex,
      savedAt: typeof p.savedAt === "number" ? p.savedAt : null,
    }
  } catch {
    return EMPTY
  }
}

export function useCreateState(): CreateState {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => null)
  return React.useMemo(() => parse(raw), [raw])
}

/** Merge a change into the saved state. Returns false if storage refused it. */
export function saveCreate(patch: Partial<Omit<CreateState, "draft">> & { draft?: Partial<Draft> }): boolean {
  const cur = parse(readRaw())
  const step = patch.step ?? cur.step
  const next: CreateState = {
    ...cur,
    ...patch,
    draft: { ...cur.draft, ...(patch.draft ?? {}) },
    step,
    reached: Math.max(cur.reached, step, patch.reached ?? 0) as StepIndex,
    savedAt: Date.now(),
  }
  let ok = true
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    ok = false
  }
  window.dispatchEvent(new Event(EVENT))
  return ok
}

export function clearCreate() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* a blocked store costs the resume, never the page */
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Read a picked file as a data URL, so the icon survives a reload. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}
