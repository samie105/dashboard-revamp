"use client"

import { useState } from "react"

import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"

export function PasskeyButton({ mode = "authenticate", walletId, onAction, disabled = false }: { mode?: "register" | "authenticate"; walletId?: string; onAction?: () => Promise<unknown>; disabled?: boolean }) {
  const security = useWalletSecurity(walletId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setBusy(true)
    setError(null)
    try {
      if (mode === "register") await (onAction ? onAction() : security.registerPasskey())
      else await security.authenticatePasskey()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Passkey ceremony failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Waiting for passkey…" : mode === "register" ? "Register passkey" : "Unlock with passkey"}
      </button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
