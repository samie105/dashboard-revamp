"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  Exchange01Icon,
  CreditCardIcon,
  ArrowDown01Icon,
  Wallet01Icon,
  Chart01Icon,
  ChartLineData01Icon,
  Coins01Icon,
  Globe02Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { ErrorState } from "@/components/error-state"
import type { CoinData } from "@/lib/actions"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useHyperliquidBalance } from "@/hooks/useHyperliquidBalance"

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
  return prices[symbol] ?? 0
}

function calculateDailyPnL(
  holdings: Record<string, number>,
  prices: Record<string, number>,
  coins: CoinData[],
): number {
  let pnl = 0
  for (const [symbol, amount] of Object.entries(holdings)) {
    const price = prices[symbol] ?? 0
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
  const [isCopied, setIsCopied] = React.useState(false)
  const [activeView, setActiveView] = React.useState<WalletView>("total")

  // On-chain balance: sum of all on-chain tokens valued in USD
  const onChainTotal = React.useMemo(() => {
    if (!walletsGenerated) return 0
    let total = 0
    for (const b of onChainBalances) {
      const p = getPrice(prices, b.symbol)
      total += b.balance * (p > 0 ? p : b.symbol === "USDT" || b.symbol === "USDC" ? 1 : 0)
    }
    return total
  }, [onChainBalances, prices, walletsGenerated])

  // Spot trading balance = sum of all spot holdings (USDC + tokens at current prices)
  const spotBalance = hlBalances.reduce((sum, b) => sum + (b.currentValue || 0), 0)

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
    () => calculateDailyPnL(holdings, prices, coins),
    [holdings, prices, coins],
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

  const solAddress = addresses?.solana ?? ""
  const currentView = WALLET_VIEWS.find((v) => v.key === activeView)!

  const handleCopy = () => {
    if (solAddress) {
      navigator.clipboard.writeText(solAddress)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 1500)
    }
  }

  if (error) return <ErrorState message={error} />

  return (
    <div className="rounded-2xl bg-card">
      {/* ── Top: Greeting + Deposit / Withdraw ── */}
      <div data-onboarding="dash-greeting" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {isLoaded ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.imageUrl} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
          )}
          <div className="flex flex-col">
            <h2 className="text-base font-semibold tracking-tight">
              {isLoaded ? `Welcome back, ${displayName}!` : "Loading…"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what&apos;s happening with your portfolio today.
            </p>
          </div>
        </div>

        <div data-onboarding="dash-actions" className="flex items-center gap-2">
          <a
            href="/deposit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <HugeiconsIcon icon={Exchange01Icon} className="h-3.5 w-3.5" />
            Deposit
          </a>
          <a
            href="/withdraw"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
          >
            <HugeiconsIcon icon={CreditCardIcon} className="h-3.5 w-3.5" />
            Withdraw
          </a>
        </div>
      </div>

      {/* ── Separator ── */}
      <div className="h-px bg-border/30" />

      {/* ── Balance selector ── */}
      <div data-onboarding="dash-balance" className="flex flex-col gap-2 p-4 border-b border-border/30">
        <div className="flex items-center gap-0.5">
          {WALLET_VIEWS.map((view) => (
            <button
              key={view.key}
              onClick={() => setActiveView(view.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                activeView === view.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              }`}
            >
              <HugeiconsIcon icon={view.icon} className="h-3 w-3" />
              {view.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <span className="text-2xl font-bold tabular-nums tracking-tight">{formatUSD(displayedBalance)}</span>
          {activeView === "main" && solAddress && (
            <button
              onClick={handleCopy}
              className="mb-0.5 inline-flex items-center gap-1 rounded bg-accent/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground transition-colors hover:bg-accent"
            >
              {truncAddr(solAddress)}
              <HugeiconsIcon
                icon={Copy01Icon}
                className={`h-2.5 w-2.5 ${isCopied ? "text-emerald-500" : "text-muted-foreground/50"}`}
              />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{currentView.sub}</span>
      </div>

      {/* ── Stats row ── */}
      <div data-onboarding="dash-stats" className="grid grid-cols-3 divide-x divide-border/30">
        {/* Today's P&L */}
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${dailyPnL >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Today&apos;s P&amp;L
            </span>
          </div>
          <span className={`text-xl font-bold tabular-nums tracking-tight ${dailyPnL >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {dailyPnL >= 0 ? "+" : ""}{formatUSD(dailyPnL)}
          </span>
          <span className="text-xs text-muted-foreground">24h change</span>
        </div>

        {/* Assets */}
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={Exchange01Icon} className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Assets
            </span>
          </div>
          <span className="text-xl font-bold tabular-nums tracking-tight">{activeAssetCount}</span>
          <span className="text-xs text-muted-foreground">Active tokens</span>
        </div>

        {/* Networks */}
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center gap-1.5">
            <HugeiconsIcon icon={Globe02Icon} className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Networks
            </span>
          </div>
          <span className="text-xl font-bold tabular-nums tracking-tight">6</span>
          <span className="text-xs text-muted-foreground">SOL · ETH · ARB · SUI · TON · TRX</span>
        </div>
      </div>
    </div>
  )
}
