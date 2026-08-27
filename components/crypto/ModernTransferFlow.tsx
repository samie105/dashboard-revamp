"use client"

import { useState } from "react"

import type { CryptoNetwork, CryptoWalletAccount, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { useTransactionIntent } from "@/hooks/crypto/useTransactionIntent"
import { TransactionReview } from "./TransactionReview"

export function ModernTransferFlow({ walletId, packageValue, accounts, networks }: {
  walletId: string
  packageValue: CryptoWalletPackageDocument
  accounts: CryptoWalletAccount[]
  networks: CryptoNetwork[]
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "")
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const transfer = useTransactionIntent(walletId, packageValue)
  const account = accounts.find((item) => item.id === accountId)
  const availableNetworks = networks.filter((network) => network.family === account?.chainFamily && network.capabilities.transfer !== false)

  async function createIntent(event: React.FormEvent) {
    event.preventDefault()
    setConfirmed(false)
    await transfer.createIntent({ accountId, networkId, asset: { kind: "native", identifier: availableNetworks.find((item) => item.id === networkId)?.nativeAsset ?? "native" }, to: to.trim(), amount: amount.trim() })
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div><h2 className="font-semibold">Modern transfer</h2><p className="text-sm text-muted-foreground">Testnet transfer intents only. Legacy Privy sends are still available in the existing wallet surfaces.</p></div>
      <form onSubmit={createIntent} className="grid gap-2">
        <select value={accountId} onChange={(event) => { setAccountId(event.target.value); setNetworkId("") }} className="rounded-md border bg-background px-3 py-2 text-sm">
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.chainFamily} · {item.canonicalAddress}</option>)}
        </select>
        <select value={networkId} onChange={(event) => setNetworkId(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">Select enabled network</option>
          {availableNetworks.map((network) => <option key={network.id} value={network.id}>{network.name} ({network.environment})</option>)}
        </select>
        <input required value={to} onChange={(event) => setTo(event.target.value)} placeholder="Recipient address" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={!accountId || !networkId || transfer.isLoading} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{transfer.isLoading ? "Preparing intent…" : "Prepare review"}</button>
      </form>
      {transfer.intent ? <TransactionReview intent={transfer.intent} onSimulate={() => void transfer.simulateIntent()} onSubmit={() => { setConfirmed(true); void transfer.submitIntent() }} simulating={transfer.isSimulating} submitting={transfer.isSubmitting} /> : null}
      {confirmed && !transfer.isSubmitting ? <p className="text-sm text-muted-foreground">Submission sent. The backend will reconcile the transaction status.</p> : null}
      {transfer.error ? <p className="text-sm text-destructive">{transfer.error instanceof Error ? transfer.error.message : "Transaction failed"}</p> : null}
    </section>
  )
}
