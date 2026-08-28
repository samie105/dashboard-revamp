"use client"

/**
 * Security controls: wallet rotation and device revocation. Logic — the
 * `useWalletSecurity` calls, their arguments and sequencing — is unchanged
 * from the pre-restyle panel; what changed is presentation and the addition
 * of an `AlertDialog` confirm in front of each destructive action.
 */

import { useId, useRef, useState } from "react"

import type { CryptoWalletPackageDocument, Device } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"
import { useAuth } from "@/components/auth-provider"
import { restoreEncryptedWalletPackage, serializeEncryptedWalletPackage } from "@/lib/crypto-wallet/local-storage"
import { CardHeader, CardShell, ListRow, Skel } from "@/components/ui/system"
import { InlineNotice } from "@/components/ui/flow"
import { SectionMessage } from "@/components/crypto/primitives"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const FIELD =
  "w-full rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] outline-none ring-1 ring-border/25 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40"

const ROTATE_DESCRIPTION =
  "Every account key is re-encrypted with a fresh key. Your addresses don't change."

const RECOVERY_SECRET_NOTICE =
  "Only enter your recovery secret for security changes you started yourself."

function deviceMeta(device: Device) {
  const platform = device.platform ?? "Unknown platform"
  const stamp = device.lastSeenAt ?? device.createdAt
  if (!stamp) return platform
  const formatted = new Date(stamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return device.lastSeenAt ? `${platform} · Last seen ${formatted}` : `${platform} · Registered ${formatted}`
}

export function CryptoSecurityPanel({
  walletId,
  packageValue,
}: {
  walletId: string
  packageValue: CryptoWalletPackageDocument
}) {
  const security = useWalletSecurity(walletId)
  const { user } = useAuth()
  const [recoverySecret, setRecoverySecret] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState<unknown>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Device | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const recoverySecretId = useId()
  const passphraseId = useId()

  async function rotate() {
    if (busy || !recoverySecret) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await security.rotateWallet(recoverySecret, passphrase)
      setRecoverySecret("")
      setPassphrase("")
      setSuccess("Wallet security rotated. Your passphrase and recovery secret were rewrapped, and active sessions were cleared.")
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function revoke(deviceId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await security.revokeDevice(deviceId, recoverySecret)
      setSuccess("Device revoked and local wallet state cleared.")
    } catch (cause) {
      setError(cause)
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
    setError(null)
    setSuccess("Encrypted wallet backup downloaded. Keep it with the recovery secret.")
  }

  async function importBackup(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (!user?.userId) throw new Error("Sign in before restoring a wallet backup")
      await restoreEncryptedWalletPackage(user.userId, walletId, await file.text())
      setSuccess("Encrypted package restored to this browser. The server package remains authoritative until a recovery/commit flow completes.")
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <CardShell>
      <CardHeader
        title="Security"
        subtitle="Rotation and device revocation require your wallet passphrase and recovery secret"
        badge={
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            v{packageValue.securityVersion}
          </span>
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <InlineNotice tone="warning">{RECOVERY_SECRET_NOTICE}</InlineNotice>

        <div className="flex flex-col gap-2.5">
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
          <div className="flex flex-col gap-1.5">
            <label htmlFor={passphraseId} className="text-[12.5px] font-medium text-muted-foreground">
              Wallet passphrase
            </label>
            <input
              id={passphraseId}
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="current-password"
              className={FIELD}
            />
          </div>
          <button
            type="button"
            onClick={() => setConfirmRotate(true)}
            disabled={busy || !recoverySecret || !passphrase}
            className="self-start rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Rotating…" : "Rotate wallet security"}
          </button>
        </div>

        <div className="flex flex-col gap-1 text-[12.5px] text-muted-foreground">
          <span>Package version {packageValue.version}</span>
          <span>Registered devices {security.devices.length}</span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/20 pt-3.5">
          <button
            type="button"
            onClick={exportBackup}
            className="rounded-full bg-surface-sunken px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-accent"
          >
            Download encrypted backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void importBackup(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="rounded-full bg-surface-sunken px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            Restore encrypted backup
          </button>
        </div>

        {security.devicesLoading && security.devices.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skel className="h-14 w-full rounded-xl" />
            <Skel className="h-14 w-full rounded-xl" />
          </div>
        ) : security.devices.length > 0 ? (
          <div className="flex flex-col divide-y divide-border/20 rounded-xl bg-surface-sunken/70 ring-1 ring-border/25">
            {security.devices.map((device) => (
              <ListRow
                key={device.id}
                title={device.label}
                subtitle={deviceMeta(device)}
                right={
                  device.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(device)}
                      disabled={busy || !recoverySecret}
                      className="shrink-0 text-[12.5px] font-semibold text-debit transition-opacity disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
        ) : null}

        <SectionMessage error={error} success={success} />
      </div>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate your wallet encryption?</AlertDialogTitle>
            <AlertDialogDescription>{ROTATE_DESCRIPTION}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void rotate()}>Rotate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revokeTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer be able to unlock this wallet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (revokeTarget) void revoke(revokeTarget.id)
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardShell>
  )
}
