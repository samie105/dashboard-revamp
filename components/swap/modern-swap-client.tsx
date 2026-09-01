"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { useCryptoWalletState } from "@/hooks/crypto/useCryptoWallet"
import { signEvmIntent } from "@/lib/crypto-wallet"
import { getUnlockedWalletState } from "@/lib/crypto-wallet/unlock-state"
import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"

type NetworkId = "ethereum-mainnet" | "arbitrum-one"
type Token = { symbol: string; address: string; decimals: number; icon?: string | null; networkId: NetworkId }

function ModernSwapClient({ compact = false }: { compact?: boolean }) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const wallet = useCryptoWalletState()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const packageQuery = useQuery({
    queryKey: cryptoQueryKeys.walletPackage(userId),
    queryFn: () => cryptoBackendClient.getWalletPackage(),
    enabled: isCryptoBackendEnabled && Boolean(wallet.data),
    staleTime: 3 * 60_000,
  })
  const marketsQuery = useQuery({
    queryKey: ["crypto", "modern-swap-markets"],
    queryFn: () => cryptoBackendClient.getModernSpotMarkets(),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 60_000,
  })
  const [networkId, setNetworkId] = React.useState<NetworkId>("ethereum-mainnet")
  const [from, setFrom] = React.useState<string>("")
  const [to, setTo] = React.useState<string>("")
  const [amount, setAmount] = React.useState("")
  const [slippage, setSlippage] = React.useState(0.5)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [intentId, setIntentId] = React.useState<string | null>(null)

  const tokens = React.useMemo(() => {
    const map = new Map<string, Token>()
    for (const market of marketsQuery.data?.markets ?? []) {
      if (market.networkId !== networkId || market.venue !== "0x") continue
      if (market.sellToken) map.set(market.sellToken.toLowerCase(), { symbol: market.quote, address: market.sellToken, decimals: market.quoteDecimals ?? 6, icon: null, networkId })
      if (market.buyToken) map.set(market.buyToken.toLowerCase(), { symbol: market.symbol, address: market.buyToken, decimals: market.baseDecimals ?? 18, icon: market.icon, networkId })
    }
    return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))
  }, [marketsQuery.data, networkId])

  React.useEffect(() => {
    if (!tokens.length) return
    if (!tokens.some((token) => token.address === from)) setFrom(tokens.find((token) => token.symbol === "USDC")?.address ?? tokens[0].address)
    if (!tokens.some((token) => token.address === to) || to === from) setTo(tokens.find((token) => token.symbol === "USDT" && token.address !== from)?.address ?? tokens.find((token) => token.address !== from)?.address ?? tokens[0].address)
  }, [tokens, from, to])

  const fromToken = tokens.find((token) => token.address === from)
  const toToken = tokens.find((token) => token.address === to)
  const intentQuery = useQuery({
    queryKey: cryptoQueryKeys.intent(userId, intentId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getIntent(intentId as string, signal),
    enabled: Boolean(intentId),
    refetchInterval: (query) => ["confirmed", "failed", "expired"].includes(String(query.state.data?.status)) ? false : 5_000,
  })

  async function submit() {
    setBusy(true); setMessage(null); setIntentId(null)
    try {
      if (!user?.userId || !wallet.data?.id || !packageQuery.data) throw new Error("Set up and unlock the modern wallet before swapping")
      const account = wallet.data.accounts.find((item) => item.chainFamily === "evm" && item.state === "active")
      if (!account?.id) throw new Error("Your modern wallet does not have an EVM account yet")
      if (!getUnlockedWalletState(user.userId, wallet.data.id)) throw new Error("Unlock the modern wallet locally before swapping")
      if (!fromToken || !toToken || fromToken.address.toLowerCase() === toToken.address.toLowerCase()) throw new Error("Choose two different tokens")
      const sellAmountBaseUnits = toBaseUnits(amount, fromToken.decimals)
      if (!sellAmountBaseUnits || sellAmountBaseUnits === "0") throw new Error(`Enter a valid ${fromToken.symbol} amount`)
      const intent = await cryptoBackendClient.createModernSpotIntent({ networkId, sellToken: fromToken.address, buyToken: toToken.address, sellAmountBaseUnits, slippagePercentage: slippage / 100 })
      const signed = await signEvmIntent(user.userId, wallet.data.id, packageQuery.data, intent, account.id)
      await cryptoBackendClient.submitIntent(intent.id, signed)
      setIntentId(intent.id)
      setAmount("")
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(user.userId) })
      setMessage("Swap submitted. It is complete only after on-chain confirmation.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Swap failed")
    } finally { setBusy(false) }
  }

  if (!isCryptoBackendEnabled) return <div className="rounded-2xl border border-warning/30 bg-warning-chip p-6 text-sm">Modern wallet swaps are not enabled in this deployment.</div>
  if (wallet.needsSetup) return <div className="rounded-2xl border border-border p-6 text-sm">Create your modern Worldstreet wallet before using swaps.</div>

  return <div className={`w-full rounded-2xl border border-border bg-card shadow-sm ${compact ? "p-4" : "mx-auto max-w-xl p-5"}`}>
    <div className="mb-5"><h1 className="text-xl font-semibold">Swap</h1><p className="text-sm text-muted-foreground">Modern wallet only · LI.FI on Ethereum and Arbitrum</p></div>
    <div className="mb-4 flex gap-2">{(["ethereum-mainnet", "arbitrum-one"] as const).map((id) => <button key={id} onClick={() => { setNetworkId(id); setFrom(""); setTo("") }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${networkId === id ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>{id === "ethereum-mainnet" ? "Ethereum" : "Arbitrum"}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">You pay<select value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg bg-accent p-3 text-sm text-foreground">{tokens.map((token) => <option key={token.address} value={token.address}>{token.symbol}</option>)}</select></label><label className="text-xs text-muted-foreground">You receive<select value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg bg-accent p-3 text-sm text-foreground">{tokens.filter((token) => token.address !== from).map((token) => <option key={token.address} value={token.address}>{token.symbol}</option>)}</select></label></div>
    <label className="mt-4 block text-xs text-muted-foreground">Amount<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-1 w-full rounded-lg bg-accent p-3 text-lg text-foreground outline-none" /></label>
    <label className="mt-4 block text-xs text-muted-foreground">Slippage: {slippage}%<input type="range" min="0.1" max="5" step="0.1" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))} className="mt-2 w-full" /></label>
    <button disabled={busy || !fromToken || !toToken || !amount} onClick={submit} className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Preparing and signing…" : "Review and swap"}</button>
    {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
    {intentId && <p className="mt-1 text-xs text-muted-foreground">Status: {intentQuery.data?.status ?? "submitted"}</p>}
    <p className="mt-5 text-xs text-muted-foreground">LI.FI quotes are prepared by the backend. Your modern wallet signs locally; the backend never receives your private key.</p>
  </div>
}

export { ModernSwapClient }
