"use client"

/**
 * Wallet recovery ceremony. The `useWalletSecurity` calls — `startRecovery`,
 * `prepareRecoveryPackage`, `makeRecoveryProof`, `completeRecovery` — and
 * their arguments/sequencing are unchanged; the ceremony now renders as a
 * `StageList` instead of a flat button + text message.
 */

import { useId, useState } from "react"

import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"
import { CardHeader, CardShell } from "@/components/ui/system"
import { StageList, type Stage } from "@/components/ui/flow"
import { SectionMessage } from "@/components/crypto/primitives"

const FIELD =
  "w-full rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] outline-none ring-1 ring-border/25 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40"

const RECOVERY_STAGES: Stage[] = [
  { key: "verify", label: "Checking your recovery secret" },
  { key: "rewrap", label: "Re-locking your wallet" },
  { key: "confirm", label: "Confirming the change" },
]

export function RecoveryPanel({
  walletId,
  packageValue,
}: {
  walletId: string
  packageValue: CryptoWalletPackageDocument
}) {
  const security = useWalletSecurity(walletId)
  const [recoverySecret, setRecoverySecret] = useState("")
  const [ceremony, setCeremony] = useState<{ recoveryId: string; challenge: string } | null>(null)
  const [stageIndex, setStageIndex] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const recoverySecretId = useId()

  async function beginRecovery() {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await security.startRecovery()
      setCeremony({ recoveryId: result.recoveryId, challenge: result.challenge })
      setStageIndex(0)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function completeRecovery() {
    if (!ceremony || !recoverySecret) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    setStageIndex(0)
    try {
      const nextPackage = await security.prepareRecoveryPackage(packageValue, recoverySecret)
      // Unwrapping the recovery envelope above is also where a wrong secret
      // fails — so it verifies the secret and re-wraps the key in one pass.
      setStageIndex(2)
      const proof = security.makeRecoveryProof(recoverySecret, ceremony.challenge)
      await security.completeRecovery({ ...proof, recoveryId: ceremony.recoveryId, package: nextPackage })
      setStageIndex(3)
      setRecoverySecret("")
      setCeremony(null)
      setSuccess("Recovery complete — your wallet is back and freshly secured.")
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CardShell>
      <CardHeader
        title="Wallet recovery"
        subtitle="Your recovery secret proves it's you — it never leaves this device"
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        {!ceremony ? (
          <button
            type="button"
            onClick={() => void beginRecovery()}
            disabled={busy}
            className="self-start rounded-full bg-surface-sunken px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start recovery"}
          </button>
        ) : (
          <>
            <StageList stages={RECOVERY_STAGES} activeIndex={stageIndex} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={recoverySecretId} className="text-[12.5px] font-medium text-muted-foreground">
                Recovery secret
              </label>
              <input
                id={recoverySecretId}
                type="password"
                value={recoverySecret}
                onChange={(event) => setRecoverySecret(event.target.value)}
                autoComplete="off"
                className={FIELD}
              />
            </div>
            <button
              type="button"
              onClick={() => void completeRecovery()}
              disabled={busy || !recoverySecret}
              className="self-start rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Completing…" : "Complete recovery"}
            </button>
          </>
        )}

        <SectionMessage error={error} success={success} />
      </div>
    </CardShell>
  )
}
