"use client"

import { useRef, useState } from "react"

import type { CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"
import { useAuth } from "@/components/auth-provider"
import { restoreEncryptedWalletPackage, serializeEncryptedWalletPackage } from "@/lib/crypto-wallet/local-storage"

export function CryptoSecurityPanel({ walletId, packageValue }: { walletId: string; packageValue: CryptoWalletPackageDocument }) {
  const security = useWalletSecurity(walletId)
  const { user } = useAuth()
  const [recoverySecret, setRecoverySecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  async function rotate() {
    if (!recoverySecret) return
    setBusy(true)
    setMessage(null)
    try {
      await security.rotateWallet(recoverySecret, passphrase)
      setRecoverySecret("")
      setPassphrase("")
      setMessage("Wallet security rotated. Your passphrase and recovery secret were rewrapped, and active sessions were cleared.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Wallet rotation failed")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(deviceId: string) {
    setBusy(true)
    setMessage(null)
    try {
      await security.revokeDevice(deviceId, recoverySecret)
      setMessage("Device revoked and local wallet state cleared.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Device revocation failed")
    } finally {
      setBusy(false)
    }
  }

  function exportBackup() {
    const blob = new Blob([serializeEncryptedWalletPackage(packageValue)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `worldstreet-wallet-${walletId}-encrypted-backup.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage("Encrypted wallet backup downloaded. Keep it with the recovery secret.")
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      if (!user?.userId) throw new Error("Sign in before restoring a wallet backup")
      await restoreEncryptedWalletPackage(user.userId, walletId, await file.text())
      setMessage("Encrypted package restored to this browser. The server package remains authoritative until a recovery/commit flow completes.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Wallet backup restore failed")
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div><h2 className="font-semibold">Security controls</h2><p className="text-sm text-muted-foreground">Rotation and device revocation require your wallet passphrase and recovery secret. Both are used locally; the recovery secret authorizes the protected backend change without Clerk MFA.</p></div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input type="password" value={recoverySecret} onChange={(event) => setRecoverySecret(event.target.value)} placeholder="Recovery secret for rotation" autoComplete="off" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Wallet passphrase" autoComplete="current-password" className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2" />
        <button type="button" onClick={() => void rotate()} disabled={busy || !recoverySecret || !passphrase} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Rotating…" : "Rotate wallet security"}</button>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Package version: {packageValue.version}</p>
        <p>Security version: {packageValue.securityVersion}</p>
        <p>Registered devices: {security.devices.length}</p>
      </div>
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <button type="button" onClick={exportBackup} className="rounded-md border px-3 py-2 text-sm">Download encrypted backup</button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importBackup(event.target.files?.[0])} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">Restore encrypted backup</button>
      </div>
      {security.devices.length > 0 ? <div className="space-y-2">{security.devices.map((device) => <div key={device.id} className="flex items-center justify-between rounded border p-2 text-sm"><span>{device.label} · {device.status}</span>{device.status === "active" ? <button type="button" onClick={() => void revoke(device.id)} disabled={busy || !recoverySecret} className="text-destructive disabled:opacity-50">Revoke</button> : null}</div>)}</div> : null}
      {message ? <p className="text-sm">{message}</p> : null}
    </section>
  )
}
