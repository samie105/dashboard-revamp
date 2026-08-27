"use client"

import * as React from "react"
import { cryptoBackendClient } from "@/lib/crypto-backend"
import type { CryptoTransactionIntent, CryptoWalletAccount, CryptoWalletDetails, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { signEvmIntent, signHyperliquidIntent } from "@/lib/crypto-wallet"

type Props = { open: boolean; onOpenChange: (open: boolean) => void; userId: string; wallet: CryptoWalletDetails; packageValue: CryptoWalletPackageDocument }

export function ModernFundingPanel({ open, onOpenChange, userId, wallet, packageValue }: Props) {
  const evm = wallet.accounts.find((a: CryptoWalletAccount) => a.chainFamily === "evm" && a.state === "active")
  const [tab, setTab] = React.useState<"deposit" | "transfer" | "withdraw">("deposit")
  const [amount, setAmount] = React.useState("")
  const [toPerp, setToPerp] = React.useState(true)
  const [destination, setDestination] = React.useState(evm?.canonicalAddress ?? "")
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  if (!open) return null
  async function run() {
    setBusy(true); setMessage(null)
    try {
      const value = Number(amount)
      if (!(value > 0)) throw new Error("Enter a positive USDC amount")
      if (!evm?.canonicalAddress) throw new Error("Modern EVM wallet is not ready")
      if (tab === "deposit") {
        const result = await cryptoBackendClient.createHyperliquidDepositIntents({ amount: value, idempotencyKey: crypto.randomUUID() })
        for (const intent of result.intents) await cryptoBackendClient.submitIntent(intent.id, await signEvmIntent(userId, wallet.id, packageValue, intent, evm.id))
        setMessage("USDC deposit submitted. Wait for Arbitrum and Hyperliquid confirmation.")
      } else {
        const intent = await cryptoBackendClient.createHyperliquidIntent(tab === "transfer" ? { type: "usdClassTransfer", amount: value, toPerp, idempotencyKey: crypto.randomUUID() } : { type: "withdraw3", amount: value, destination, idempotencyKey: crypto.randomUUID() })
        const signatures = await signHyperliquidIntent(userId, wallet.id, packageValue, evm.id, intent.steps)
        await cryptoBackendClient.submitHyperliquidIntent(intent.id, signatures)
        setMessage(tab === "transfer" ? "Hyperliquid funding transfer submitted." : "Hyperliquid withdrawal submitted.")
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Funding action failed") } finally { setBusy(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Modern Hyperliquid funding</h2><button onClick={() => onOpenChange(false)} className="text-muted-foreground">✕</button></div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-surface-sunken p-1">{(["deposit", "transfer", "withdraw"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-lg px-2 py-2 text-xs font-semibold ${tab === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{item === "deposit" ? "Deposit" : item === "transfer" ? "Move funds" : "Withdraw"}</button>)}</div>
      <p className="mb-3 text-xs text-muted-foreground">{tab === "deposit" ? "Bridge USDC from your modern Arbitrum wallet into Hyperliquid." : tab === "transfer" ? "Move USDC between Hyperliquid Spot and Perps." : "Withdraw USDC from Hyperliquid to your modern wallet."}</p>
      <label className="mb-3 block text-sm">Amount (USDC)<input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-border bg-surface-sunken p-3" placeholder="0.00" /></label>
      {tab === "transfer" && <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={toPerp} onChange={e => setToPerp(e.target.checked)} /> Move Spot → Perps</label>}
      {tab === "withdraw" && <label className="mb-3 block text-sm">Destination<input value={destination} onChange={e => setDestination(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface-sunken p-3 text-xs" /></label>}
      {message && <p className="mb-3 rounded-lg bg-surface-sunken p-3 text-xs">{message}</p>}
      <button disabled={busy} onClick={run} className="w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy ? "Preparing and signing…" : tab === "deposit" ? "Bridge USDC" : tab === "transfer" ? "Move funds" : "Withdraw USDC"}</button>
    </div>
  </div>
}
