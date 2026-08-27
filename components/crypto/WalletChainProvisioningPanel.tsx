"use client"

import { useMemo, useState } from "react"

import type { CryptoWalletAccount, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useWalletSecurity } from "@/hooks/crypto/useWalletSecurity"

const REQUESTED_FAMILIES = ["evm", "solana", "sui", "ton", "tron"] as const
const FAMILY_LABELS: Record<string, string> = { evm: "Ethereum + Arbitrum", solana: "Solana", sui: "Sui", ton: "TON", tron: "TRON" }

export function WalletChainProvisioningPanel({ walletId, packageValue, accounts }: { walletId: string; packageValue: CryptoWalletPackageDocument; accounts: CryptoWalletAccount[] }) {
  const security = useWalletSecurity(walletId)
  const [passphrase, setPassphrase] = useState("")
  const [recoverySecret, setRecoverySecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const existingFamilies = useMemo(() => new Set(accounts.map((account) => account.chainFamily)), [accounts])
  const missingFamilies = REQUESTED_FAMILIES.filter((family) => !existingFamilies.has(family))

  if (missingFamilies.length === 0) return null

  async function addChainsToWallet() {
    setBusy(true)
    setMessage(null)
    try {
      await security.addChains(packageValue, passphrase, recoverySecret)
      setPassphrase("")
      setRecoverySecret("")
      setMessage("The missing chain accounts were added to your encrypted wallet.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not add the chain accounts")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div><h2 className="font-semibold">Add newly supported chains</h2><p className="text-sm text-muted-foreground">This wallet was created before the latest chain rollout. Add these accounts without changing your existing addresses.</p></div>
      <p className="text-sm">{missingFamilies.map((family) => FAMILY_LABELS[family] ?? family).join(" · ")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="Wallet passphrase" autoComplete="current-password" className="rounded-xl border bg-background px-3 py-2 text-sm" />
        <input type="password" value={recoverySecret} onChange={(event) => setRecoverySecret(event.target.value)} placeholder="Recovery secret" autoComplete="off" className="rounded-xl border bg-background px-3 py-2 text-sm" />
      </div>
      <button type="button" onClick={() => void addChainsToWallet()} disabled={busy || !passphrase || !recoverySecret} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Adding chain accounts…" : "Add chain accounts"}</button>
      {message ? <p className="text-sm">{message}</p> : null}
      <p className="text-xs text-muted-foreground">The passphrase decrypts the existing wallet locally. The recovery secret authorizes the encrypted package update; neither secret is uploaded.</p>
    </section>
  )
}
