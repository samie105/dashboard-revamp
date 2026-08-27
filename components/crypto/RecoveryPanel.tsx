"use client"

import { useState } from "react"

import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"

export function RecoveryPanel({ walletId, packageValue }: { walletId: string; packageValue: CryptoWalletPackageDocument }) {
  const security = useWalletSecurity(walletId)
  const [recoverySecret, setRecoverySecret] = useState("")
  const [ceremony, setCeremony] = useState<{ recoveryId: string; challenge: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function beginRecovery() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await security.startRecovery()
      setCeremony({ recoveryId: result.recoveryId, challenge: result.challenge })
      setMessage("Recovery ceremony started. Enter the recovery secret to continue.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not start recovery")
    } finally {
      setBusy(false)
    }
  }

  async function completeRecovery() {
    if (!ceremony || !recoverySecret) return
    setBusy(true)
    setMessage(null)
    try {
      const nextPackage = await security.prepareRecoveryPackage(packageValue, recoverySecret)
      const proof = security.makeRecoveryProof(recoverySecret, ceremony.challenge)
      await security.completeRecovery({ ...proof, recoveryId: ceremony.recoveryId, package: nextPackage })
      setRecoverySecret("")
      setCeremony(null)
      setMessage("Wallet recovery completed. The recovery envelope was rotated.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not complete recovery")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Wallet recovery</h2>
        <p className="text-sm text-muted-foreground">The recovery secret is used locally to unwrap the DEK and sign the recovery challenge.</p>
      </div>
      <button type="button" onClick={beginRecovery} disabled={busy} className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">
        Start recovery
      </button>
      {ceremony ? (
        <div className="space-y-2">
          <input
            type="password"
            value={recoverySecret}
            onChange={(event) => setRecoverySecret(event.target.value)}
            autoComplete="off"
            placeholder="Recovery secret"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <button type="button" onClick={completeRecovery} disabled={busy || !recoverySecret} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
            Complete recovery
          </button>
        </div>
      ) : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  )
}
