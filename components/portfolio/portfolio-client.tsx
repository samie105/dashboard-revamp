"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Chart01Icon,
  Search01Icon,
  Exchange01Icon,
  RefreshIcon,
  ArrowRight01Icon,
  StarIcon,
  Cancel01Icon,
  Add01Icon,
  ArrowUpRight01Icon,
  ArrowDownLeft01Icon,
} from "@hugeicons/core-free-icons"
import {
  ActionPill,
  Balance,
  CardHeader,
  CardShell,
  Eyebrow,
  allocationColor,
  IconAction,
  PageHeader,
  Segmented,
  Skel,
  Sparkline,
} from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { numOr, pctSigned, price, qty, share, usd } from "@/lib/num"
import { useSparklines } from "@/hooks/useSparklines"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { usePortfolioTotal } from "@/hooks/usePortfolioTotal"
import { useProfile } from "@/components/profile-provider"
import { markOnboardingComplete } from "@/lib/profile-actions"
import { OnboardingFlow, type OnboardingStep } from "@/components/onboarding-flow"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CoinData } from "@/lib/actions"

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

function formatPrice(value: unknown) {
  return price(value)
}

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
  const { profile, updateProfile } = useProfile()
  const [activeTab, setActiveTab] = React.useState<Tab>("overview")
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

  /* The new wallet architecture, and only it.
     This page read three legacy sources at once: `getUserBalances` (the Privy
     ledger), `getSpotBalances`/`getSpotPositions` (the Hyperliquid trading
     account), and `useWallet` for addresses. None of them is where the money
     is any more, so a funded self-custodial wallet reported a net worth of
     zero across two accounts that no longer exist.

     `usePortfolioTotal` is the same arithmetic the navbar and the dashboard
     hero read, so all three agree by construction rather than by coincidence. */
  const { balances: walletBalances, isLoading: balancesLoading, refetch: refreshBalances } =
    useWalletBalances()
  const { total: totalNetWorth, onChain, futures, cash } = usePortfolioTotal(prices)

  /* Holdings with each one's SHARE worked out once.
     A column of dollar figures says what a holding is worth; it takes mental
     arithmetic to learn whether it is most of your money or a rounding error,
     and that comparison is the whole reason to open a portfolio. */
  const holdings = React.useMemo(() => {
    const rows = walletBalances
      .filter((balance) => balance.balance > 0)
      .map((balance) => {
        const symbol = balance.symbol.toUpperCase()
        const feed = prices[symbol] ?? prices[balance.symbol]
        // A symbol the feed hasn't priced is worth an unknown amount, which is
        // not zero — the row says so rather than claiming $0.00.
        const priced =
          typeof feed === "number" && Number.isFinite(feed) && feed > 0
            ? feed
            : symbol === "USDC" || symbol === "USDT"
              ? 1
              : null
        return {
          ...balance,
          usdValue: priced === null ? null : balance.balance * priced,
        }
      })
    return rows
      .sort((a, b) => numOr(b.usdValue) - numOr(a.usdValue))
      .map((row, index) => ({ ...row, pct: share(row.usdValue, onChain), rank: index }))
  }, [walletBalances, prices, onChain])

  const isOnboardingDone = profile?.onboardingCompleted?.includes("portfolio")

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
                <HugeiconsIcon icon={RefreshIcon} className={`${className} ${balancesLoading ? "animate-spin" : ""}`} />
              )}
              label="Refresh"
              onClick={() => void refreshBalances()}
            />
          }
        />
        {/* Net worth reads as the page's hero figure, not a right-aligned stat */}
        <div className="flex flex-col gap-1">
          <Eyebrow>Net Worth</Eyebrow>
          <Balance value={formatUSD(totalNetWorth)} className="text-[clamp(2rem,3.5vw,2.75rem)]" />
          {/* Say what the figure covers, so the page reconciles with itself.
              The accounts named are the ones that exist: the self-custodial
              wallet, the perps account, and the Dollar Account. "Trading" and
              "Funding" described a split that no longer does. */}
          <p className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
            <span>Wallet {formatUSD(onChain)}</span>
            {futures > 0 && <span>· Perps {formatUSD(futures)}</span>}
            {cash > 0 && <span>· Cash {formatUSD(cash)}</span>}
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
                      <Eyebrow>Accounts</Eyebrow>
                      <PortfolioTradeButton />
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="mb-0.5 text-[13px] text-muted-foreground">Wallet</p>
                        <p className="text-[17px] font-semibold tabular-nums">{formatUSD(onChain)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[13px] text-muted-foreground">Perps</p>
                        <p className="text-[17px] font-semibold tabular-nums">{formatUSD(futures)}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[13px] text-muted-foreground">Cash</p>
                        <p className="text-[17px] font-semibold tabular-nums">{formatUSD(cash)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Holdings — every token the wallet actually holds, biggest
                      first, with its share of the wallet drawn rather than left
                      as arithmetic. A table on a desktop; stacked rows on a
                      phone, because five columns at 375px is a horizontal
                      scrollbar pretending to be a layout. */}
                  <div className="pt-1">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Eyebrow>Holdings</Eyebrow>
                      <span className="text-[13px] font-semibold tabular-nums">{formatUSD(onChain)}</span>
                    </div>

                    {balancesLoading && holdings.length === 0 ? (
                      <div className="rounded-2xl bg-surface-sunken/70 px-4 py-10 text-center text-[13px] text-muted-foreground">
                        Loading your holdings…
                      </div>
                    ) : holdings.length === 0 ? (
                      <div className="rounded-2xl bg-surface-sunken/70 px-4 py-10 text-center">
                        <p className="text-[13px] text-muted-foreground">
                          Nothing in this wallet yet.
                        </p>
                        <Link
                          href="/wallet/modern"
                          className="mt-2 inline-block text-[13px] font-semibold text-primary hover:underline"
                        >
                          Deposit to get started
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-2xl bg-surface-sunken/70">
                        {/* Phone: one row per holding, two lines. */}
                        <div className="flex flex-col divide-y divide-border/20 sm:hidden">
                          {holdings.map((row) => (
                            <div
                              key={`${row.chain}-${row.symbol}-${row.contractAddress ?? "native"}`}
                              className="flex items-center gap-3 px-3 py-3"
                            >
                              <CoinAvatar symbol={row.symbol} src={row.logo} size="sm" />
                              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                <span className="truncate text-[13.5px] font-semibold">{row.symbol}</span>
                                <span className="truncate text-[11.5px] text-muted-foreground">
                                  {row.networkName ?? row.chain} · {row.pct}
                                </span>
                              </span>
                              <span className="flex shrink-0 flex-col items-end leading-tight">
                                <span className="text-[13.5px] font-semibold tabular-nums">
                                  {row.usdValue === null ? "—" : formatUSD(row.usdValue)}
                                </span>
                                <span className="text-[11.5px] tabular-nums text-muted-foreground">
                                  {qty(row.balance)}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>

                        <table className="hidden w-full text-[13px] sm:table">
                          <thead>
                            <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground/70">
                              <th className="px-3 py-2 text-left font-semibold">Asset</th>
                              <th className="px-3 py-2 text-left font-semibold">Chain</th>
                              <th className="hidden px-3 py-2 text-left font-semibold md:table-cell">Share</th>
                              <th className="px-3 py-2 text-right font-semibold">Balance</th>
                              <th className="px-3 py-2 text-right font-semibold">Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/20">
                            {holdings.map((row) => (
                              <tr
                                key={`${row.chain}-${row.symbol}-${row.contractAddress ?? "native"}`}
                                className="transition-colors hover:bg-accent/30"
                              >
                                <td className="px-3 py-2.5">
                                  <span className="flex items-center gap-2">
                                    <CoinAvatar symbol={row.symbol} src={row.logo} size="sm" />
                                    <span className="font-semibold">{row.symbol}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-muted-foreground">
                                  {row.networkName ?? row.chain}
                                </td>
                                <td className="hidden px-3 py-2.5 md:table-cell">
                                  <span className="flex items-center gap-2">
                                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-foreground/[0.07]">
                                      <span
                                        className="block h-full rounded-full"
                                        style={{ width: row.pct, background: allocationColor(row.rank) }}
                                      />
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">{row.pct}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right tabular-nums">{qty(row.balance)}</td>
                                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                  {/* Unknown price is an em-dash, never $0.00
                                      beside a real balance. */}
                                  {row.usdValue === null ? "—" : formatUSD(row.usdValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
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
