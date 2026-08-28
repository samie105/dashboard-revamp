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

// Verbatim spec copy — never edit without checking spec §2. Never implies
// Worldstreet can recover or access keys.
const MIGRATION_LEAD = "Your legacy wallet is still available."
const MIGRATION_REST =
  " For the new Worldstreet self-custodial experience, move your funds to your Worldstreet " +
  "embedded wallet. You control the keys, and signing happens locally on your device."
const MIGRATION_COPY = MIGRATION_LEAD + MIGRATION_REST

type Dismissal = "dismissed" | "confirmed" | null

function dismissalKey(userId: string | undefined) {
  return `ws:migration-dismissed:${userId ?? "anonymous"}`
}

function readDismissal(userId: string | undefined): Dismissal {
  try {
    const raw = window.localStorage.getItem(dismissalKey(userId))
    return raw === "dismissed" || raw === "confirmed" ? raw : null
  } catch {
    return null
  }
}

function writeDismissal(userId: string | undefined, value: "dismissed" | "confirmed") {
  try {
    window.localStorage.setItem(dismissalKey(userId), value)
  } catch { /* private mode — the notice just returns next visit, harmless */ }
}

/** Shared visibility + dismissal wiring for both variants. The pure
 *  predicate stays in lib/wallet-mode.ts; this hook feeds it live state. */
function useMigrationNoticeVisible() {
  const { user } = useAuth()
  const { legacyWalletExists } = useWallet()
  const [dismissal, setDismissal] = React.useState<Dismissal>(null)
  // Gate on having read localStorage first so an already-dismissed notice
  // never flashes on screen before vanishing (mirrors MnaBanner's pattern).
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setDismissal(readDismissal(user?.userId))
    setHydrated(true)
  }, [user?.userId])

  const visible =
    hydrated &&
    shouldShowMigrationNotice({
      modernEnabled: isCryptoBackendEnabled,
      legacyEnabled: isLegacyPrivyEnabled,
      legacyWalletExists,
      dismissed: dismissal !== null,
    })

  const dismiss = React.useCallback(
    (value: "dismissed" | "confirmed") => {
      setDismissal(value)
      writeDismissal(user?.userId, value)
    },
    [user?.userId],
  )

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
            Move funds
          </Link>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            I&rsquo;ve finished migrating
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
          <span className="text-xs font-medium">Legacy wallet migration</span>
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
            Move funds
          </Link>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[10px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            I&rsquo;ve finished migrating
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
