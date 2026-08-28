"use client"

/**
 * The unlock surface. Every later flow opens this when the wallet's DEK is
 * locked or its short TTL expired, and resumes the caller's action through
 * `onUnlocked` instead of forcing a re-trigger. A real modal — Escape,
 * outside-click, and focus-trap all come free from ResponsiveModal, unlike
 * the inline div this replaces.
 */

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
} from "@/components/ui/responsive-modal"
import { Segmented, type SegmentedOption } from "@/components/ui/system"
import { Input } from "@/components/ui/input"
import { SectionMessage } from "@/components/crypto/primitives"
import { useAuth } from "@/components/auth-provider"
import { useCryptoContext } from "@/components/crypto/CryptoProvider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { WalletUnlockError } from "@/lib/crypto-wallet/wallet-security"

type UnlockTab = "passphrase" | "recovery"

const UNLOCK_TABS: readonly SegmentedOption<UnlockTab>[] = [
  { key: "passphrase", label: "Passphrase" },
  { key: "recovery", label: "Recovery secret" },
]

/** Full-width pill CTA. Deliberately plain — no gold breathing glow, that
 *  belongs to the one money-moving CTA (FlowCta); unlocking isn't a money
 *  action. */
const CTA_CLASS = "flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"

export function WalletUnlockDialog({ open, onOpenChange, onUnlocked }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnlocked?: () => void
}) {
  const { user } = useAuth()
  const { wallet, security } = useCryptoContext()
  const userId = user?.userId ?? "anonymous"
  const walletId = wallet.data?.id

  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(walletId) && open,
    staleTime: 60_000,
  })
  const packageValue = packageQuery.data
  const hasPassphrase = packageValue ? packageValue.envelopes.some((envelope) => (envelope as { purpose?: string }).purpose === "passphrase") : false

  const [tab, setTab] = useState<UnlockTab>("passphrase")
  const [passphrase, setPassphrase] = useState("")
  const [recoverySecret, setRecoverySecret] = useState("")
  const [newPassphrase, setNewPassphrase] = useState("")
  const [newPassphraseConfirmation, setNewPassphraseConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<unknown>(null)

  // Land on whichever tab this wallet can actually use — a passphrase-less
  // (recovery-only) wallet opens straight to Recovery secret.
  useEffect(() => {
    if (open) setTab(hasPassphrase ? "passphrase" : "recovery")
  }, [open, hasPassphrase])

  function clearSecrets() {
    setPassphrase("")
    setRecoverySecret("")
    setNewPassphrase("")
    setNewPassphraseConfirmation("")
  }

  // Every dismissal path — Escape, backdrop, the X button, or a manual close
  // — flows through here, so secrets never survive a close.
  function handleOpenChange(next: boolean) {
    if (!next) {
      clearSecrets()
      setUnlockError(null)
    }
    onOpenChange(next)
  }

  function handleUnlocked() {
    onUnlocked?.()
    handleOpenChange(false)
  }

  async function unlockWithPassphrase() {
    if (!packageValue || busy || !passphrase) return
    setBusy(true)
    setUnlockError(null)
    try {
      await security.unlockWithPassphrase(packageValue, passphrase)
      handleUnlocked()
    } catch (cause) {
      setUnlockError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function unlockWithRecovery() {
    if (!packageValue || busy || !recoverySecret) return
    setBusy(true)
    setUnlockError(null)
    try {
      await security.unlockWithRecoverySecret(packageValue, recoverySecret)
      handleUnlocked()
    } catch (cause) {
      setUnlockError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function configurePassphrase() {
    if (!packageValue || busy) return
    if (newPassphrase.length < 12) { setUnlockError(new Error("Use at least 12 characters for the wallet passphrase")); return }
    if (newPassphrase !== newPassphraseConfirmation) { setUnlockError(new Error("The wallet passphrases do not match")); return }
    setBusy(true)
    setUnlockError(null)
    try {
      await security.setPassphraseWithRecovery(packageValue, recoverySecret, newPassphrase)
      handleUnlocked()
    } catch (cause) {
      setUnlockError(cause)
    } finally {
      setBusy(false)
    }
  }

  const malformedPackage = unlockError instanceof WalletUnlockError && unlockError.reason === "malformed-package"
  const ready = Boolean(packageValue)

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Unlock your wallet</ResponsiveModalTitle>
          <ResponsiveModalDescription>Your keys are decrypted locally and stay on this device.</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <Segmented
          size="sm"
          grow
          options={UNLOCK_TABS}
          value={tab}
          onChange={(next) => { setTab(next); setUnlockError(null) }}
        />

        {!ready ? (
          <p className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground">Fetching your wallet&apos;s encrypted keys…</p>
        ) : tab === "passphrase" ? (
          hasPassphrase ? (
            <div className="space-y-3">
              <Input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void unlockWithPassphrase() }}
                autoComplete="current-password"
                placeholder="Wallet passphrase"
              />
              <button type="button" onClick={() => void unlockWithPassphrase()} disabled={busy || !passphrase} className={CTA_CLASS}>
                {!passphrase ? "Enter your passphrase" : busy ? "Unlocking…" : "Unlock"}
              </button>
            </div>
          ) : (
            <p className="rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] text-muted-foreground">This wallet doesn&apos;t have a passphrase yet. Switch to Recovery secret to unlock and set one.</p>
          )
        ) : (
          <div className="space-y-3">
            <Input
              type="password"
              value={recoverySecret}
              onChange={(event) => setRecoverySecret(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void unlockWithRecovery() }}
              autoComplete="off"
              placeholder="Recovery secret"
            />
            <button type="button" onClick={() => void unlockWithRecovery()} disabled={busy || !recoverySecret} className={CTA_CLASS}>
              {!recoverySecret ? "Enter your recovery secret" : busy ? "Unlocking…" : "Unlock"}
            </button>

            {!hasPassphrase ? (
              <div className="space-y-3 rounded-xl bg-surface-sunken/70 p-3">
                <p className="text-[12px] leading-relaxed text-muted-foreground">This older wallet has no passphrase envelope. Unlock with the recovery secret above, or set a passphrase here so you don&apos;t need the recovery secret for normal unlocks.</p>
                <Input type="password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} placeholder="New wallet passphrase" autoComplete="new-password" />
                <Input type="password" value={newPassphraseConfirmation} onChange={(event) => setNewPassphraseConfirmation(event.target.value)} placeholder="Confirm new passphrase" autoComplete="new-password" />
                <button
                  type="button"
                  onClick={() => void configurePassphrase()}
                  disabled={busy || !recoverySecret || !newPassphrase || !newPassphraseConfirmation}
                  className={CTA_CLASS}
                >
                  {!recoverySecret || !newPassphrase || !newPassphraseConfirmation ? "Enter the recovery secret and a new passphrase" : busy ? "Unlocking…" : "Set passphrase"}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {unlockError ? (
          <div className="space-y-1.5">
            <SectionMessage error={unlockError} />
            {malformedPackage ? (
              <p className="text-[12px] leading-relaxed text-muted-foreground">Your local wallet data looks damaged — restore from an encrypted backup under Security.</p>
            ) : null}
          </div>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
