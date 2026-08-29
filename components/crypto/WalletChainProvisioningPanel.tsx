"use client"

/**
 * Backfills chain accounts for wallets created before a chain rollout. The
 * `useWalletSecurity.addChains` call, its arguments and the missing-family
 * detection are unchanged — only presentation, plus gating the form behind
 * the announcement banner's action.
 */

import { useId, useMemo, useState } from "react"

import type { CryptoWalletAccount, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"
import { CardHeader, CardShell } from "@/components/ui/system"
import { AnnouncementBanner } from "@/components/ui/flow"
import { SectionMessage } from "@/components/crypto/primitives"

const REQUESTED_FAMILIES = ["evm", "solana", "sui", "ton", "tron"] as const
const FAMILY_LABELS: Record<string, string> = { evm: "Ethereum + Arbitrum", solana: "Solana", sui: "Sui", ton: "TON", tron: "TRON" }

const FIELD =
  "w-full rounded-xl bg-surface-sunken/70 px-3.5 py-2.5 text-[13px] outline-none ring-1 ring-border/25 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/40"

export function WalletChainProvisioningPanel({
  walletId,
  packageValue,
  accounts,
}: {
  walletId: string
  packageValue: CryptoWalletPackageDocument
  accounts: CryptoWalletAccount[]
}) {
  const security = useWalletSecurity(walletId)
  const [passphrase, setPassphrase] = useState("")
  const [recoverySecret, setRecoverySecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const passphraseId = useId()
  const recoverySecretId = useId()
  const existingFamilies = useMemo(() => new Set(accounts.map((account) => account.chainFamily)), [accounts])
  const missingFamilies = REQUESTED_FAMILIES.filter((family) => !existingFamilies.has(family))

  if (missingFamilies.length === 0) return null

  const missingLabel = missingFamilies.map((family) => FAMILY_LABELS[family] ?? family).join(", ")

  async function addChainsToWallet() {
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await security.addChains(packageValue, passphrase, recoverySecret)
      setPassphrase("")
      setRecoverySecret("")
      setSuccess("The new networks were added to your wallet.")
      setFormOpen(false)
    } catch (cause) {
      setError(cause)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CardShell>
      <CardHeader title="Add new networks" subtitle="Your wallet can now support more networks" />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <AnnouncementBanner
          tone="warning"
          title="New networks are available for your wallet"
          detail={`Add them to start using ${missingLabel}.`}
          action={{ label: "Add networks", onClick: () => setFormOpen(true) }}
        />

        {formOpen ? (
          <div className="flex flex-col gap-2.5">
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
              onClick={() => void addChainsToWallet()}
              disabled={busy || !passphrase || !recoverySecret}
              className="self-start rounded-full bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? "Adding chain accounts…" : "Add chain accounts"}
            </button>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              The passphrase decrypts the existing wallet locally. The recovery secret authorizes the encrypted package update; neither secret is uploaded.
            </p>
          </div>
        ) : null}

        <SectionMessage error={error} success={success} />
      </div>
    </CardShell>
  )
}
