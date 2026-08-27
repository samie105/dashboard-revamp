"use client"

import { useState } from "react"

import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"

export function WalletUnlockDialog({ walletId, packageValue }: { walletId: string; packageValue: CryptoWalletPackageDocument }) {
  const security = useWalletSecurity(walletId)
  const hasPassphrase = packageValue.envelopes.some((envelope) => (envelope as { purpose?: string }).purpose === "passphrase")
  const [passphrase, setPassphrase] = useState("")
  const [recoverySecret, setRecoverySecret] = useState("")
  const [newPassphrase, setNewPassphrase] = useState("")
  const [newPassphraseConfirmation, setNewPassphraseConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function unlockWithPassphrase() {
    setBusy(true)
    setMessage(null)
    try {
      await security.unlockWithPassphrase(packageValue, passphrase)
      setMessage("Wallet unlocked locally")
      setPassphrase("")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Wallet unlock failed")
    } finally {
      setBusy(false)
    }
  }

  async function unlockWithRecovery() {
    setBusy(true)
    setMessage(null)
    try {
      await security.unlockWithRecoverySecret(packageValue, recoverySecret)
      setMessage("Wallet unlocked locally with recovery secret")
      if (hasPassphrase) setRecoverySecret("")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Recovery unlock failed")
    } finally {
      setBusy(false)
    }
  }

  async function configurePassphrase() {
    if (newPassphrase.length < 12) { setMessage("Use at least 12 characters for the wallet passphrase"); return }
    if (newPassphrase !== newPassphraseConfirmation) { setMessage("The wallet passphrases do not match"); return }
    setBusy(true)
    setMessage(null)
    try {
      await security.setPassphraseWithRecovery(packageValue, recoverySecret, newPassphrase)
      setMessage("Wallet passphrase configured. Use it for local unlock next time.")
      setRecoverySecret("")
      setNewPassphrase("")
      setNewPassphraseConfirmation("")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not configure the wallet passphrase")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Unlock wallet</h2>
        <p className="text-sm text-muted-foreground">Use your wallet passphrase to unlock the encrypted keys locally. Keep the recovery secret offline for emergency unlock and security changes.</p>
      </div>

      {hasPassphrase ? (
        <div className="space-y-2">
          <label htmlFor="wallet-passphrase-unlock" className="text-sm font-medium">Wallet passphrase</label>
          <input
            id="wallet-passphrase-unlock"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => void unlockWithPassphrase()} disabled={busy || !passphrase} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            {busy ? "Unlocking…" : "Unlock wallet"}
          </button>
        </div>
      ) : null}

      <div className="space-y-2 border-t pt-3">
        <label htmlFor="wallet-recovery-secret" className="text-sm font-medium">Recovery secret</label>
        <input
          id="wallet-recovery-secret"
          type="password"
          value={recoverySecret}
          onChange={(event) => setRecoverySecret(event.target.value)}
          autoComplete="off"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void unlockWithRecovery()} disabled={busy || !recoverySecret} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
          Unlock with recovery secret
        </button>
        {!hasPassphrase ? (
          <div className="space-y-2 rounded-md bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">This older wallet has no passphrase envelope. Unlock with the recovery secret once, then configure a passphrase for normal unlocks.</p>
            <input type="password" value={newPassphrase} onChange={(event) => setNewPassphrase(event.target.value)} placeholder="New wallet passphrase" autoComplete="new-password" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <input type="password" value={newPassphraseConfirmation} onChange={(event) => setNewPassphraseConfirmation(event.target.value)} placeholder="Confirm new passphrase" autoComplete="new-password" className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
            <button type="button" onClick={() => void configurePassphrase()} disabled={busy || !recoverySecret || !newPassphrase || !newPassphraseConfirmation} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
              Configure wallet passphrase
            </button>
          </div>
        ) : null}
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  )
}
