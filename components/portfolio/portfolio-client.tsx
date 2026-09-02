"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Wallet01Icon,
  Chart01Icon,
  Search01Icon,
  Copy01Icon,
  Exchange01Icon,
  RefreshIcon,
  Shield01Icon,
  ArrowRight01Icon,
  StarIcon,
  Cancel01Icon,
  Add01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
  ArrowUpRight01Icon,
  ArrowDownLeft01Icon,
} from "@hugeicons/core-free-icons"
import {
  ActionPill,
  Balance,
  CardHeader,
  CardShell,
  Eyebrow,
  IconAction,
  PageHeader,
  Segmented,
  Skel,
  Sparkline,
  WeightBar,
} from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { numOr, pctSigned, price, qty, share, usd } from "@/lib/num"
import { useSparklines } from "@/hooks/useSparklines"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { useAuth } from "@/components/auth-provider"
import { useWallet } from "@/components/wallet-provider"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getUserBalances } from "@/lib/actions"
import type { CoinData, UserBalance } from "@/lib/actions"
import { getSpotBalances, getSpotPositions, getTokenPrices } from "@/lib/trade-adapter"
import type { LedgerBalance, PositionInfo } from "@/lib/trade-adapter"

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

type Tab = "overview" | "wallets"

/* Each tab explains itself, in one line, right where it lives. This replaces a
   standalone "How it works" panel whose four steps only narrated these very
   tabs — guidance next to the thing beats guidance about the thing. */
const TABS = [
  { key: "overview" as const, label: "Overview", blurb: "Where your money sits, across trading and funding" },
  { key: "wallets" as const, label: "Wallets", blurb: "Your address on every chain — copy one to receive" },
]

// ── Helpers ──────────────────────────────────────────────────────────────

/* All four of these used to assume a finite number. A price feed that returns
   undefined for one symbol then printed "$NaN" in the middle of a balance
   table — a figure the reader can't distinguish from a real one, in a place
   where believing it costs money. */
function formatUSD(n: unknown) {
  return usd(n)
}

function truncAddr(addr: string) {
  if (!addr || addr.length < 14) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatPrice(value: unknown) {
  return price(value)
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
    title: "Accounts",
    description: "Overview shows where your money sits; Wallets shows your address on every chain.",
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
    title: "Watchlist",
    description: "Track the coins you care about, with live prices.",
    placement: "left",
  },
]

// ── Sub-components ───────────────────────────────────────────────────────

/* Action rail — the page's verbs, on the page.
   These were a titled "Quick Actions" card in the right rail: a header, a
   border and two buttons inside it. A panel is for a THING (a watchlist, an
   account); actions belong to the page, next to the balance they move. Same
   pill grammar as the dashboard rail, and they open the real money-flow modal
   rather than walking the user off to /buy and /sell. */
