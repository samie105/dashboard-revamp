"use client"

/**
 * Spec §2: nudges confirmed legacy-wallet owners to move their funds to the
 * new self-custodial embedded wallet.
 *
 * Two surfaces, and they answer to DIFFERENT state:
 *  - "popup" — a one-time introduction, mounted app-wide by LayoutShell. It
 *    is announcement, not chrome: it appears once per user and never again,
 *    whatever they do with it. Closing it is not a decision, so closing it
 *    must not retire the message.
 *  - "notification" — pinned above fetched notifications in the navbar's
 *    grouped dropdown, on mobile and desktop alike. This is where the
 *    message LIVES after the popup has had its one showing, so it persists
 *    until the user actually resolves it ("I've already moved them", or an
 *    explicit dismiss from the row itself).
 *
 * The dashboard banner is gone. A persistent slab at the top of the main
 * column restated a message the user had already read, and on a phone it
 * cost half the first screen — see the popup + notification pair above.
 *
 * Never shown to modern-only (new) users or while the legacy-wallet lookup
 * is inconclusive — `shouldShowMigrationNotice` (lib/wallet-mode.ts) owns
 * that rule as a pure, unit-tested predicate. This file only wires it to
 * live wallet state, the feature flags, and localStorage.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Wallet01Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { isCryptoBackendEnabled, isLegacyPrivyEnabled } from "@/lib/crypto-backend"
import { migrationNoticeSurfaces, shouldShowMigrationNotice } from "@/lib/wallet-mode"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"

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
/** Separate from dismissal on purpose: "you have been shown this once" and
 *  "you have dealt with this" are different facts. Sharing one key made
 *  closing the popup silently retire the notification-centre entry too. */
const POPUP_SEEN_PREFIX = "ws:migration-popup-seen:"

function dismissalKey(userId: string | undefined) {
  return `${DISMISSAL_PREFIX}${userId ?? "anonymous"}`
}

