"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, RefreshIcon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { useWallet } from "@/components/wallet-provider"
import { useAuth } from "@/components/auth-provider"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { ReceiveModal, type ReceivableAsset } from "@/components/assets/receive-modal"
import { SendModal, type SendableAsset } from "@/components/assets/send-modal"
import { fetchLegacyPrivyBalances, type TokenBalance } from "@/lib/crypto-api"

const labels: Record<string, string> = { ethereum: "Ethereum", arbitrum: "Arbitrum", solana: "Solana", sui: "Sui", ton: "TON", tron: "Tron" }
const icons: Record<string, string> = { ethereum: "/ethereum.png", arbitrum: "/arb.jpg", solana: "/solana.png", sui: "/sui-ocean-square.png", ton: "/ton.png", tron: "/tron-logo.png" }

function formatAmount(value: number) {
  return value === 0 ? "0" : value.toLocaleString(undefined, { maximumFractionDigits: 8 })
}

export function LegacyPrivyWalletPage() {
  const { user } = useAuth()
  const { wallets, addresses, isLoading: walletsLoading, error: walletError, refreshWallets } = useWallet()
  const [balances, setBalances] = React.useState<TokenBalance[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [receive, setReceive] = React.useState<ReceivableAsset | undefined>()
  const [send, setSend] = React.useState<SendableAsset | undefined>()
  const [copied, setCopied] = React.useState(false)

  const loadBalances = React.useCallback(async () => {
    if (!user) return
    setLoading(true); setError(null)
    try { setBalances(await fetchLegacyPrivyBalances()) }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load legacy wallet balances") }
    finally { setLoading(false) }
  }, [user])

  React.useEffect(() => { void loadBalances() }, [loadBalances])

  const total = balances.reduce((sum, item) => sum + (Number.isFinite(item.balance) ? item.balance : 0), 0)
  async function copyAddress(address?: string) {
    if (!address) return
    await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.2em] text-primary">Compatibility wallet</p><h1 className="text-3xl font-semibold">Legacy Wallet</h1><p className="mt-1 text-sm text-muted-foreground">Your original Privy wallet and its on-chain balances.</p></div>
        <div className="flex gap-2">
          <button onClick={() => { void refreshWallets(); void loadBalances() }} className="inline-flex items-center gap-2 rounded-xl border border-border/50 px-4 py-2 text-sm"><HugeiconsIcon icon={RefreshIcon} size={16} /> Refresh</button>
          <button disabled className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground opacity-60" title="Migration handler is preserved and will be connected separately">Migrate to custom wallet</button>
        </div>
      </div>

      {walletError && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{walletError}</div>}
      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <section className="rounded-2xl border border-border/40 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">Tracked balance units</p><p className="mt-1 text-3xl font-semibold">{total.toLocaleString(undefined, { maximumFractionDigits: 8 })}</p></div><span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-500">Privy legacy</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(wallets ?? {}).map(([chain, wallet]) => wallet && <div key={chain} className="rounded-xl bg-accent/30 p-3"><div className="flex items-center gap-2"><CoinAvatar symbol={chain === "solana" ? "SOL" : chain === "tron" ? "TRX" : chain.toUpperCase()} src={icons[chain]} /><span className="font-medium">{labels[chain] ?? chain}</span></div><button onClick={() => void copyAddress(wallet.address)} className="mt-2 flex w-full items-center justify-between gap-2 text-left text-[11px] text-muted-foreground"><span className="truncate font-mono">{wallet.address}</span><HugeiconsIcon icon={Copy01Icon} size={14} /></button></div>)}
        </div>
        {copied && <p className="mt-3 text-xs text-emerald-500">Address copied.</p>}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/40 bg-card">
        <div className="flex items-center justify-between border-b border-border/30 px-5 py-4"><div><h2 className="font-semibold">Legacy balances</h2><p className="text-xs text-muted-foreground">Read directly from each chain RPC.</p></div><span className="text-xs text-muted-foreground">{balances.length} assets</span></div>
        {loading || walletsLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Syncing on-chain balances…</div> : balances.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No balances found.</div> : <div className="divide-y divide-border/20">{balances.map((item, index) => { const chain = item.chain.toLowerCase(); const address = addresses?.[chain as keyof typeof addresses]; const asset: SendableAsset = { symbol: item.symbol, name: item.name, balance: item.balance, chain: chain as SendableAsset["chain"], icon: icons[chain] ?? "", contractAddress: item.contractAddress }; return <div key={`${item.chain}-${item.symbol}-${item.contractAddress ?? index}`} className="flex flex-wrap items-center gap-3 px-5 py-4"><CoinAvatar symbol={item.symbol} src={icons[chain]} /><div className="min-w-0 flex-1"><p className="font-medium">{item.symbol}</p><p className="text-xs text-muted-foreground">{item.name} · {labels[chain] ?? item.chain}</p></div><div className="text-right"><p className="font-medium tabular-nums">{formatAmount(item.balance)}</p><p className="text-xs text-muted-foreground">{item.isNative ? "Native" : "Token"}</p></div><div className="flex gap-1"><button onClick={() => setReceive({ symbol: item.symbol, chain, icon: icons[chain] ?? "" })} className="rounded-lg p-2 hover:bg-accent" aria-label={`Receive ${item.symbol}`}><HugeiconsIcon icon={ArrowDown01Icon} size={16} /></button><button onClick={() => setSend(asset)} className="rounded-lg p-2 hover:bg-accent" aria-label={`Send ${item.symbol}`}><HugeiconsIcon icon={ArrowUp01Icon} size={16} /></button></div>{address && <span className="sr-only">{address}</span>}</div> })}</div>}
      </section>
      <ReceiveModal open={Boolean(receive)} onClose={() => setReceive(undefined)} asset={receive} />
      <SendModal open={Boolean(send)} onClose={() => { setSend(undefined); void loadBalances() }} asset={send} />
    </main>
  )
}