function PortfolioActions() {
  const { openFlow } = useMoneyFlow()
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={ArrowDownLeft01Icon} className={className} />} label="Deposit" onClick={() => openFlow("buy")} />
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={ArrowUpRight01Icon} className={className} />} label="Withdraw" onClick={() => openFlow("sell")} />
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={Exchange01Icon} className={className} />} label="Fund trading" onClick={() => openFlow("fund")} />
      {/* Straight to the trading screen. This used to open a modal whose only
          content was a list of links that are all permanently in the sidebar. */}
      <ActionPill icon={({ className }) => <HugeiconsIcon icon={Chart01Icon} className={className} />} label="Trade" href="/trade" />
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

  // Real 7-day curves — one batched request for the whole list. The same
  // response carries the 24h change, which the Hyperliquid-first price feed
  // doesn't (it reported a flat 0.00% for every coin on this page).
  const spark = useSparklines(watchlistSymbols)

  const addable = React.useMemo(() => {
    const inSet = new Set(watchlistSymbols)
    let r = coins.filter((c) => !inSet.has(c.symbol))
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) }
    return r
  }, [coins, watchlistSymbols, search])

  return (
    <CardShell>
      <CardHeader
        title="Watchlist"
        subtitle="Live prices"
        right={
        <div className="relative shrink-0" ref={ref}>
          <button onClick={() => setShowAdd((v) => !v)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <HugeiconsIcon icon={Add01Icon} className="h-3.5 w-3.5" /> Add
          </button>
          {showAdd && (
            <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border-0 bg-popover ring-1 ring-border/40 shadow-xl shadow-black/8 overflow-hidden">
              <div className="border-b border-white/10 p-2">
                <div className="flex items-center gap-2 rounded-lg bg-accent/40 px-2.5 py-1.5">
                  <HugeiconsIcon icon={Search01Icon} className="h-3 w-3 text-muted-foreground shrink-0" />
                  <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/50" />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto slim-scroll">
                <div className="p-1">
                  {addable.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-muted-foreground">No coins found</p>
                  ) : addable.map((c) => (
                    <button key={c.id} onClick={() => { onWatchlistChange([...watchlistSymbols, c.symbol]); setShowAdd(false); setSearch("") }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent/30 transition-colors">
                      <CoinAvatar src={c.image} symbol={c.symbol} size="sm" className="h-4 w-4 text-[7px]" />
                      <span className="text-[13px] font-semibold">{c.symbol}</span>
                      <span className="text-[12px] text-muted-foreground">{c.name}</span>
                      <HugeiconsIcon icon={Add01Icon} className="ml-auto h-3 w-3 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        }
      />
      {/* The list used to be pinned at h-80 inside a card that stretches to the
          left column's height — on a desktop that left ~140px of empty card
          under the last row. It now takes whatever room the card has, with a
          floor for the stacked mobile layout where the card has no height of
          its own to inherit. */}
      <ScrollArea className="min-h-[22rem] flex-1 lg:min-h-0">
        <div className="p-1.5">
          {list.map((coin) => {
            const s = spark(coin.symbol)
            // Prefer the change that arrives with the curve: it's from the same
            // series the chart draws, so the number and the line always agree.
            const change = numOr(s?.change24h ?? coin.change24h, 0)
            const up = change >= 0
            const isStar = starred.includes(coin.symbol)
            return (
              <div key={coin.id} className="group flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-2">
                  <button onClick={() => setStarred((p) => p.includes(coin.symbol) ? p.filter((s) => s !== coin.symbol) : [...p, coin.symbol])} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <HugeiconsIcon icon={StarIcon} className={`h-3 w-3 ${isStar ? "text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"} transition-colors`} />
                  </button>
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent/30">
                    <CoinAvatar src={coin.image} symbol={coin.symbol} size="sm" className="h-4 w-4 text-[7px]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight">{coin.symbol}/USD</p>
                    <p className="text-[12px] text-muted-foreground">{coin.name}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {/* The chart sat in a plain div inside a flex row, so in the
                      320px rail it was squeezed to a few pixels wide. It holds
                      its size now, and reserves the space while loading so the
                      figures don't jump sideways when the curve lands. */}
                  <span className="hidden h-6 w-16 shrink-0 items-center sm:flex">
                    {s === undefined ? (
                      <Skel className="h-4 w-full rounded-sm" />
                    ) : (
                      <Sparkline points={s?.prices} />
                    )}
                  </span>
                  <div className="w-[74px] shrink-0 text-right">
                    <p className="text-[13px] font-semibold tabular-nums">{formatPrice(coin.price)}</p>
                    <p className={`text-[12px] font-medium tabular-nums ${up ? "text-credit" : "text-debit"}`}>
                      {pctSigned(change)}
                    </p>
                  </div>
                  <button onClick={() => onWatchlistChange(watchlistSymbols.filter((s) => s !== coin.symbol))} className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-red-500/10 transition-all">
                    <HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3 text-muted-foreground hover:text-debit transition-colors" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </CardShell>
  )
}

// ── Trade Button ──────────────────────────────────────────────────────

function PortfolioTradeButton() {
  return (
    <Link href="/trade" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
      Trade <HugeiconsIcon icon={ArrowRight01Icon} className="h-3.5 w-3.5" />
    </Link>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function PortfolioClient({ coins, prices }: PortfolioClientProps) {
  const { user } = useAuth()
  const { addresses, tradingWallet, walletsGenerated, isLoading: walletsLoading, refreshWallets } = useWallet()
  const { profile, updateProfile } = useProfile()
  const [activeTab, setActiveTab] = React.useState<Tab>("overview")
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

  // SpotV2 ledger data
  const [spotBalances, setSpotBalances] = React.useState<LedgerBalance[]>([])
  const [spotPositions, setSpotPositions] = React.useState<(PositionInfo & { currentPrice: number })[]>([])

  React.useEffect(() => {
    const uid = user?.userId
    if (!uid) return
    // Fetch legacy balances for funding account
    getUserBalances(uid).then((r) => {
      if (r.success) {
        setAccountBalances(r.balances)
      }
    })
    // Fetch SpotV2 balances for trading account
    Promise.all([getSpotBalances(), getSpotPositions()])
      .then(async ([balances, positions]) => {
        setSpotBalances(balances)
        const tokens = positions.map((p) => p.token)
        const priceMap = tokens.length > 0 ? await getTokenPrices(tokens) : new Map<string, number>()
        setSpotPositions(positions.map((p) => ({ ...p, currentPrice: priceMap.get(p.token) ?? 0 })))
      })
      .catch(() => {})
  }, [user?.userId])

  // SpotV2-sourced trading account values
  const usdcEntry = spotBalances.find((b) => b.token === "USDC")
  const availableUsdc = usdcEntry?.available ?? 0
  const lockedUsdc = usdcEntry?.locked ?? 0
  const positionsValue = spotPositions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0)
  const tradingValue = availableUsdc + lockedUsdc + positionsValue
  const inOrders = lockedUsdc

  // What the funding (main) wallet is worth. Keyed off the balances themselves
  // rather than the CHAINS display list, so nothing is counted twice.
  const fundingValue = React.useMemo(
    () =>
      accountBalances.reduce(
        (sum, b) =>
          sum + numOr(numOr(b.available) + numOr(b.locked)) * numOr(prices[b.asset.toUpperCase()]),
        0,
      ),
    [accountBalances, prices],
  )

  /** One chain's funding balance. Matched on CHAIN, not asset: Ethereum and
   *  Arbitrum share the symbol ETH, and an asset-first match handed Arbitrum
   *  Ethereum's balance — the same money shown (and counted) twice. */
  const chainBalance = React.useCallback(
    (chainKey: string) => {
      const b = accountBalances.find((x) => x.chain === chainKey)
      return b ? b.available + b.locked : 0
    },
    [accountBalances],
  )

  // Net worth is every account this page shows. It previously reported the
  // trading account alone while the funding table listed thousands more.
  const totalNetWorth = tradingValue + fundingValue

  /* The funding table's rows, with each holding's SHARE of the account worked
     out once. A column of dollar figures tells you what a holding is worth; it
     takes mental arithmetic to learn whether it's most of your money or a
     rounding error, and that comparison is the whole reason to look at a
     portfolio. `rank` drives the colour, so the ladder reads as an ordering —
     the same ladder the Assets donut uses, so the two pages agree. */
  const fundingRows = React.useMemo(() => {
    const rows = CHAINS.map((chain) => {
      const amount = numOr(chainBalance(chain.key), 0)
      // A symbol the feed hasn't priced yet is worth an unknown amount, which
      // is not the same as zero — the row says so instead of claiming $0.00.
      const p = prices[chain.symbol]
      const priced = typeof p === "number" && Number.isFinite(p)
      return { chain, amount, usdValue: priced ? amount * p : null, priced }
    })
    const ranked = [...rows]
      .sort((a, b) => numOr(b.usdValue) - numOr(a.usdValue))
      .map((r) => r.chain.key)
    return rows.map((r) => ({
      ...r,
      pct: share(r.usdValue, fundingValue),
      rank: ranked.indexOf(r.chain.key),
    }))
  }, [chainBalance, prices, fundingValue])

  const isOnboardingDone = profile?.onboardingCompleted?.includes("portfolio")

  const copyAddr = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddr(text)
    setTimeout(() => setCopiedAddr(null), 1500)
  }

  return (
    <>
      <OnboardingFlow steps={ONBOARDING_STEPS} storageKey="portfolio" completed={isOnboardingDone} onComplete={() => markOnboardingComplete("portfolio")} />

      {/* ── Page header — title/subtitle + bare icon action (mobile grammar) ── */}
      <div data-onboarding="portfolio-header" className="mb-5 flex flex-col gap-4">
        <PageHeader
          title="Portfolio"
          subtitle="Manage your accounts, wallets & balances"
          actions={
            <IconAction
              icon={({ className }: { className?: string }) => (
                <HugeiconsIcon icon={RefreshIcon} className={`${className} ${walletsLoading ? "animate-spin" : ""}`} />
              )}
              label="Refresh"
              onClick={() => refreshWallets()}
            />
          }
        />
        {/* Net worth reads as the page's hero figure, not a right-aligned stat */}
        <div className="flex flex-col gap-1">
          <Eyebrow>Net Worth</Eyebrow>
          <Balance value={formatUSD(totalNetWorth)} className="text-[clamp(2rem,3.5vw,2.75rem)]" />
          {/* Say what the figure covers — it's the sum of the two accounts
              listed below, so the page reconciles with itself. */}
          <p className="text-[13px] text-muted-foreground">
            Trading {formatUSD(tradingValue)} · Funding {formatUSD(fundingValue)}
          </p>
        </div>
        {/* The verbs sit under the figure they act on. */}
        <PortfolioActions />
      </div>

      {/* ── 2-column layout ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
        {/* ════ LEFT — Main card ════ */}
        <div>
          <CardShell>
            {/* The subtitle IS the tab's explainer — it changes with the tab, so
                the card always says what you're looking at. */}
            <div data-onboarding="portfolio-tabs">
              <CardHeader
                title="Accounts"
                subtitle={TABS.find((t) => t.key === activeTab)?.blurb}
                right={
                  <Segmented
                    options={TABS.map(({ key, label }) => ({ key, label }))}
                    value={activeTab}
                    onChange={setActiveTab}
                  />
                }
              />
            </div>

            <div data-onboarding="portfolio-main" className="p-4 space-y-3">
              {/* ─── OVERVIEW TAB ─── */}
              {activeTab === "overview" && (
                <>
                  {/* Trading Account — sunken well, not a bordered box: the
                      system separates surfaces by fill. */}
                  <div className="rounded-2xl bg-surface-sunken/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Eyebrow>Trading Account</Eyebrow>
                      <PortfolioTradeButton />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="mb-0.5 text-[13px] text-muted-foreground">Account Value</p>
                        <p className="text-[17px] font-semibold tabular-nums">{formatUSD(tradingValue)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[13px] text-muted-foreground">Available USDC</p>
                        <p className="text-[17px] font-semibold tabular-nums text-credit">{formatUSD(availableUsdc)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[13px] text-muted-foreground">In Orders</p>
                        <p className="text-[17px] font-semibold tabular-nums">{formatUSD(inOrders)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Funding Account — the other half of net worth, so it names
                      its total instead of making the reader add up a column. */}
                  <div className="pt-1">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Eyebrow>Funding Account · Main Wallet</Eyebrow>
                      <span className="text-[13px] font-semibold tabular-nums">{formatUSD(fundingValue)}</span>
                    </div>
                    <div className="overflow-hidden rounded-2xl bg-surface-sunken/70">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                            <th className="px-3 py-2 text-left font-semibold">Asset</th>
                            <th className="hidden px-3 py-2 text-left font-semibold sm:table-cell">Chain</th>
                            <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">Share</th>
                            <th className="px-3 py-2 text-right font-semibold">Balance</th>
                            <th className="px-3 py-2 text-right font-semibold">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10">
                          {walletsLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                              <tr key={i}><td colSpan={5} className="px-3 py-2.5"><div className="h-4 w-full animate-pulse rounded bg-foreground/[0.06]" /></td></tr>
                            ))
                          ) : !walletsGenerated ? (
                            <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] text-muted-foreground">No assets found. Set up your wallet to get started.</td></tr>
                          ) : (
                            fundingRows.map(({ chain, amount, usdValue, pct, rank }) => (
                              <tr key={chain.key} className="transition-colors hover:bg-accent/30">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <CoinAvatar src={chain.icon} symbol={chain.symbol} size="sm" />
                                    <span className="flex min-w-0 flex-col leading-tight">
                                      <span className="font-semibold">{chain.symbol}</span>
                                      <span className="text-[11.5px] text-muted-foreground sm:hidden">{chain.label}</span>
                                    </span>
                                  </div>
                                </td>
                                <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">{chain.label}</td>
                                {/* Share — how much of the funding account this
                                    row is. Hidden below md, where the column
                                    would be a 30px stub. */}
                                <td className="hidden w-[34%] px-3 py-2.5 md:table-cell">
                                  <span className="flex items-center gap-2">
                                    <WeightBar pct={pct} rank={rank} className="min-w-0 flex-1" />
                                    <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-muted-foreground">
                                      {pct >= 0.1 ? `${pct.toFixed(0)}%` : "—"}
                                    </span>
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{qty(amount)}</td>
                                <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                                  {formatUSD(usdValue)}
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
                      <p className="text-[13px] text-muted-foreground">Loading wallets…</p>
                    </div>
                  ) : !walletsGenerated ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/50">
                        <HugeiconsIcon icon={Wallet01Icon} className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold">No wallets yet</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">Your multi-chain wallets appear here once set up.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Trading Wallet — hero card */}
                      <div className="rounded-2xl bg-surface-sunken/70 p-4 ring-1 ring-primary/20">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <HugeiconsIcon icon={Chart01Icon} className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold leading-tight">Trading Wallet</p>
                              <p className="text-[13px] text-muted-foreground">Where your spot orders settle</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] ${
                            tradingWallet?.address ? "bg-credit-chip text-credit" : "bg-muted text-muted-foreground"
                          }`}>
                            {tradingWallet?.address ? "Active" : "Not Set Up"}
                          </span>
                        </div>
                        {tradingWallet?.address ? (
                          <button
                            onClick={() => copyAddr(tradingWallet.address)}
                            className="group flex w-full items-center justify-between rounded-xl bg-card px-3 py-2.5 ring-1 ring-border/40 transition-colors hover:ring-primary/40"
                          >
                            <code className="font-mono text-[13px] text-foreground/80">{truncAddr(tradingWallet.address)}</code>
                            <HugeiconsIcon
                              icon={copiedAddr === tradingWallet.address ? CheckmarkCircle01Icon : Copy01Icon}
                              className={`h-3.5 w-3.5 transition-colors ${copiedAddr === tradingWallet.address ? "text-credit" : "text-muted-foreground group-hover:text-primary"}`}
                            />
                          </button>
                        ) : (
                          <div className="flex items-center justify-between rounded-lg border border-dashed border-border/40 bg-card/50 px-3 py-3">
                            <p className="text-[13px] text-muted-foreground">No trading wallet configured</p>
                            <Link href="/trade" className="rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
                              Set Up
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Chain Wallets — compact list */}
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <HugeiconsIcon icon={Shield01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                          <Eyebrow>Chain Wallets</Eyebrow>
                        </div>
                        <div className="divide-y divide-border/15 overflow-hidden rounded-2xl bg-surface-sunken/70">
                          {CHAINS.map((chain) => {
                            const addrKey = chain.key === "arbitrum" ? "ethereum" : chain.key
                            const addr = addresses?.[addrKey as keyof typeof addresses] ?? ""
                            return (
                              <div key={chain.key} className="flex items-center justify-between px-3.5 py-3 hover:bg-accent/20 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <CoinAvatar src={chain.icon} symbol={chain.symbol} size="sm" />
                                  <div>
                                    <p className="text-[13px] font-semibold">{chain.label}</p>
                                    {addr ? (
                                      <p className="font-mono text-[12px] text-muted-foreground">{truncAddr(addr)}</p>
                                    ) : (
                                      <p className="text-[12px] text-muted-foreground/60">Not generated</p>
                                    )}
                                  </div>
                                </div>
                                {addr ? (
                                  <button
                                    onClick={() => copyAddr(addr)}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
                                  >
                                    <HugeiconsIcon icon={copiedAddr === addr ? CheckmarkCircle01Icon : Copy01Icon} className={`h-3.5 w-3.5 ${copiedAddr === addr ? "text-credit" : ""}`} />
                                  </button>
                                ) : (
                                  <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10.5px] text-muted-foreground">Pending</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Unified account note */}
                      {addresses?.ethereum === tradingWallet?.address && (
                        <div className="flex items-center gap-2 rounded-xl bg-credit-chip px-3 py-2.5">
                          <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-3.5 w-3.5 text-credit shrink-0" />
                          <p className="text-[13px] text-credit">Unified account — your Ethereum wallet doubles as your trading wallet.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          </CardShell>
        </div>

        {/* ════ RIGHT — the one genuine object that isn't an account ════ */}
        <div data-onboarding="portfolio-sidebar" className="flex flex-col gap-4">
          <Watchlist coins={coins} watchlistSymbols={watchlistSymbols} onWatchlistChange={handleWatchlistChange} />
        </div>
      </div>
    </>
  )
}