function popupSeenKey(userId: string | undefined) {
  return `${POPUP_SEEN_PREFIX}${userId ?? "anonymous"}`
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
      if (!event.key.startsWith(DISMISSAL_PREFIX) && !event.key.startsWith(POPUP_SEEN_PREFIX)) return
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
    /** Also used to mark the popup seen (value "dismissed" on its own key). */
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
function useMigrationDismissal(userId: string | undefined, keyOverride?: string) {
  const key = keyOverride ?? dismissalKey(userId)
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

/** Shared wiring. The pure predicate stays in lib/wallet-mode.ts; this hook
 *  feeds it live state and reports the two facts separately:
 *   · `eligible`  — this user should hear the message at all.
 *   · `resolved`  — they have dealt with it, so the notification entry retires.
 *   · `popupSeen` — the one-time introduction has already run. */
function useMigrationNoticeState() {
  const { user } = useAuth()
  const { legacyWalletExists } = useWallet()
  const { snapshot, dismiss } = useMigrationDismissal(user?.userId)
  const { snapshot: seenSnapshot, dismiss: markSeen } = useMigrationDismissal(
    // A distinct key, read through the same store so every mounted instance
    // and every open tab agree on it.
    undefined,
    popupSeenKey(user?.userId),
  )

  const known = snapshot !== "unknown" && seenSnapshot !== "unknown"
  const eligible =
    known &&
    shouldShowMigrationNotice({
      modernEnabled: isCryptoBackendEnabled,
      legacyEnabled: isLegacyPrivyEnabled,
      legacyWalletExists,
      // Eligibility asks "does this user have a legacy wallet to move?", not
      // "have they closed something" — resolution is applied per surface.
      dismissed: false,
    })

  return {
    eligible,
    resolved: snapshot !== null && snapshot !== "unknown",
    popupSeen: seenSnapshot !== null && seenSnapshot !== "unknown",
    dismiss,
    markSeen: React.useCallback(() => markSeen("dismissed"), [markSeen]),
  }
}

function MigrationPopupBody({ onConfirm, onClose }: {
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/[0.12] text-primary">
          <HugeiconsIcon icon={Wallet01Icon} className="h-6 w-6" />
        </span>
        <ResponsiveModalTitle className="font-display text-[17px] font-semibold">
          {MIGRATION_LEAD}
        </ResponsiveModalTitle>
        <ResponsiveModalDescription className="text-[13px] leading-relaxed">
          {MIGRATION_REST.trim()}
        </ResponsiveModalDescription>
      </div>
      <div className="flex flex-col gap-2">
        <Link
          href="/wallet/modern"
          onClick={onClose}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-[13px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Move my funds
        </Link>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex min-h-11 items-center justify-center rounded-full px-5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          I&rsquo;ve already moved them
        </button>
      </div>
      {/* No "remind me later". The popup only ever runs once; the message
          then lives in the notification centre, which is where the user can
          come back to it on their own terms. */}
      <p className="text-center text-[11px] text-muted-foreground/60">
        You can find this again under notifications.
      </p>
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
            className="inline-flex min-h-9 items-center text-[11px] font-semibold text-primary transition-colors hover:text-primary/80"
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
        className="shrink-0 self-start rounded p-2.5 opacity-100 transition-opacity hover:bg-muted/50 focus-visible:opacity-100 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 text-muted-foreground/50" />
      </button>
    </div>
  )
}

/**
 * Whether this popup currently owns the screen.
 *
 * The welcome guide has to know, because two first-run modals on one load is
 * the exact failure both are written to avoid — and `popupSeen` cannot answer
 * it: this popup marks itself seen the MOMENT it opens, so the predicate goes
 * false while the modal is still standing there.
 *
 * Module-level, like the dismissal store above and for the same reason: the
 * fact is about the screen, not about one component instance.
 */
const popupOnScreen = (() => {
  let open = false
  const listeners = new Set<() => void>()
  return {
    set(next: boolean) {
      if (open === next) return
      open = next
      for (const listener of listeners) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    get: () => open,
    getServerSnapshot: () => false,
  }
})()

/** For anything that must wait its turn behind this popup. */
export function useMigrationPopupOwnsScreen(): boolean {
  const live = React.useSyncExternalStore(
    popupOnScreen.subscribe,
    popupOnScreen.get,
    popupOnScreen.getServerSnapshot,
  )
  const { eligible, resolved, popupSeen } = useMigrationNoticeState()
  /* `live` only turns true in an effect, one commit after a sibling could
     already have opened itself. The predicate is what covers that first
     render; the store is what covers every render after `markSeen` has made
     the predicate lie. Either one is reason enough to wait. */
  return live || migrationNoticeSurfaces({ eligible, resolved, popupSeen }).popup
}

/**
 * The one-time introduction. Mounted once, app-wide, by LayoutShell.
 *
 * `markSeen` fires when the popup is first shown, not when it is closed: a
 * user who reloads mid-read has already had their showing, and a popup that
 * can reappear because it was never formally closed is exactly the thing
 * this is meant not to be.
 */
export function MigrationNoticePopup() {
  const { eligible, resolved, popupSeen, dismiss, markSeen } = useMigrationNoticeState()
  const show = migrationNoticeSurfaces({ eligible, resolved, popupSeen }).popup
  const [open, setOpenState] = React.useState(false)

  // Every open/close goes through the shared store as well as local state,
  // so whatever is waiting behind this popup learns the moment it lets go.
  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next)
    popupOnScreen.set(next)
  }, [])

  React.useEffect(() => {
    if (!show) return
    setOpen(true)
    markSeen()
  }, [show, markSeen, setOpen])

  // A route change that unmounts this must not leave the screen claimed.
  React.useEffect(() => () => popupOnScreen.set(false), [])

  if (!show && !open) return null

  return (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalContent className="sm:max-w-sm">
        <ResponsiveModalHeader className="sr-only">
          <ResponsiveModalTitle>{MIGRATION_LEAD}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <MigrationPopupBody
          onClose={() => setOpen(false)}
          onConfirm={() => { dismiss("confirmed"); setOpen(false) }}
        />
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}

/** The notification-centre entry — mobile and desktop alike. Outlives the
 *  popup and retires only when the user resolves it. */
export function MigrationNotice({ variant }: { variant: "notification" }) {
  const { eligible, resolved, popupSeen, dismiss } = useMigrationNoticeState()
  if (variant !== "notification") return null
  if (!migrationNoticeSurfaces({ eligible, resolved, popupSeen }).notification) return null

  return (
    <MigrationNotificationRow
      onConfirm={() => dismiss("confirmed")}
      onDismiss={() => dismiss("dismissed")}
    />
  )
}
