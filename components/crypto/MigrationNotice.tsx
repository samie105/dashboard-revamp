"use client"

/**
 * Spec §2: nudges confirmed legacy-wallet owners to move their funds to the
 * new self-custodial embedded wallet. Two surfaces, one predicate:
 *  - "banner" — first thing in the dashboard's main column.
 *  - "notification" — pinned above fetched notifications in the navbar's
 *    grouped dropdown.
 *
 * Never shown to modern-only (new) users or while the legacy-wallet lookup
 * is inconclusive — `shouldShowMigrationNotice` (lib/wallet-mode.ts) owns
 * that rule as a pure, unit-tested predicate. This file only wires it to
 * live wallet state, the feature flags, and localStorage dismissal.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Wallet01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { isCryptoBackendEnabled, isLegacyPrivyEnabled } from "@/lib/crypto-backend"
import { shouldShowMigrationNotice } from "@/lib/wallet-mode"
import { IconAction } from "@/components/ui/system"

// Plain-language rewrite of the spec §2 copy (owner's call, 2026-08-29):
// the verbatim spec text ("self-custodial", "embedded wallet", "signing
// happens locally") confused crypto newcomers. Meaning is preserved — and it
// must NEVER imply Worldstreet can recover or access keys; "not even
// Worldstreet can open it" states the truthful opposite.
const MIGRATION_LEAD = "You have a new Worldstreet wallet."
const MIGRATION_REST =
  " Your old wallet still works, but your new wallet belongs to you alone — it's protected " +
  "by a passphrase only you know, and not even Worldstreet can open it. When you're ready, " +
  "move your money over."
const MIGRATION_COPY = MIGRATION_LEAD + MIGRATION_REST

type DismissalValue = "dismissed" | "confirmed" | null
/** "unknown" = not read yet (SSR / not-yet-mounted) — treated as "don't
 *  show" until we actually know, same as "dismissed", but tracked
 *  separately so a real known-not-dismissed state (`null`) is unambiguous. */
type DismissalSnapshot = DismissalValue | "unknown"

const DISMISSAL_PREFIX = "ws:migration-dismissed:"

function dismissalKey(userId: string | undefined) {
  return `${DISMISSAL_PREFIX}${userId ?? "anonymous"}`
}

function parseDismissal(raw: string | null): DismissalValue {
  return raw === "dismissed" || raw === "confirmed" ? raw : null
}

/**
 * Module-level store backing both `MigrationNotice` variants (and every tab
 * this page is open in). The banner (dashboard) and the notification row
 * (navbar) can be mounted at the same time; without a shared store,
 * dismissing one left the other showing until a reload. `useSyncExternalStore`
 * keeps every subscribed instance — same tab or another tab via the
 * `storage` event — reading the same snapshot and re-rendering together.
 */
const migrationDismissalStore = (() => {
  const cache = new Map<string, DismissalValue>()
  const listeners = new Set<() => void>()
  let storageListenerAttached = false

  function notify() {
    for (const listener of listeners) listener()
  }

  function ensureStorageListener() {
    if (storageListenerAttached || typeof window === "undefined") return
    storageListenerAttached = true
    window.addEventListener("storage", (event) => {
      // localStorage.clear() (this tab or another) fires with key: null —
      // drop everything cached so the next read starts fresh.
      if (event.key === null) {
        cache.clear()
        notify()
        return
      }
      if (!event.key.startsWith(DISMISSAL_PREFIX)) return
      cache.set(event.key, parseDismissal(event.newValue))
      notify()
    })
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      ensureStorageListener()
      return () => { listeners.delete(listener) }
    },
    getSnapshot(key: string): DismissalSnapshot {
      if (!cache.has(key)) {
        if (typeof window === "undefined") return "unknown"
        try {
          cache.set(key, parseDismissal(window.localStorage.getItem(key)))
        } catch {
          cache.set(key, null)
        }
      }
      return cache.get(key) ?? null
    },
    getServerSnapshot(): DismissalSnapshot {
      return "unknown"
    },
    dismiss(key: string, value: "dismissed" | "confirmed") {
      cache.set(key, value)
      try {
        window.localStorage.setItem(key, value)
      } catch { /* private mode — the dismissal just won't persist/cross-tab, harmless */ }
      notify()
    },
  }
})()

/** Reads this user's dismissal through the shared store, kept in sync
 *  across every mounted instance and every open tab. */
function useMigrationDismissal(userId: string | undefined) {
  const key = dismissalKey(userId)
  const getSnapshot = React.useCallback(
    () => migrationDismissalStore.getSnapshot(key),
    [key],
  )
  const snapshot = React.useSyncExternalStore(
    migrationDismissalStore.subscribe,
    getSnapshot,
    migrationDismissalStore.getServerSnapshot,
  )
  const dismiss = React.useCallback(
    (value: "dismissed" | "confirmed") => migrationDismissalStore.dismiss(key, value),
    [key],
  )
  return { snapshot, dismiss }
}

/** Shared visibility + dismissal wiring for both variants. The pure
 *  predicate stays in lib/wallet-mode.ts; this hook feeds it live state. */
function useMigrationNoticeVisible() {
  const { user } = useAuth()
  const { legacyWalletExists } = useWallet()
  const { snapshot, dismiss } = useMigrationDismissal(user?.userId)

  const visible =
    snapshot !== "unknown" &&
    shouldShowMigrationNotice({
      modernEnabled: isCryptoBackendEnabled,
      legacyEnabled: isLegacyPrivyEnabled,
      legacyWalletExists,
      dismissed: snapshot !== null,
    })

  return { visible, dismiss }
}

function DismissIcon({ className }: { className?: string }) {
  return <HugeiconsIcon icon={Cancel01Icon} className={className} />
}

function MigrationBanner({ onConfirm, onDismiss }: {
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface-sunken/70 px-4 py-3.5 ring-1 ring-border/25">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
        <HugeiconsIcon icon={Wallet01Icon} className="h-4 w-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{MIGRATION_LEAD}</span>
          {MIGRATION_REST}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/wallet/modern"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-4 py-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Move my funds
          </Link>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            I&rsquo;ve already moved them
          </button>
        </div>
      </div>
      <IconAction icon={DismissIcon} label="Dismiss" onClick={onDismiss} />
    </div>
  )
}

function MigrationNotificationRow({ onConfirm, onDismiss }: {
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    // border-b separates the pinned entry from the fetched list below it —
    // only present when this row actually renders, so it never leaves a
    // stray divider when there's nothing to pin.
    <div className="group flex gap-2.5 border-b border-border/15 px-3.5 py-2.5 hover:bg-muted/30 transition-colors">
      <HugeiconsIcon icon={Wallet01Icon} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">Your new wallet is ready</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase text-primary">
            Pinned
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/60 line-clamp-2">
          {MIGRATION_COPY}
        </p>
        <div className="mt-1 flex items-center gap-3">
          <Link
            href="/wallet/modern"
            className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Move my funds
          </Link>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[10px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            I&rsquo;ve already moved them
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss migration notice"
        className="shrink-0 self-start p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 text-muted-foreground/50" />
      </button>
    </div>
  )
}

export function MigrationNotice({ variant }: { variant: "banner" | "notification" }) {
  const { visible, dismiss } = useMigrationNoticeVisible()
  if (!visible) return null

  const onConfirm = () => dismiss("confirmed")
  const onDismiss = () => dismiss("dismissed")

  return variant === "banner" ? (
    <MigrationBanner onConfirm={onConfirm} onDismiss={onDismiss} />
  ) : (
    <MigrationNotificationRow onConfirm={onConfirm} onDismiss={onDismiss} />
  )
}
