"use client"

/**
 * Security controls: wallet rotation and device revocation. Logic — the
 * `useWalletSecurity` calls, their arguments and sequencing — is unchanged
 * from the pre-restyle panel; what changed is presentation and the addition
 * of an `AlertDialog` confirm in front of each destructive action.
 */

import { useEffect, useId, useRef, useState } from "react"

import { cryptoBackendClient, type CryptoWalletPackage, type CryptoWalletPackageDocument, type Device, type HyperliquidTradingAgent } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"
import { useAuth } from "@/components/auth-provider"
import {
  commitWalletBackupRestore,
  previewWalletBackupRestore,
  serializeEncryptedWalletPackage,
} from "@/lib/crypto-wallet/local-storage"
import { CardHeader, CardShell, ListRow, Skel } from "@/components/ui/system"
import { InlineNotice } from "@/components/ui/flow"
import { SectionMessage } from "@/components/crypto/primitives"
import { PasskeyButton } from "@/components/crypto/PasskeyButton"
import { prepareHyperliquidAgent, approvePreparedHyperliquidAgent } from "@/lib/crypto-wallet/hyperliquid-agent"
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
  "Your wallet gets a fresh set of locks. Your addresses and money don't change."

const RESTORE_CONFIRM_DESCRIPTION =
  "This replaces the wallet data saved in this browser. Your funds and addresses are unaffected."

const RECOVERY_SECRET_NOTICE =
  "Only enter your recovery secret for security changes you started yourself."

