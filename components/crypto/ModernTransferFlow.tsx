"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { cryptoBackendClient } from "@/lib/crypto-backend"
import type { CryptoNetwork, CryptoWalletAccount, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { formatCryptoAmount, type CryptoBalanceResult } from "@/hooks/crypto/useCryptoBalances"
import { useTransactionIntent } from "@/hooks/crypto/useTransactionIntent"
import { TransactionReview } from "./TransactionReview"

export function ModernTransferFlow({ walletId, packageValue, accounts, networks, balances }: {
  walletId: string
  packageValue: CryptoWalletPackageDocument
  accounts: CryptoWalletAccount[]
  networks: CryptoNetwork[]
  balances: CryptoBalanceResult[]
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [networkId, setNetworkId] = useState(networks[0]?.id ?? "")
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [assetKey, setAssetKey] = useState("native")
  const [sponsorFees, setSponsorFees] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const transfer = useTransactionIntent(walletId, packageValue)
  const sponsorshipConfig = useQuery({
    queryKey: ["crypto", "sponsorship-config"],
    queryFn: ({ signal }) => cryptoBackendClient.getSponsorshipConfig(signal),
    staleTime: 30_000,
    retry: false,
  })
  const account = accounts.find((item) => item.id === accountId)
  const availableNetworks = networks.filter((network) => network.family === account?.chainFamily && network.capabilities.transfer !== false)
  const selectedNetwork = availableNetworks.find((item) => item.id === networkId)
  const selectedNetworkBalances = balances.filter((balance) => balance.accountId === accountId && balance.networkId === networkId)
  const tokenBalances = selectedNetwork?.family === "solana"
    ? selectedNetworkBalances.filter((balance) => balance.asset.kind === "token")
    : []
  const selectedAsset = assetKey === "native"
    ? { kind: "native" as const, identifier: selectedNetwork?.nativeAsset ?? "native" }
    : tokenBalances.find((balance) => balance.asset.identifier === assetKey)?.asset ?? {
      kind: "native" as const,
      identifier: selectedNetwork?.nativeAsset ?? "native",
    }
  const sponsorshipOperation = account?.chainFamily === "solana" || account?.chainFamily === "evm"
    ? selectedAsset.kind === "token" ? "token-transfer" : "native-transfer"
    : ""
  const sponsorshipAvailable = Boolean(
    sponsorshipConfig.data?.enabled &&
    sponsorshipConfig.data.allowedNetworks.includes(networkId) &&
    sponsorshipConfig.data.allowedOperations.includes(sponsorshipOperation),
  )

  async function createIntent(event: React.FormEvent) {
    event.preventDefault()
    setConfirmed(false)
    await transfer.createIntent({ accountId, networkId, asset: selectedAsset, to: to.trim(), amount: amount.trim(), sponsorFees })
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div><h2 className="font-semibold">Modern transfer</h2><p className="text-sm text-muted-foreground">Transfer intents use the modern wallet. Legacy Privy sends remain available in the existing wallet surfaces.</p></div>
      <form onSubmit={createIntent} className="grid gap-2">
        <select value={accountId} onChange={(event) => { setAccountId(event.target.value); setNetworkId("") }} className="rounded-md border bg-background px-3 py-2 text-sm">
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.chainFamily} · {item.canonicalAddress}</option>)}
        </select>
        <select value={networkId} onChange={(event) => { setNetworkId(event.target.value); setAssetKey("native") }} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">Select enabled network</option>
          {availableNetworks.map((network) => <option key={network.id} value={network.id}>{network.name} ({network.environment})</option>)}
        </select>
        <select value={assetKey} onChange={(event) => setAssetKey(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="native">{selectedNetwork?.nativeAsset ?? "Native asset"}</option>
          {tokenBalances.map((balance) => <option key={balance.asset.identifier} value={balance.asset.identifier}>
            {balance.symbol} · {formatCryptoAmount(balance.amountBaseUnits, balance.decimals)}
          </option>)}
        </select>
        {selectedNetwork?.family === "solana" && tokenBalances.length === 0 ? <p className="text-xs text-muted-foreground">No non-zero Solana tokens were returned for this wallet. Refresh balances after receiving a token.</p> : null}
        <input required value={to} onChange={(event) => setTo(event.target.value)} placeholder="Recipient address" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" className="rounded-md border bg-background px-3 py-2 text-sm" />
        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <input type="checkbox" checked={sponsorFees} onChange={(event) => setSponsorFees(event.target.checked)} disabled={!sponsorshipAvailable || transfer.isLoading} />
          <span>
            <span className="block">Sponsor network fee</span>
            <span className="block text-xs text-muted-foreground">{sponsorshipAvailable ? "Worldstreet pays the network fee after you approve." : "Available when sponsorship is configured for this network."}</span>
          </span>
        </label>
        <button type="submit" disabled={!accountId || !networkId || transfer.isLoading} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{transfer.isLoading ? "Preparing intent…" : "Prepare review"}</button>
      </form>
      {transfer.intent ? <TransactionReview intent={transfer.intent} sponsorship={transfer.sponsorship} onSimulate={() => void transfer.simulateIntent()} onSubmit={() => { setConfirmed(true); void transfer.submitIntent() }} simulating={transfer.isSimulating} submitting={transfer.isSubmitting} /> : null}
      {confirmed && !transfer.isSubmitting ? <p className="text-sm text-muted-foreground">Submission sent. The backend will reconcile the transaction status.</p> : null}
      {transfer.error ? <p className="text-sm text-destructive">{transfer.error instanceof Error ? transfer.error.message : "Transaction failed"}</p> : null}
    </section>
  )
}
