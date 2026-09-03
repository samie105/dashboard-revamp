"use client"

/**
 * Key export, hardened (spec §12). The per-chain decrypt/encode logic below
 * is unchanged from the original panel — what changed is everything around
 * it: nothing decrypts until an explicit `AlertDialog` confirmation, nothing
 * renders un-blurred (that's `KeyReveal`'s job, Task 7), and a revealed key
 * never outlives this panel or the wallet's unlock window.
 */

import { useEffect, useRef, useState } from "react"
import bs58 from "bs58"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"

import type {
  CryptoWalletAccount,
  CryptoWalletPackageDocument,
} from "@/lib/crypto-backend"
import { useAuth } from "@/components/auth-provider"
import { decryptLocalAccountKey } from "@/lib/crypto-wallet/account-secrets"
import { toBase64Url, wipeBytes } from "@/lib/crypto-wallet/encoding"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { CardHeader, CardShell, ListRow } from "@/components/ui/system"
import { InlineNotice } from "@/components/ui/flow"
import { KeyReveal, SectionMessage } from "@/components/crypto/primitives"
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
import { WalletUnlockDialog } from "@/components/crypto/WalletUnlockDialog"

const FAMILY_LABEL: Record<string, string> = {
  evm: "EVM",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

/** Copy Deck `export.warning`. */
const EXPORT_WARNING =
  "Anyone with this key controls the funds on this account. Never share it, never paste it into a website, and don't keep it in a screenshot."

function networkLabelFor(account: CryptoWalletAccount) {
  return FAMILY_LABEL[account.chainFamily] ?? account.chainFamily.toUpperCase()
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

/** Unchanged from the original panel — per-chain encoding of the decrypted secret. */
function exportedKey(account: CryptoWalletAccount, secret: Uint8Array) {
  if (account.chainFamily === "solana")
    return { label: "Solana base58 secret key", value: bs58.encode(secret) }
  if (account.chainFamily === "sui")
    return {
      label: "Sui bech32 private key",
      value: Ed25519Keypair.fromSecretKey(secret).getSecretKey(),
    }
  if (account.chainFamily === "evm")
    return { label: "EVM private key", value: `0x${bytesToHex(secret)}` }
  if (account.chainFamily === "tron")
    return { label: "TRON private key", value: bytesToHex(secret) }
  if (account.chainFamily === "ton")
    return { label: "TON Ed25519 seed", value: bytesToHex(secret) }
  return {
    label: `${account.chainFamily} private key`,
    value: toBase64Url(secret),
  }
}

type RevealedKey = {
  account: CryptoWalletAccount
  label: string
  value: string
}

export function WalletKeyExportPanel({
  walletId,
  accounts,
  packageValue,
}: {
  walletId: string
  accounts: CryptoWalletAccount[]
  packageValue: CryptoWalletPackageDocument
}) {
  const { user } = useAuth()
  const userId = user?.userId

  // The account awaiting AlertDialog confirmation — nothing decrypts until
  // this is confirmed.
  const [confirmAccount, setConfirmAccount] =
    useState<CryptoWalletAccount | null>(null)
  // The one key currently held in memory, if any. This is the only place
  // decrypted key material lives in this component.
  const [revealed, setRevealed] = useState<RevealedKey | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [copied, setCopied] = useState(false)
  const [autoHidden, setAutoHidden] = useState(false)
  // Account id with a reveal flow in flight (confirmed, maybe waiting on an
  // unlock, then decrypting) — disables the row so a double-tap can't start
  // a second overlapping flow.
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null)

  const [unlockOpen, setUnlockOpen] = useState(false)
  const resumeAfterUnlock = useRef<(() => void) | null>(null)

  // Hygiene: wipe the decrypted key from state the instant this panel leaves
  // the tree — a revealed secret must never outlive the surface that showed it.
  useEffect(() => {
    return () => setRevealed(null)
  }, [])

  // Hygiene: the DEK's TTL (or an explicit lock elsewhere — rotation, device
  // revoke, a user switch) can lapse while a key is still on screen. Poll for
  // that and hide the secret the moment it does.
  useEffect(() => {
    if (!revealed || !userId) return
    const interval = setInterval(() => {
      if (!getUnlockedWalletState(userId, walletId)) {
        setRevealed(null)
        setAutoHidden(true)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [revealed, userId, walletId])

  async function performReveal(account: CryptoWalletAccount) {
    if (!userId) return
    setError(null)
    setAutoHidden(false)
    try {
      const secret = await decryptLocalAccountKey(
        userId,
        walletId,
        packageValue,
        account.id
      )
      try {
        setRevealed({ account, ...exportedKey(account, secret) })
      } finally {
        wipeBytes(secret)
      }
    } catch (cause) {
      setError(cause)
    } finally {
      setBusyAccountId(null)
    }
  }

  function requestReveal(account: CryptoWalletAccount) {
    if (!userId || busyAccountId) return
    setCopied(false)
    setBusyAccountId(account.id)
    // The DEK's TTL can lapse between opening this panel and confirming the
    // reveal — resume through the same unlock dialog every other flow uses.
    if (!getUnlockedWalletState(userId, walletId)) {
      resumeAfterUnlock.current = () => void performReveal(account)
      setUnlockOpen(true)
      return
    }
    void performReveal(account)
  }

  async function copyKey() {
    if (!revealed) return
    try {
      await navigator.clipboard?.writeText(revealed.value)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Clipboard access can be denied (permissions, insecure context). The
      // key is still visible via KeyReveal, so failing silently here is
      // correct — there's nothing actionable to tell the user.
    }
  }

  return (
    <CardShell>
      <CardHeader
        title="Export private keys"
        subtitle="For advanced users — keys are only ever revealed on this device, never sent anywhere"
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        <InlineNotice tone="warning">{EXPORT_WARNING}</InlineNotice>

        {accounts.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            No accounts to export yet — provision a chain first.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border/20 rounded-xl bg-surface-sunken/70 ring-1 ring-border/25">
            {accounts.map((account) => (
              <ListRow
                key={account.id}
                title={networkLabelFor(account)}
                subtitle={account.canonicalAddress ?? account.state}
                right={
                  <button
                    type="button"
                    onClick={() => setConfirmAccount(account)}
                    disabled={busyAccountId !== null}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-surface-sunken px-4 text-[12px] font-semibold transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    {busyAccountId === account.id ? "Revealing…" : "Reveal key"}
                  </button>
                }
              />
            ))}
          </div>
        )}

        <SectionMessage error={error} />

        {autoHidden && !revealed ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Your wallet locked while the key was on screen, so it was hidden.
            Reveal it again if you still need it.
          </p>
        ) : null}

        {revealed ? (
          <div className="flex flex-col gap-2">
            <KeyReveal
              label={revealed.label}
              value={revealed.value}
              network={networkLabelFor(revealed.account)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyKey()}
                className="rounded-full bg-surface-sunken px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-accent"
              >
                {copied
                  ? "Copied — clear your clipboard when you're done"
                  : "Copy key"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealed(null)
                  setCopied(false)
                }}
                className="rounded-full bg-surface-sunken px-3.5 py-1.5 text-[12px] font-semibold transition-colors hover:bg-accent"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <AlertDialog
        open={confirmAccount !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAccount(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reveal your{" "}
              {confirmAccount
                ? networkLabelFor(confirmAccount)
                : "this account's"}{" "}
              private key?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {EXPORT_WARNING} Worldstreet will never ask you for this key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmAccount) requestReveal(confirmAccount)
              }}
            >
              I understand — reveal it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WalletUnlockDialog
        action="wallet-export"
        open={unlockOpen}
        onOpenChange={(open) => {
          setUnlockOpen(open)
          if (!open && resumeAfterUnlock.current) {
            // Closed (Escape, backdrop, X) without unlocking — nothing to resume.
            resumeAfterUnlock.current = null
            setBusyAccountId(null)
          }
        }}
        onUnlocked={() => {
          const resume = resumeAfterUnlock.current
          resumeAfterUnlock.current = null
          resume?.()
        }}
      />
    </CardShell>
  )
}
