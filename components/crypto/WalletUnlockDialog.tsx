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
import { HugeiconsIcon } from "@hugeicons/react"
import { SquareLock02Icon, ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

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
import { walletActionPolicy, type WalletAction } from "@/lib/crypto-wallet/action-policy"
import { describePasskeyError } from "@/lib/crypto-wallet/passkey"

type UnlockTab = "passphrase" | "pin" | "passkey" | "recovery"

const UNLOCK_TABS: readonly SegmentedOption<UnlockTab>[] = [
  { key: "passphrase", label: "Passphrase" },
  { key: "pin", label: "PIN" },
  { key: "passkey", label: "Passkey" },
  { key: "recovery", label: "Recovery secret" },
]

/** Full-width pill CTA. Deliberately plain — no gold breathing glow, that
 *  belongs to the one money-moving CTA (FlowCta); unlocking isn't a money
 *  action. */
const CTA_CLASS =
  "flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100"

/**
 * A secret field with a reveal toggle.
 *
 * Typing a long passphrase blind on a phone, with no way to check it, is how
 * people end up locked out of their own wallet by a typo they cannot see. The
 * toggle sits inside the field so it costs no vertical space, and the input
 * keeps its own padding clear of it.
 */
function SecretField({
  id,
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  onSubmit?: () => void
  placeholder: string
  autoComplete: string
}) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && onSubmit) onSubmit()
          }}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="h-12 pr-11 text-[15px]"
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <HugeiconsIcon icon={revealed ? ViewOffSlashIcon : ViewIcon} className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  )
}

