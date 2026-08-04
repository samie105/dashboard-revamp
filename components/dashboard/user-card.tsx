"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Exchange01Icon,
  CreditCardIcon,
  CoinsSwapIcon,
  Clock01Icon,
  EyeIcon,
  Wallet01Icon,
  Chart01Icon,
  ChartLineData01Icon,
  Coins01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ActionPill, Balance, DeltaChip, Eyebrow, Segmented } from "@/components/ui/system"
import { SilkBackdrop } from "@/components/ui/silk-backdrop"
import { NETWORKS, NETWORK_ICON } from "@/lib/networks"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { ErrorState } from "@/components/error-state"
import type { CoinData } from "@/lib/actions"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"
import { getSpotBalances, getSpotPositions, getTokenPrices } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"
import { fetchPrices } from "@/lib/crypto-api"

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`
}

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function getPrice(prices: Record<string, number>, symbol: string): number {
  return prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
}

function calculateDailyPnL(
  holdings: Record<string, number>,
  prices: Record<string, number>,
  coins: CoinData[],
): number {
  let pnl = 0
  for (const [symbol, amount] of Object.entries(holdings)) {
    const price = getPrice(prices, symbol)
    const coin = coins.find((c) => c.symbol === symbol)
    const change = coin?.change24h ?? 0
    if (price && amount) {
      const currentValue = amount * price
      const previousValue = currentValue / (1 + change / 100)
      pnl += currentValue - previousValue
    }
  }
  return pnl
}

interface WalletCardProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
}

const WALLET_VIEWS = [
  { key: "total",   label: "Total",   icon: Coins01Icon,         sub: "All accounts" },
  { key: "main",    label: "Main",    icon: Wallet01Icon,        sub: "On-chain balance" },
  { key: "spot",    label: "Spot",    icon: Chart01Icon,         sub: "Spot trading" },
  { key: "futures", label: "Futures", icon: ChartLineData01Icon, sub: "Futures wallet" },
] as const

type WalletView = (typeof WALLET_VIEWS)[number]["key"]

export function WalletCard({ coins, prices, error }: WalletCardProps) {
  const { user, isLoaded } = useAuth()
  const { addresses, walletsGenerated } = useWallet()
  const { balances: onChainBalances } = useWalletBalances()
  const { usdcBalance, accountValue, balances: hlBalances } = useHyperliquidBalance(user?.userId, !!user)
  const [isCopied, setIsCopied] = React.useState<string | null>(null)
  const [activeView, setActiveView] = React.useState<WalletView>("total")
  const [selectedWallet, setSelectedWallet] = React.useState<string>("ethereum")
  // Balance privacy — masks render as fixed-width dots, never a layout jump.
  const [hidden, setHidden] = React.useState(false)

  // Live prices from the crypto service feed — the same source the hub, the
  // assets page and mobile value holdings at. The server-rendered `prices`
  // snapshot seeds first paint; this keeps valuations fresh alongside the 30s
  // balance polls instead of freezing them at render time.
  const [livePrices, setLivePrices] = React.useState<Record<string, number>>(prices)
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchPrices()
        if (cancelled) return
        const merged: Record<string, number> = { ...res.prices }
        for (const c of res.coins) {
          const key = c.symbol.toUpperCase()
          if (merged[key] === undefined && c.price > 0) merged[key] = c.price
        }
        setLivePrices(merged)
      } catch {
        /* keep last good prices */
      }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // SpotV2 ledger data (same source as assets page)
  const [spotLedger, setSpotLedger] = React.useState<LedgerBalance[]>([])
  const [spotV2Positions, setSpotV2Positions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])

  React.useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      try {
        const [balances, positions] = await Promise.all([
          getSpotBalances(),
          getSpotPositions(),
        ])
        const tokens = positions.map((p) => p.token)
        const priceMap = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()
        if (cancelled) return
        setSpotLedger(balances)
        setSpotV2Positions(positions.map((p) => ({ ...p, currentPrice: priceMap.get(p.token) ?? 0 })))
      } catch { /* empty state */ }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  // On-chain balance: sum of all on-chain tokens valued in USD
  const onChainTotal = React.useMemo(() => {
    if (!walletsGenerated) return 0
    let total = 0
    for (const b of onChainBalances) {
      const p = getPrice(livePrices, b.symbol)
      total += b.balance * (p > 0 ? p : b.symbol === "USDT" || b.symbol === "USDC" ? 1 : 0)
    }
    return total
  }, [onChainBalances, livePrices, walletsGenerated])

  // What each chain is worth — the network strip's figures (mobile grammar:
  // the strip carries value, chains are never hidden behind a dropdown).
  const chainTotals = React.useMemo(() => {
    const m: Record<string, number> = Object.fromEntries(NETWORKS.map((n) => [n.key, 0]))
    for (const b of onChainBalances) {
      const p = getPrice(livePrices, b.symbol)
      const v = b.balance * (p > 0 ? p : b.symbol === "USDT" || b.symbol === "USDC" ? 1 : 0)
      // The feed keys by network (arbitrum is its own key even though it shares
      // the ethereum address), so this maps 1:1 onto the strip.
      if (m[b.chain] !== undefined) m[b.chain] += v
    }
    return m
  }, [onChainBalances, livePrices])

  // Spot balance = SpotV2 ledger (available + locked) + positions value (matches assets page)
  const spotBalance = React.useMemo(() => {
    const usdcTotal = spotLedger.reduce((sum, b) => sum + b.available + b.locked, 0)
    const posTotal = spotV2Positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0)
    return usdcTotal + posTotal
  }, [spotLedger, spotV2Positions])

  // Futures balance (Hyperliquid perps account value)
  const futuresBalance = accountValue

  // Holdings map for P&L calculation
  const holdings = React.useMemo(() => {
    if (!walletsGenerated) return {}
    const h: Record<string, number> = {}
    for (const b of onChainBalances) {
      h[b.symbol] = (h[b.symbol] || 0) + b.balance
    }
    return h
  }, [onChainBalances, walletsGenerated])

  const dailyPnL = React.useMemo(
    () => calculateDailyPnL(holdings, livePrices, coins),
    [holdings, livePrices, coins],
  )

  // Per-view balance
  const displayedBalance = React.useMemo(() => {
    switch (activeView) {
      case "main":    return onChainTotal
      case "spot":    return spotBalance
      case "futures": return futuresBalance
      case "total":
      default:        return onChainTotal + spotBalance + futuresBalance
    }
  }, [activeView, onChainTotal, spotBalance, futuresBalance])

  // Count active assets across on-chain + Hyperliquid spot
  const activeAssetCount = React.useMemo(() => {
    const onChainCount = onChainBalances.filter((b) => b.balance > 0).length
    const hlCount = hlBalances.filter((b) => b.total > 0 && b.coin !== "USDC").length
    return onChainCount + hlCount
  }, [onChainBalances, hlBalances])

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader"
    : "Trader"

  const currentView = WALLET_VIEWS.find((v) => v.key === activeView)!

  const handleCopy = (addr: string, chain: string) => {
    if (addr) {
      navigator.clipboard.writeText(addr)
      setIsCopied(chain)
      setTimeout(() => setIsCopied(null), 1500)
    }
  }

  if (error) return <ErrorState message={error} />

  const MASK = "$••••••"
  // All six receivable networks. Arbitrum reuses the Ethereum address, exactly
  // as the mobile registry does — 6 networks, 5 wallet keys.
  const WALLETS = NETWORKS.map((n) => ({
    key: n.key,
    label: n.label,
    addr: addresses?.[n.chain] ?? "",
    icon: NETWORK_ICON[n.key],
  }))
  const activeChain = WALLETS.find((w) => w.key === selectedWallet) ?? WALLETS[0]

  const ACTIONS = [
    { label: "Deposit",  href: "/buy",          icon: Exchange01Icon },
    { label: "Withdraw", href: "/sell",         icon: CreditCardIcon },
    { label: "Swap",     href: "/swap",         icon: CoinsSwapIcon },
    { label: "Trade",    href: "/trade",        icon: ChartLineData01Icon },
    { label: "History",  href: "/transactions", icon: Clock01Icon },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── Hero block — the silk field runs behind everything down to the
             action rail, exactly as the mobile HeaderBackdrop does. ── */}
      <div className="relative -mx-4 -mt-4 px-4 pt-4 pb-5 md:-mx-6 md:-mt-6 md:px-6 md:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
        <SilkBackdrop className="rounded-b-3xl" />

        <div className="relative flex flex-col gap-5">
          {/* Greeting row */}
          <div data-onboarding="dash-greeting" className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {isLoaded ? (
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.imageUrl} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              )}
              <div className="flex flex-col">
                <h2 className="text-sm font-semibold tracking-tight">
                  {isLoaded ? `Welcome back, ${displayName}` : "Loading…"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Here&apos;s what&apos;s happening with your portfolio today.
                </p>
              </div>
            </div>
          </div>

          {/* Network strip — always on, value-carrying (mobile grammar) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveView("total")}
              className={`flex shrink-0 items-center gap-2.5 rounded-full py-2 pl-2 pr-4 transition-colors ${
                activeView === "total" ? "bg-accent" : "bg-card/70 hover:bg-accent/60"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.12]">
                <HugeiconsIcon icon={Coins01Icon} className="h-4 w-4 text-primary" />
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-[14px] font-semibold">All networks</span>
                <span className="text-[12.5px] tabular-nums text-muted-foreground">
                  {hidden ? "••••" : formatUSD(onChainTotal + spotBalance + futuresBalance)}
                </span>
              </span>
            </button>
            {WALLETS.map((w) => {
              const active = activeView === "main" && w.key === selectedWallet
              return (
                <button
                  key={w.key}
                  onClick={() => { setActiveView("main"); setSelectedWallet(w.key) }}
                  className={`flex shrink-0 items-center gap-2.5 rounded-full py-2 pl-2 pr-4 transition-colors ${
                    active ? "bg-accent" : "bg-card/70 hover:bg-accent/60"
                  }`}
                >
                  <img src={w.icon} alt="" className="h-8 w-8 rounded-full" />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[14px] font-semibold">{w.label}</span>
                    <span className="text-[12.5px] tabular-nums text-muted-foreground">
                      {hidden ? "••••" : formatUSD(chainTotals[w.key] ?? 0)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Balance hero — the eyebrow/eye pair stays with the figure rather
              than spanning the full desktop width the way it does on a phone. */}
          <div data-onboarding="dash-balance" className="flex w-fit flex-col gap-1">
            <div className="flex items-center gap-3">
              <Eyebrow>{activeView === "total" ? "Est. Total Value" : `${currentView.label} Balance`}</Eyebrow>
              <button
                onClick={() => setHidden((v) => !v)}
                className={`transition-colors ${hidden ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`}
                aria-label={hidden ? "Show balances" : "Hide balances"}
              >
                <HugeiconsIcon icon={EyeIcon} className="h-[18px] w-[18px]" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Balance value={formatUSD(displayedBalance)} hidden={hidden} mask={MASK} />
              {dailyPnL !== 0 && !hidden && <DeltaChip value={dailyPnL} prefix="$" suffix="" />}
            </div>
            <span className="text-[13px] text-muted-foreground">{currentView.sub}</span>
          </div>

          {/* View tabs — directly under the figure they control. The wrapper
              lets the bar scroll rather than push the page wide on a phone. */}
          <div className="-mx-1 max-w-full overflow-x-auto px-1 scrollbar-none">
            <Segmented
              options={WALLET_VIEWS.map((v) => ({ key: v.key, label: v.label, icon: undefined }))}
              value={activeView}
              onChange={setActiveView}
            />
          </div>

          {/* Address chip for the selected chain */}
          {activeView === "main" && activeChain.addr && (
            <button
              onClick={() => handleCopy(activeChain.addr, activeChain.key)}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card/70 px-3 py-1.5 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-accent"
            >
              {truncAddr(activeChain.addr)}
              <HugeiconsIcon
                icon={Copy01Icon}
                className={`h-3.5 w-3.5 shrink-0 ${isCopied === activeChain.key ? "text-credit" : "text-muted-foreground/50"}`}
              />
            </button>
          )}

          {/* Action rail */}
          <div data-onboarding="dash-actions" className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {ACTIONS.map((a) => (
              <ActionPill
                key={a.label}
                href={a.href}
                label={a.label}
                icon={({ className }) => <HugeiconsIcon icon={a.icon} className={className} />}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats card ── */}
      <div data-onboarding="dash-stats" className="grid grid-cols-1 divide-y divide-border/30 rounded-2xl bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {/* Today's P&L */}
        <div className="flex flex-col gap-1.5 p-4">
          <Eyebrow>Today&apos;s P&amp;L</Eyebrow>
          <span className={`text-xl font-bold tabular-nums tracking-tight ${dailyPnL >= 0 ? "text-credit" : "text-debit"}`}>
            {hidden ? "••••" : `${dailyPnL >= 0 ? "+" : ""}${formatUSD(dailyPnL)}`}
          </span>
          <span className="text-xs text-muted-foreground">24h change</span>
        </div>

        {/* Assets */}
        <div className="flex flex-col gap-1.5 p-4">
          <Eyebrow>Assets</Eyebrow>
          <span className="text-xl font-bold tabular-nums tracking-tight">{activeAssetCount}</span>
          <span className="text-xs text-muted-foreground">Active tokens</span>
        </div>

        {/* Networks — driven by the registry, not a typed-in number */}
        <div className="flex flex-col gap-1.5 p-4">
          <Eyebrow>Networks</Eyebrow>
          <span className="text-xl font-bold tabular-nums tracking-tight">{NETWORKS.length}</span>
          <span className="text-xs text-muted-foreground">
            {NETWORKS.map((n) => n.nativeSymbol).join(" · ")}
          </span>
        </div>
      </div>
    </div>
  )
}
