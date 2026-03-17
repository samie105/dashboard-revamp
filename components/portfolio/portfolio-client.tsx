"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Wallet01Icon,
  Chart01Icon,
  Search01Icon,
  Copy01Icon,
  Exchange01Icon,
  CreditCardIcon,
  RefreshIcon,
  Shield01Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
  StarIcon,
  Cancel01Icon,
  Add01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getUserBalances } from "@/lib/actions"
import type { CoinData, UserBalance } from "@/lib/actions"
import { useTradeSelector } from "@/components/trade-selector"
import { useWalletBalances } from "@/hooks/useWalletBalances"

// ── Types ────────────────────────────────────────────────────────────────

interface PortfolioClientProps {
  coins: CoinData[]
  prices: Record<string, number>
  globalStats: {
    totalMarketCap: number
    totalVolume: number
    btcDominance: number
    marketCapChange24h: number
  }
}

type Tab = "overview" | "wallets" | "fund"

// ── Helpers ──────────────────────────────────────────────────────────────

function formatUSD(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatPrice(price: number) {
  if (price >= 1000) return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1) return "$" + price.toFixed(2)
  if (price >= 0.01) return "$" + price.toFixed(4)
  return "$" + price.toFixed(6)
}

const CHAINS = [
  { key: "ethereum", label: "Ethereum",  symbol: "ETH", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { key: "arbitrum", label: "Arbitrum",  symbol: "ETH", icon: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { key: "solana",   label: "Solana",    symbol: "SOL", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { key: "sui",      label: "Sui",       symbol: "SUI", icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png" },
  { key: "ton",      label: "TON",       symbol: "TON", icon: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png" },
  { key: "tron",     label: "Tron",      symbol: "TRX", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
] as const

const INITIAL_WATCHLIST = ["BTC", "ETH", "SOL", "SUI", "TON", "TRX", "USDT"]

// ── Onboarding ───────────────────────────────────────────────────────────

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-onboarding="portfolio-header"]',
    title: "Portfolio Account",
    description: "View your total net worth and refresh balances from this header.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="portfolio-tabs"]',
    title: "Navigation Tabs",
    description: "Switch between Overview, Wallets, and Fund Trading Wallet.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="portfolio-main"]',
    title: "Account Overview",
    description: "See your trading account summary and funding balances at a glance.",
    placement: "bottom",
  },
  {
    target: '[data-onboarding="portfolio-sidebar"]',
    title: "Quick Actions & Watchlist",
    description: "Deposit, withdraw, and track your favorite coins with live prices.",
    placement: "left",
  },
]

// ── Sub-components ───────────────────────────────────────────────────────

/* Sparkline */
function Sparkline({ change24h }: { change24h: number }) {
  const up = change24h >= 0
  const d = up ? [40, 45, 42, 48, 52, 50, 55, 58, 55, 60] : [60, 55, 58, 52, 48, 50, 45, 42, 45, 40]
  const h = 20, w = 48, min = Math.min(...d), max = Math.max(...d), r = max - min || 1
  const pts = d.map((v, i) => `${(i * w) / (d.length - 1)},${h - ((v - min) / r) * h}`).join(" ")
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? "oklch(0.72 0.19 142)" : "oklch(0.64 0.2 25)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* How It Works (right panel) */
const HOW_STEPS = [
  { title: "Check overview", desc: "View trading & funding balances" },
  { title: "Manage wallets", desc: "See addresses across all chains" },
  { title: "Fund trading", desc: "Transfer USDC to your trading account" },
  { title: "Start trading", desc: "Head to Spot or Futures to trade" },
]

function HowItWorks() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">How it works</h3>
      </div>
      <div className="px-4 py-4">
        <div className="relative pl-5">
          <div className="absolute left-1.75 top-1 bottom-1 w-px bg-border/50" />
          <div className="space-y-4">
            {HOW_STEPS.map((s, i) => (
              <div key={i} className="relative flex items-start gap-3">
                <div className="absolute -left-5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-tight">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Quick Actions (right panel) */
function QuickActions() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
        <HugeiconsIcon icon={ArrowUpRight01Icon} className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <Link
          href="/deposit"
          className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-accent/20 p-3 transition-all hover:bg-accent/40 group"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 transition-transform group-hover:scale-105">
            <HugeiconsIcon icon={Exchange01Icon} className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">Deposit</p>
            <p className="text-[10px] text-muted-foreground">Add funds</p>
          </div>
        </Link>
        <Link
          href="/withdraw"
          className="flex items-center gap-2.5 rounded-xl border border-border/30 bg-accent/20 p-3 transition-all hover:bg-accent/40 group"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent transition-transform group-hover:scale-105">
            <HugeiconsIcon icon={CreditCardIcon} className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">Withdraw</p>
            <p className="text-[10px] text-muted-foreground">Cash out</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

/* Watchlist (right panel) */
function Watchlist({
  coins,
  watchlistSymbols,
  onWatchlistChange,
}: {
  coins: CoinData[]
  watchlistSymbols: string[]
  onWatchlistChange: (list: string[]) => void
}) {
  const [starred, setStarred] = React.useState<string[]>(["BTC", "ETH", "SOL"])
  const [showAdd, setShowAdd] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setShowAdd(false); setSearch("") } }
    if (showAdd) document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [showAdd])

  const list = React.useMemo(
    () => watchlistSymbols.map((s) => coins.find((c) => c.symbol === s)).filter((c): c is CoinData => !!c),
    [coins, watchlistSymbols],
  )

  const addable = React.useMemo(() => {
    const inSet = new Set(watchlistSymbols)
    let r = coins.filter((c) => !inSet.has(c.symbol))
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) }
    return r
  }, [coins, watchlistSymbols, search])

  return (
    <div className="rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={StarIcon} className="h-3.5 w-3.5 text-primary" />
          <div>
            <h3 className="text-xs font-semibold">Watchlist</h3>
            <p className="text-[10px] text-muted-foreground">Live prices</p>
          </div>
        </div>
        <div className="relative" ref={ref}>
          <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors">
            <HugeiconsIcon icon={Add01Icon} className="h-3 w-3" /> Add
          </button>
          {showAdd && (
            <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border-0 bg-popover/90 backdrop-blur-2xl ring-1 ring-white/10 shadow-xl shadow-black/8 overflow-hidden">
              <div className="border-b border-white/10 p-2">
                <div className="flex items-center gap-2 rounded-lg bg-accent/40 px-2.5 py-1.5">
                  <HugeiconsIcon icon={Search01Icon} className="h-3 w-3 text-muted-foreground shrink-0" />
                  <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="bg-transparent text-xs outline-none w-full placeholder:text-muted-foreground/50" />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto slim-scroll">
                <div className="p-1">
                  {addable.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-4">No coins found</p>
                  ) : addable.map((c) => (
                    <button key={c.id} onClick={() => { onWatchlistChange([...watchlistSymbols, c.symbol]); setShowAdd(false); setSearch("") }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent/30 transition-colors">
                      {c.image ? <img src={c.image} alt="" className="h-4 w-4 rounded-full" /> : <span className="text-[10px] font-bold">{c.symbol}</span>}
                      <span className="text-xs font-medium">{c.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">{c.name}</span>
                      <HugeiconsIcon icon={Add01Icon} className="ml-auto h-3 w-3 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ScrollArea className="h-80">
        <div className="p-1.5">
          {list.map((coin) => {
            const up = coin.change24h >= 0
            const isStar = starred.includes(coin.symbol)
            return (
              <div key={coin.id} className="group flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-2">
                  <button onClick={() => setStarred((p) => p.includes(coin.symbol) ? p.filter((s) => s !== coin.symbol) : [...p, coin.symbol])} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <HugeiconsIcon icon={StarIcon} className={`h-3 w-3 ${isStar ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"} transition-colors`} />
                  </button>
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/30 overflow-hidden">
                    {coin.image ? <img src={coin.image} alt="" className="h-4 w-4" /> : <span className="text-[10px] font-bold">{coin.symbol}</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium leading-tight">{coin.symbol}/USD</p>
                    <p className="text-[10px] text-muted-foreground">{coin.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="text-right">
                    <p className="text-xs font-medium tabular-nums">{formatPrice(coin.price)}</p>
                    <p className={`text-[10px] font-medium tabular-nums ${up ? "text-emerald-500" : "text-red-500"}`}>
                      {up ? "+" : ""}{coin.change24h.toFixed(2)}%
                    </p>
                  </div>
                  <div className="hidden sm:block"><Sparkline change24h={coin.change24h} /></div>
                  <button onClick={() => onWatchlistChange(watchlistSymbols.filter((s) => s !== coin.symbol))} className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-red-500/10 transition-all">
                    <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 text-muted-foreground hover:text-red-500 transition-colors" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// ── Trade Button ──────────────────────────────────────────────────────

function PortfolioTradeButton() {
  const { openTradeSelector } = useTradeSelector()
  return (
    <button onClick={() => openTradeSelector()} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
      Trade <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
    </button>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function PortfolioClient({ coins, prices }: PortfolioClientProps) {
  const { user } = useAuth()
  const { addresses, tradingWallet, walletsGenerated, isLoading: walletsLoading, refreshWallets } = useWallet()
  const { profile, updateProfile } = useProfile()
  const { balances: walletBalances } = useWalletBalances()

  // Sum USDC/USDT on-chain balance across all chains
  const usdcWalletBalance = React.useMemo(() => {
    return walletBalances
      .filter((b) => b.symbol === "USDC" || b.symbol === "USDT")
      .reduce((sum, b) => sum + b.balance, 0)
  }, [walletBalances])

  const [activeTab, setActiveTab] = React.useState<Tab>("overview")
  const [transferAmount, setTransferAmount] = React.useState("")
  const [copiedAddr, setCopiedAddr] = React.useState<string | null>(null)
  const [watchlistSymbols, setWatchlistSymbols] = React.useState<string[]>(
    profile?.watchlist?.length ? profile.watchlist : INITIAL_WATCHLIST,
  )

  // Sync watchlist when profile loads
  React.useEffect(() => {
    if (profile?.watchlist !== undefined) {
      setWatchlistSymbols(profile.watchlist.length ? profile.watchlist : INITIAL_WATCHLIST)
    }
  }, [profile?.watchlist])

  // Wrapper that persists to MongoDB via updateProfile
  const handleWatchlistChange = React.useCallback(
    (newList: string[]) => {
      setWatchlistSymbols(newList)
      updateProfile({ watchlist: newList }).catch(() => {})
    },
    [updateProfile],
  )

  // Balance state from backend
  const [accountBalances, setAccountBalances] = React.useState<UserBalance[]>([])
  const [accountTotal, setAccountTotal] = React.useState(0)

  React.useEffect(() => {
    const uid = user?.userId
    if (!uid) return
    getUserBalances(uid).then((r) => {
      if (r.success) {
        setAccountBalances(r.balances)
        setAccountTotal(r.totalUsd)
      }
    })
  }, [user?.userId])

  const isOnboardingDone = profile?.onboardingCompleted?.includes("portfolio")
  const usdcBal = accountBalances.find((b) => b.asset === "USDC" || b.asset === "USDT")
  const tradingValue = accountTotal
  const availableUsdc = usdcBal ? usdcBal.available : 0
  const inOrders = accountBalances.reduce((sum, b) => sum + b.locked, 0)
  const totalNetWorth = accountTotal

  const copyAddr = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddr(text)
    setTimeout(() => setCopiedAddr(null), 1500)
  }

  return (
    <>
      <OnboardingFlow steps={ONBOARDING_STEPS} storageKey="portfolio" completed={isOnboardingDone} onComplete={() => markOnboardingComplete("portfolio")} />

      {/* ── Page header ── */}
      <div data-onboarding="portfolio-header" className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Portfolio</h1>
          <p className="text-xs text-muted-foreground">
            Manage your accounts, wallets &amp; balances
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-right">
            <span className="text-[10px] text-muted-foreground">Net Worth</span>
            <span className="text-sm font-bold tabular-nums text-primary">{formatUSD(totalNetWorth)}</span>
          </div>
          <button
            onClick={() => refreshWallets()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent"
          >
            <HugeiconsIcon icon={RefreshIcon} className={`h-3.5 w-3.5 ${walletsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 2-column layout ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* ════ LEFT — Main card ════ */}
        <div>
          <div className="rounded-2xl border border-border/40 bg-card shadow-sm">
            {/* Card header with underline tabs */}
            <div data-onboarding="portfolio-tabs" className="border-b border-border/30 px-4">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Wallet01Icon} className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Portfolio</h2>
                </div>
              </div>
              <div className="flex items-center gap-5 -mb-px">
                {(["overview", "wallets", "fund"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-2.5 text-[11px] font-medium transition-colors ${
                      activeTab === tab
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "fund" ? "Fund Wallet" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {activeTab === tab && (
                      <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div data-onboarding="portfolio-main" className="p-4 space-y-3">
              {/* ─── OVERVIEW TAB ─── */}
              {activeTab === "overview" && (
                <>
                  {/* Trading Account */}
                  <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Chart01Icon} className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[11px] font-medium text-muted-foreground">Trading Account</span>
                      </div>
                      <PortfolioTradeButton />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Account Value</p>
                        <p className="text-sm font-bold tabular-nums">{formatUSD(tradingValue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Available USDC</p>
                        <p className="text-sm font-bold tabular-nums text-emerald-500">{formatUSD(availableUsdc)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">In Orders</p>
                        <p className="text-sm font-bold tabular-nums text-primary">{formatUSD(inOrders)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Funding Account */}
                  <div className="h-px bg-border/30" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Funding Account (Main Wallet)</span>
                    </div>
                    <div className="rounded-xl border border-border/30 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/20 bg-accent/10 text-[10px] text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">Asset</th>
                            <th className="px-3 py-2 text-left font-medium">Chain</th>
                            <th className="px-3 py-2 text-right font-medium">Balance</th>
                            <th className="px-3 py-2 text-right font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                          {walletsLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                              <tr key={i}><td colSpan={4} className="px-3 py-2.5"><div className="h-4 w-full animate-pulse rounded bg-muted" /></td></tr>
                            ))
                          ) : !walletsGenerated ? (
                            <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground text-[11px]">No assets found. Set up your wallet to get started.</td></tr>
                          ) : (
                            CHAINS.map((chain) => (
                              <tr key={chain.key} className="hover:bg-accent/20 transition-colors">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <img src={chain.icon} alt="" className="h-5 w-5 rounded-full" />
                                    <span className="font-medium">{chain.symbol}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">{chain.label}</td>
                                <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                                  {(() => {
                                    const b = accountBalances.find((x) => x.asset.toUpperCase() === chain.symbol.toUpperCase() || x.chain === chain.key)
                                    return (b ? b.available + b.locked : 0).toFixed(4)
                                  })()}
                                </td>
                                <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                                  {(() => {
                                    const b = accountBalances.find((x) => x.asset.toUpperCase() === chain.symbol.toUpperCase() || x.chain === chain.key)
                                    const amt = b ? b.available + b.locked : 0
                                    return formatUSD(amt * (prices[chain.symbol] ?? 0))
                                  })()}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* ─── WALLETS TAB ─── */}
              {activeTab === "wallets" && (
                <div className="space-y-4">
                  {walletsLoading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">Loading wallets…</p>
                    </div>
                  ) : !walletsGenerated ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/50">
                        <HugeiconsIcon icon={Wallet01Icon} className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">No wallets yet</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Your multi-chain wallets will appear here once set up.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Trading Wallet — hero card */}
                      <div className="rounded-xl border border-primary/20 bg-linear-to-br from-primary/5 to-transparent p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold">Trading Wallet</p>
                              <p className="text-[10px] text-muted-foreground">Hyperliquid · Arbitrum</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            tradingWallet?.address ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                          }`}>
                            {tradingWallet?.address ? "Active" : "Not Set Up"}
                          </span>
                        </div>
                        {tradingWallet?.address ? (
                          <button
                            onClick={() => copyAddr(tradingWallet.address)}
                            className="flex w-full items-center justify-between rounded-lg bg-card/80 border border-border/30 px-3 py-2.5 group hover:border-primary/30 transition-colors"
                          >
                            <code className="text-[11px] font-mono text-foreground/80">{truncAddr(tradingWallet.address)}</code>
                            <HugeiconsIcon
                              icon={copiedAddr === tradingWallet.address ? CheckmarkCircle01Icon : Copy01Icon}
                              className={`h-3.5 w-3.5 transition-colors ${copiedAddr === tradingWallet.address ? "text-emerald-500" : "text-muted-foreground group-hover:text-primary"}`}
                            />
                          </button>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg border border-dashed border-border/40 bg-card/50 px-3 py-3">
                            <p className="text-[11px] text-muted-foreground">No trading wallet configured</p>
                            <Link href="/spot" className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-primary/90 transition-colors">
                              Set Up
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Chain Wallets — compact list */}
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <HugeiconsIcon icon={Shield01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-medium text-muted-foreground">Chain Wallets</span>
                        </div>
                        <div className="rounded-xl border border-border/30 overflow-hidden divide-y divide-border/20">
                          {CHAINS.map((chain) => {
                            const addrKey = chain.key === "arbitrum" ? "ethereum" : chain.key
                            const addr = addresses?.[addrKey as keyof typeof addresses] ?? ""
                            return (
                              <div key={chain.key} className="flex items-center justify-between px-3.5 py-3 hover:bg-accent/20 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <img src={chain.icon} alt="" className="h-5 w-5 rounded-full" />
                                  <div>
                                    <p className="text-xs font-medium">{chain.label}</p>
                                    {addr ? (
                                      <p className="text-[10px] font-mono text-muted-foreground">{truncAddr(addr)}</p>
                                    ) : (
                                      <p className="text-[10px] text-muted-foreground/50">Not generated</p>
                                    )}
                                  </div>
                                </div>
                                {addr ? (
                                  <button
                                    onClick={() => copyAddr(addr)}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                                  >
                                    <HugeiconsIcon icon={copiedAddr === addr ? CheckmarkCircle01Icon : Copy01Icon} className={`h-3.5 w-3.5 ${copiedAddr === addr ? "text-emerald-500" : ""}`} />
                                  </button>
                                ) : (
                                  <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[9px] text-muted-foreground">Pending</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Unified account note */}
                      {addresses?.ethereum === tradingWallet?.address && (
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Unified account — your Ethereum wallet doubles as your trading wallet.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ─── FUND TAB ─── */}
              {activeTab === "fund" && (
                <div className="space-y-3">
                  {/* Source asset */}
                  <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-medium text-muted-foreground">Source Asset</span>
                      <span className="text-[11px] text-muted-foreground">Balance: {usdcWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-card border border-border/40 px-2.5 py-1.5">
                        <img src="https://coin-images.coingecko.com/coins/images/6319/small/usdc.png" alt="" className="h-5 w-5 rounded-full" />
                        <span className="text-xs font-semibold">USDC</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">on Arbitrum</span>
                    </div>
                  </div>

                  {/* From → To */}
                  <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-muted-foreground">From</span>
                      <span className="text-xs font-medium">Personal Wallet</span>
                    </div>
                  </div>

                  <div className="flex justify-center -my-2 relative z-10">
                    <div className="rounded-full border-4 border-card bg-primary p-1.5 shadow-sm">
                      <HugeiconsIcon icon={ArrowDown01Icon} className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-muted-foreground">To</span>
                      <span className="text-xs font-medium">Trading Account</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="rounded-xl border border-border/30 bg-accent/20 p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground">Amount (USDC)</span>
                      <span className="text-[11px] text-muted-foreground">Available: {usdcWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={transferAmount}
                        onChange={(e) => { if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setTransferAmount(e.target.value) }}
                        placeholder="0.00"
                        className="flex-1 min-w-0 bg-transparent text-xl font-semibold outline-none tabular-nums placeholder:text-muted-foreground/40"
                      />
                      <button onClick={() => setTransferAmount("0")} className="rounded-lg bg-card border border-border/40 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-accent transition-colors">
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-start gap-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 px-3 py-2.5">
                    <HugeiconsIcon icon={InformationCircleIcon} className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-px" />
                    <div className="text-[10px] text-blue-400 space-y-0.5">
                      <p>Minimum deposit: 5 USDC. Requires ETH on Arbitrum for gas.</p>
                    </div>
                  </div>

                  {/* Button */}
                  <button
                    disabled={!transferAmount || parseFloat(transferAmount) <= 0}
                    className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Confirm Deposit
                  </button>

                  <p className="text-center text-[10px] text-muted-foreground/50">
                    Processed via the WorldStreet Bridge on Arbitrum
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════ RIGHT — Info panels ════ */}
        <div data-onboarding="portfolio-sidebar" className="flex flex-col gap-4">
          <QuickActions />
          <Watchlist coins={coins} watchlistSymbols={watchlistSymbols} onWatchlistChange={handleWatchlistChange} />
          <HowItWorks />
        </div>
      </div>
    </>
  )
}