export function WalletUnlockDialog({ open, onOpenChange, onUnlocked, action }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnlocked?: () => void
  action?: WalletAction
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
  const hasPin = packageValue ? packageValue.envelopes.some((envelope) => (envelope as { purpose?: string }).purpose === "pin") : false
  const hasPasskey = packageValue ? packageValue.envelopes.some((envelope) => (envelope as { purpose?: string }).purpose === "passkey") : false
  const policy = action ? walletActionPolicy(action) : undefined

  const [tab, setTab] = useState<UnlockTab>("passphrase")
  const [passphrase, setPassphrase] = useState("")
  const [recoverySecret, setRecoverySecret] = useState("")
  const [pin, setPin] = useState("")
  const [pinPassphrase, setPinPassphrase] = useState("")
  const [pinConfirmation, setPinConfirmation] = useState("")
  const [newPassphrase, setNewPassphrase] = useState("")
  const [newPassphraseConfirmation, setNewPassphraseConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [unlockError, setUnlockError] = useState<unknown>(null)
  const [needsPasskeyAdoption, setNeedsPasskeyAdoption] = useState(false)

  // Land on whichever tab this wallet can actually use — a passphrase-less
  // (recovery-only) wallet opens straight to Recovery secret.
  useEffect(() => {
    if (open) setTab(policy?.requiresFreshUserVerification && hasPasskey ? "passkey" : hasPasskey ? "passkey" : hasPin ? "pin" : hasPassphrase ? "passphrase" : "recovery")
  }, [open, hasPassphrase, hasPin, hasPasskey, policy?.requiresFreshUserVerification])

  function clearSecrets() {
    setPassphrase("")
    setRecoverySecret("")
    setPin("")
    setPinPassphrase("")
    setPinConfirmation("")
    setNewPassphrase("")
    setNewPassphraseConfirmation("")
  }

  // Every dismissal path — Escape, backdrop, the X button, or a manual close
  // — flows through here, so secrets never survive a close.
  function handleOpenChange(next: boolean) {
    if (!next) {
      clearSecrets()
      setUnlockError(null)
      setNeedsPasskeyAdoption(false)
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

  async function unlockWithPin() {
    if (!packageValue || busy || !pin) return
    setBusy(true)
    setUnlockError(null)
    try {
      await security.unlockWithPin(packageValue, pin)
      handleUnlocked()
    } catch (cause) { setUnlockError(cause) } finally { setBusy(false) }
  }

  async function unlockWithPasskey() {
    if (busy) return
    setBusy(true)
    setUnlockError(null)
    try {
      await security.authenticatePasskey()
      handleUnlocked()
    } catch (cause) {
      setNeedsPasskeyAdoption(cause instanceof Error && cause.message === "No passkey wallet envelope is configured")
      setUnlockError(describePasskeyError(cause))
    } finally { setBusy(false) }
  }

  async function adoptPasskey() {
    if (!packageValue || busy || !recoverySecret) return
    setBusy(true)
    setUnlockError(null)
    try {
      await security.adoptPasskeyWithRecovery(packageValue, recoverySecret)
      handleUnlocked()
    } catch (cause) { setUnlockError(cause) } finally { setBusy(false) }
  }

  async function configurePin() {
    if (!packageValue || busy) return
    if (!/^\d{6,12}$/.test(pin)) { setUnlockError(new Error("Use a 6 to 12 digit PIN")); return }
    if (pin !== pinConfirmation) { setUnlockError(new Error("The PINs do not match")); return }
    setBusy(true)
    setUnlockError(null)
    try {
      await security.setPin(packageValue, pinPassphrase, pin, recoverySecret)
      handleUnlocked()
    } catch (cause) { setUnlockError(cause) } finally { setBusy(false) }
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
      {/* Roomier than the stock content box: this is a form people type a long
          secret into, sometimes on a phone keyboard that eats half the screen.
          It scrolls internally rather than growing past the viewport. */}
      <ResponsiveModalContent className="gap-5 sm:max-w-md">
        <ResponsiveModalHeader className="items-center gap-2 pt-1 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/[0.12]">
            <HugeiconsIcon icon={SquareLock02Icon} className="h-6 w-6 text-primary" />
          </span>
          <ResponsiveModalTitle className="text-[18px] font-semibold">
            Unlock your wallet
          </ResponsiveModalTitle>
          {/* Short enough not to wrap into the close button on a narrow
              screen, which is how the old copy ended up sitting under it. */}
          <ResponsiveModalDescription className="text-[13px] leading-relaxed">
            {policy?.requiresFreshUserVerification ? "This sensitive action requires fresh device verification." : "Your passphrase never leaves this device."}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <Segmented
          size="sm"
          grow
          options={UNLOCK_TABS}
          value={tab}
          onChange={(next) => { setTab(next); setUnlockError(null) }}
        />

        <div className="slim-scroll -mx-1 flex max-h-[52dvh] flex-col gap-4 overflow-y-auto px-1 sm:max-h-none sm:overflow-visible">
          {!ready ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface-sunken/70 px-3.5 py-3">
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-[13px] text-muted-foreground">
                Fetching your wallet&apos;s encrypted keys…
              </p>
            </div>
          ) : tab === "passphrase" ? (
            hasPassphrase ? (
              <>
                <SecretField
                  id="wallet-unlock-passphrase"
                  label="Wallet passphrase"
                  value={passphrase}
                  onChange={setPassphrase}
                  onSubmit={() => void unlockWithPassphrase()}
                  placeholder="Enter your passphrase"
                  autoComplete="current-password"
                />
                {/* The button says what pressing it DOES. It used to read
                    "Enter your passphrase" — an instruction wearing a
                    button's clothes, so the one control on screen never
                    named its own action. */}
                <button
                  type="button"
                  onClick={() => void unlockWithPassphrase()}
                  disabled={busy || !passphrase}
                  className={CTA_CLASS}
                >
                  {busy ? "Unlocking…" : "Unlock wallet"}
                </button>
              </>
            ) : (
              <p className="rounded-xl bg-surface-sunken/70 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
                This wallet doesn&apos;t have a passphrase yet. Switch to{" "}
                <span className="font-semibold text-foreground">Recovery secret</span> to unlock and
                set one.
              </p>
            )
          ) : tab === "pin" ? (
            hasPin ? (
              <>
                <SecretField id="wallet-unlock-pin" label="Wallet PIN" value={pin} onChange={setPin} onSubmit={() => void unlockWithPin()} placeholder="6–12 digits" autoComplete="current-password" />
                <button type="button" onClick={() => void unlockWithPin()} disabled={busy || !pin} className={CTA_CLASS}>
                  {busy ? "Unlocking…" : "Unlock wallet"}
                </button>
                <p className="text-[12px] leading-relaxed text-muted-foreground">PIN unlock works on this device. Use your passphrase or recovery secret if you need to restore access on another device.</p>
              </>
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl bg-surface-sunken/70 p-3.5 ring-1 ring-border/40">
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">Set a device PIN for everyday unlocks. Your passphrase unlocks the wallet locally; your recovery secret authorizes this change to an existing wallet. Neither is stored.</p>
                <SecretField id="wallet-pin-passphrase" label="Current wallet passphrase" value={pinPassphrase} onChange={setPinPassphrase} placeholder="Enter your passphrase" autoComplete="current-password" />
                <SecretField id="wallet-pin-recovery-secret" label="Recovery secret" value={recoverySecret} onChange={setRecoverySecret} placeholder="Enter your recovery secret" autoComplete="off" />
                <SecretField id="wallet-new-pin" label="New wallet PIN" value={pin} onChange={setPin} placeholder="6–12 digits" autoComplete="new-password" />
                <SecretField id="wallet-new-pin-confirmation" label="Confirm new PIN" value={pinConfirmation} onChange={setPinConfirmation} placeholder="Type it again" autoComplete="new-password" />
                <button type="button" onClick={() => void configurePin()} disabled={busy || !pinPassphrase || !recoverySecret || !pin || pin !== pinConfirmation} className={cn(CTA_CLASS, "h-11 text-sm")}>
                  {busy ? "Setting…" : "Set device PIN"}
                </button>
              </div>
            )
          ) : tab === "passkey" ? (
            hasPasskey ? (
              <>
                <p className="rounded-xl bg-surface-sunken/70 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">Use your device passkey, Face ID, Touch ID, Windows Hello, or security key to unlock this existing wallet.</p>
                <button type="button" onClick={() => void unlockWithPasskey()} disabled={busy} className={CTA_CLASS}>
                  {busy ? "Waiting for passkey…" : "Unlock with passkey"}
                </button>
                {needsPasskeyAdoption ? (
                  <div className="flex flex-col gap-3 rounded-2xl bg-surface-sunken/70 p-3.5 ring-1 ring-border/40">
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">This passkey is registered but is not linked to this wallet on this device yet. Authenticate it once with Face ID, then enter your recovery secret to link it securely.</p>
                    <SecretField id="wallet-passkey-adoption-recovery" label="Recovery secret" value={recoverySecret} onChange={setRecoverySecret} placeholder="Enter your recovery secret" autoComplete="off" />
                    <button type="button" onClick={() => void adoptPasskey()} disabled={busy || !recoverySecret} className={CTA_CLASS}>
                      {busy ? "Linking passkey…" : "Link passkey to wallet"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded-xl bg-surface-sunken/70 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">No passkey is enrolled for this wallet on the server yet. Register one from Security, then return here.</p>
            )
          ) : (
            <>
              <SecretField
                id="wallet-unlock-recovery-secret"
                label="Recovery secret"
                value={recoverySecret}
                onChange={setRecoverySecret}
                onSubmit={() => void unlockWithRecovery()}
                placeholder="Enter your recovery secret"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void unlockWithRecovery()}
                disabled={busy || !recoverySecret}
                className={CTA_CLASS}
              >
                {busy ? "Unlocking…" : "Unlock wallet"}
              </button>

              {!hasPassphrase ? (
                <div className="flex flex-col gap-4 rounded-2xl bg-surface-sunken/70 p-3.5 ring-1 ring-border/40">
                  <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                    This older wallet has no passphrase. Set one here and you won&apos;t need the
                    recovery secret for everyday unlocks.
                  </p>
                  <SecretField
                    id="wallet-unlock-new-passphrase"
                    label="New wallet passphrase"
                    value={newPassphrase}
                    onChange={setNewPassphrase}
                    placeholder="Choose a passphrase"
                    autoComplete="new-password"
                  />
                  <SecretField
                    id="wallet-unlock-new-passphrase-confirmation"
                    label="Confirm new passphrase"
                    value={newPassphraseConfirmation}
                    onChange={setNewPassphraseConfirmation}
                    placeholder="Type it again"
                    autoComplete="new-password"
                  />
                  {/* Mismatches are said here, while both fields are on
                      screen, rather than after a round-trip. */}
                  {newPassphrase && newPassphraseConfirmation &&
                    newPassphrase !== newPassphraseConfirmation && (
                      <p className="text-[12px] font-medium text-debit">
                        These two don&apos;t match yet.
                      </p>
                    )}
                  <button
                    type="button"
                    onClick={() => void configurePassphrase()}
                    disabled={
                      busy ||
                      !recoverySecret ||
                      !newPassphrase ||
                      newPassphrase !== newPassphraseConfirmation
                    }
                    className={cn(CTA_CLASS, "h-11 text-sm")}
                  >
                    {busy ? "Setting…" : "Set passphrase"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        {unlockError ? (
          <div className="flex flex-col gap-1.5">
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