function deviceMeta(device: Device) {
  const platform = device.platform ?? "Unknown platform"
  const stamp = device.lastSeenAt ?? device.createdAt
  if (!stamp) return platform
  const formatted = new Date(stamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return device.lastSeenAt ? `${platform} · Last seen ${formatted}` : `${platform} · Added ${formatted}`
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
  const [tradingAgents, setTradingAgents] = useState<HyperliquidTradingAgent[]>([])
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Device | null>(null)
  const [pendingRestore, setPendingRestore] = useState<{ packageValue: CryptoWalletPackage; warnings: string[] } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const recoverySecretId = useId()
  const passphraseId = useId()

  useEffect(() => {
    let cancelled = false
    void cryptoBackendClient.listHyperliquidAgents().then((agents) => { if (!cancelled) setTradingAgents(agents) }).catch(() => { /* no agent is a valid initial state */ })
    return () => { cancelled = true }
  }, [])

  async function rotate() {
    if (busy || !recoverySecret) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await security.rotateWallet(recoverySecret, passphrase)
      setRecoverySecret("")
      setPassphrase("")
      setSuccess("Done — your wallet has fresh locks, and anywhere it was open has been signed out.")
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function setupTradingAgent() {
    if (busy || !user?.userId || !recoverySecret) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const evmAccount = (packageValue.accounts as Array<{ accountId?: string; family?: string }>).find((account) => account.family === "evm")
      if (!evmAccount?.accountId) throw new Error("Your wallet does not have an EVM account ready")
      await security.unlockWithRecoverySecret(packageValue, recoverySecret)
      const authorization = await security.authorizeWithRecovery(recoverySecret)
      const prepared = await prepareHyperliquidAgent(user.userId, walletId, packageValue, authorization.walletAuthorizationToken)
      await approvePreparedHyperliquidAgent(user.userId, walletId, packageValue, evmAccount.accountId, prepared.approval)
      setSuccess(`Trading agent ${prepared.agent.agentAddress.slice(0, 6)}…${prepared.agent.agentAddress.slice(-4)} is approved for Hyperliquid mainnet trading.`)
      setTradingAgents((current) => [...current.filter((agent) => agent.agentAddress !== prepared.agent.agentAddress), { ...prepared.agent, status: "active" }])
      setRecoverySecret("")
    } catch (cause) { setError(cause) } finally { setBusy(false) }
  }

  async function revokeTradingAgent(agent: HyperliquidTradingAgent) {
    if (busy || !recoverySecret) return
    setBusy(true); setError(null); setSuccess(null)
    try {
      const authorization = await security.authorizeWithRecovery(recoverySecret)
      const revoked = await cryptoBackendClient.revokeHyperliquidAgent(agent.agentAddress, authorization.walletAuthorizationToken)
      setTradingAgents((current) => current.map((item) => item.agentAddress === agent.agentAddress ? revoked : item))
      setSuccess("Delegated Hyperliquid trading was revoked immediately.")
      setRecoverySecret("")
    } catch (cause) { setError(cause) } finally { setBusy(false) }
  }

  async function revoke(deviceId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await security.revokeDevice(deviceId, recoverySecret)
      setSuccess("That device has been signed out, and its copy of your wallet was cleared.")
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  async function exportBackup() {
    if (busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (!user?.userId) throw new Error("Sign in before saving a backup file")
      const serialized = await serializeEncryptedWalletPackage(user.userId, packageValue)
      const blob = new Blob([serialized], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `worldstreet-wallet-${walletId}-encrypted-backup.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setSuccess("Backup file saved. Keep it somewhere safe, along with your recovery secret.")
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  // Step 1: parse + validate only — nothing is written yet. A problem (wrong
  // wallet, wrong user, tampered checksum, unrecognized format…) surfaces
  // through SectionMessage and the flow stops here. A clean file queues the
  // confirmation dialog instead of writing immediately.
  async function prepareRestore(file: File | undefined) {
    if (busy || !file) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      if (!user?.userId) throw new Error("Sign in before restoring a backup file")
      const preview = await previewWalletBackupRestore(user.userId, walletId, await file.text())
      setPendingRestore(preview)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  // Step 2: the write, run only after the AlertDialog confirms. The DEK is
  // locked first — a stale in-memory key from the package being replaced
  // must never be used to sign against the restored package's ciphertext —
  // so the success state always ends with the wallet needing to be unlocked
  // again.
  async function confirmRestore() {
    if (busy || !pendingRestore) return
    setBusy(true)
    setError(null)
    try {
      if (!user?.userId) throw new Error("Sign in before restoring a backup file")
      security.clear()
      await commitWalletBackupRestore(user.userId, walletId, pendingRestore.packageValue)
      const warningPrefix = pendingRestore.warnings.length > 0 ? `${pendingRestore.warnings.join(" ")} ` : ""
      // The local copy is back, but the server still holds the previous one
      // until a recovery run commits — saying only "restored" would let
      // someone believe they were finished when they aren't.
      setSuccess(`${warningPrefix}Your backup is back on this browser. Worldstreet still holds your previous copy until you finish "Get back in". Open your wallet to continue.`)
      setPendingRestore(null)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CardShell>
      <CardHeader
        title="Security"
        subtitle="These actions need your passphrase and recovery secret"
        badge={
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            v{packageValue.securityVersion}
          </span>
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <InlineNotice tone="warning">{RECOVERY_SECRET_NOTICE}</InlineNotice>

        <div className="flex flex-col gap-2 border-b border-border/20 pb-3.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Passkey and biometric unlock</span>
          <p className="text-[12px] leading-relaxed text-muted-foreground">Add a device passkey to unlock this same wallet with Face ID, Touch ID, Windows Hello, or a security key. Your recovery path remains available.</p>
          <PasskeyButton
            mode="register"
            walletId={walletId}
            disabled={!recoverySecret}
            onAction={() => security.replacePasskey(packageValue, recoverySecret)}
          />
          <button type="button" onClick={() => void setupTradingAgent()} disabled={busy || !recoverySecret} className="inline-flex min-h-11 items-center self-start rounded-full bg-surface-sunken px-4 text-[12px] font-semibold transition-colors hover:bg-accent disabled:opacity-50">
            {busy ? "Approving agent…" : "Enable delegated trading"}
          </button>
          {tradingAgents.filter((agent) => agent.status !== "revoked").map((agent) => (
            <div key={agent.agentAddress} className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken/60 px-3 py-2 text-[12px]">
              <span>{agent.agentName ?? "Hyperliquid trading agent"} · {agent.status}</span>
              <button type="button" onClick={() => void revokeTradingAgent(agent)} disabled={busy || !recoverySecret} className="font-semibold text-destructive disabled:opacity-50">Revoke</button>
            </div>
          ))}
        </div>

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
            className="inline-flex min-h-11 items-center self-start rounded-full bg-primary px-5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Changing locks…" : "Give my wallet new locks"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/20 pt-3.5">
          <button
            type="button"
            onClick={() => void exportBackup()}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-full bg-surface-sunken px-4 text-[12px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            Download a backup file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            disabled={busy}
            onChange={(event) => void prepareRestore(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-full bg-surface-sunken px-4 text-[12px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
          >
            Restore from a backup file
          </button>
        </div>

        {security.devicesLoading && security.devices.length === 0 ? (
          <div className="flex flex-col gap-2">
            <Skel className="h-14 w-full rounded-xl" />
            <Skel className="h-14 w-full rounded-xl" />
          </div>
        ) : security.devices.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted-foreground">
              Devices that can open this wallet
            </span>
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
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-[12.5px] font-semibold text-debit transition-opacity disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  ) : null
                }
              />
              ))}
            </div>
          </div>
        ) : null}

        <SectionMessage error={error} success={success} />
      </div>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Give your wallet new locks?</AlertDialogTitle>
            <AlertDialogDescription>{ROTATE_DESCRIPTION}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void rotate()}>Change locks</AlertDialogAction>
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

      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the wallet saved in this browser?</AlertDialogTitle>
            <AlertDialogDescription>{RESTORE_CONFIRM_DESCRIPTION}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingRestore && pendingRestore.warnings.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {pendingRestore.warnings.map((warning) => (
                <InlineNotice key={warning} tone="warning">{warning}</InlineNotice>
              ))}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmRestore()}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardShell>
  )
}
