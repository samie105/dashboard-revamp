"use client"

/**
 * The dashboard hero — the redesign, on the real data.
 *
 * Every figure here comes from the hooks the previous hero already used. None
 * of it is invented and nothing new is fetched: `usePortfolioTotal` still owns
 * the arithmetic (so the navbar pill, /portfolio and this agree by
 * construction rather than by coincidence), `useAccountHistory` still owns the
 * curves, and the 24h P&L is still per-symbol maths over the same balances.
 *
 * What changed is the SHAPE. The old hero ran as a vertical stack — figure,
 * cards, actions, networks — so on a desktop the right half of the screen was
 * empty down to the fold, and the 30-day history the hook was already
 * computing had nowhere to live. This is one pane: the money on the left, the
 * same money over TIME or by COMPOSITION on the right, and the counters
 * closing it.
 *
 * Two rules are carried over verbatim because they are load-bearing:
 *
 *   · Progressive disclosure. A card is EARNED (`dashboardCards`), and a new
 *     person sees an invitation rather than three cards reading $0.00.
 *   · `settled` is not zero. A figure is withheld while its request is in
 *     flight and shown when the answer is a truthful zero — skeletons, never
 *     a placeholder that looks like data.
 */

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDownLeft01Icon,
  ArrowUpRight01Icon,
  ChartLineData01Icon,
  CoinsSwapIcon,
  DollarCircleIcon,
  EyeIcon,
  HelpCircleIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import {
  Balance,
  CardShell,
  DeltaChip,
  Eyebrow,
  Segmented,
  Skel,
  allocationColor,
} from "@/components/ui/system"
import { AreaChart, Donut, MiniSpark } from "@/components/ui/charts"
import { HERO_HUE, PANEL } from "@/components/ui/surface"
import { ErrorState } from "@/components/error-state"
import { useAuth } from "@/components/auth-provider"
import { useMoneyFlow } from "@/components/flows/money-flow-modal"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useTradeAccount } from "@/hooks/useTradeAccount"
import { useBalancePrivacy } from "@/hooks/useBalancePrivacy"
import { usePortfolioTotal } from "@/hooks/usePortfolioTotal"
import { useAccountHistory, type AccountSpec } from "@/hooks/useAccountHistory"
import { fetchPrices } from "@/lib/crypto-api"
import { openWelcomeGuide } from "@/components/welcome-guide"
import { ACCOUNT_KEYS, dashboardCards, type AccountKey, type AccountSignal } from "@/lib/dashboard-cards"
import type { CoinData } from "@/lib/actions"

const MASK = "$••••••"

function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function compactUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount)
}

function getPrice(prices: Record<string, number>, symbol: string): number {
  return prices[symbol] ?? prices[symbol.toUpperCase()] ?? prices[symbol.toLowerCase()] ?? 0
}

/** 24h P&L: each holding moved by its own 24h change. Unchanged arithmetic. */
function calculateDailyPnL(
  holdings: Record<string, number>,
  prices: Record<string, number>,
  coins: CoinData[],
): number {
  let pnl = 0
  for (const [symbol, qty] of Object.entries(holdings)) {
    if (!qty) continue
    const coin = coins.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase())
    if (!coin || !coin.change24h) continue
    const price = getPrice(prices, symbol) || coin.price
    const value = qty * price
    // `value` is POST-move, so the previous value is value / (1 + change).
    pnl += value - value / (1 + coin.change24h / 100)
  }
  return pnl
}

const ACCOUNTS: Record<AccountKey, { label: string; caption: string; href: string }> = {
  holdings: { label: "Holdings", caption: "Coins only you can move", href: "/wallet/modern" },
  spot: { label: "Spot", caption: "Moved over to buy and sell with", href: "/trade" },
  futures: { label: "Futures", caption: "Your futures trading account", href: "/trade" },
}

type View = "performance" | "allocation"
type Range = "today" | "week" | "month"

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "7D" },
  { key: "month", label: "30D" },
]

/** Greeting and date read the viewer's clock, so they resolve after mount. */
function useTodayLine(): string {
  const [line, setLine] = React.useState("")
  React.useEffect(() => {
    const now = new Date()
    const h = now.getHours()
    const greeting = h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
    const date = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now)
    setLine(`${greeting} · ${date}`)
  }, [])
  return line
}

export function DashboardHero({
  coins,
  prices,
  error,
}: {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
}) {
  const { user } = useAuth()
  const { openDoor } = useMoneyFlow()
  const { hidden, toggle: toggleHidden } = useBalancePrivacy()
  const { balances: onChainBalances } = useWalletBalances()
  const { balances: hlAccountBalances, positions: hlPositions } = useTradeAccount()
  const todayLine = useTodayLine()

  const [view, setView] = React.useState<View>("performance")
  const [range, setRange] = React.useState<Range>("month")

  /* The same 30s price feed the previous hero ran — this REPLACES it rather
     than joining it, so there is still exactly one poller on this screen. */
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
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const {
    total: totalBalance,
    onChain: onChainTotal,
    spot: spotBalance,
    futures: futuresBalance,
    futuresOpen,
    cash: cashBalance,
    chainTotals,
    onChainSettled,
    spotSettled,
    futuresSettled,
    cashSettled,
  } = usePortfolioTotal(livePrices)

  const spotTokens = React.useMemo(
    () => (hlAccountBalances?.spotTokens ?? []).filter((t) => t.total > 0),
    [hlAccountBalances],
  )

  const dailyPnL = React.useMemo(() => {
    const main: Record<string, number> = {}
    for (const b of onChainBalances) main[b.symbol] = (main[b.symbol] || 0) + b.balance
    const spot: Record<string, number> = {}
    for (const t of spotTokens) spot[t.symbol] = (spot[t.symbol] || 0) + t.total
    return calculateDailyPnL(main, livePrices, coins) + calculateDailyPnL(spot, livePrices, coins)
  }, [onChainBalances, spotTokens, livePrices, coins])

  const accountBalances: Record<AccountKey, number> = {
    holdings: onChainTotal,
    spot: spotBalance,
    futures: futuresBalance,
  }

  const accountSignals: Record<AccountKey, AccountSignal> = {
    holdings: { open: true, settled: onChainSettled, used: onChainBalances.length > 0 || onChainTotal > 0 },
    spot: { open: true, settled: spotSettled, used: spotTokens.length > 0 || spotBalance > 0 },
    futures: { open: futuresOpen, settled: futuresSettled, used: futuresBalance > 0 || hlPositions.length > 0 },
  }
  /* A three-state union, not a list. Cards appear AS THEY SETTLE — someone
     whose wallet has loaded and whose spot ledger has not sees Holdings now
     and Spot a moment later, because the alternative is holding a card they
     have earned hostage to a request they cannot see. */
  const cards = dashboardCards(accountSignals)
  const openAccountCount = ACCOUNT_KEYS.filter((k) => accountSignals[k].open).length
  /* Counters are a different question from cards: these two figures are sums
     over holdings, so they wait for the two accounts that feed them. */
  const countsSettled = onChainSettled && spotSettled

  // ── 30-day history. Same specs as before, so the curve and the percentages
  //    describe the same pile of money as the figure above them.
  const accountSpecs: AccountSpec[] = React.useMemo(() => {
    const main: Record<string, number> = {}
    for (const b of onChainBalances) main[b.symbol] = (main[b.symbol] || 0) + b.balance
    const spot: Record<string, number> = {}
    for (const t of spotTokens) spot[t.symbol] = (spot[t.symbol] || 0) + t.total
    const futures: Record<string, number> = {}
    for (const p of hlPositions) futures[p.symbol] = (futures[p.symbol] || 0) + p.size
    return [
      { key: "holdings", balance: onChainTotal, holdings: main },
      { key: "spot", balance: spotBalance, holdings: spot },
      { key: "futures", balance: futuresOpen ? futuresBalance : 0, holdings: futuresOpen ? futures : {} },
    ]
  }, [onChainBalances, spotTokens, hlPositions, onChainTotal, spotBalance, futuresBalance, futuresOpen])

  const { sparkSeries, totalSeries, changes } = useAccountHistory(accountSpecs)
  const rangeChange = changes[range]

  /* An empty account produces a series of zeroes, and a zero series drew a
     flat gold line across an axis reading "$0" — a chart of nothing, styled
     as a chart of something. There has to be a value in it before it is
     worth drawing. */
  const hasHistory = Boolean(totalSeries && totalSeries.length > 1 && totalSeries.some((v) => v > 0))

  /* Composition — built from the SAME holdings the total is made of, valued
     at the same live prices. Ranked, because the donut's palette is an
     ordinal ladder: colour encodes rank, not identity. */
  const allocation = React.useMemo(() => {
    const bySymbol = new Map<string, number>()
    const add = (symbol: string, value: number) => {
      if (!(value > 0)) return
      bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + value)
    }
    for (const b of onChainBalances) add(b.symbol, b.balance * getPrice(livePrices, b.symbol))
    for (const t of spotTokens) add(t.symbol, t.total * getPrice(livePrices, t.symbol))

    const ranked = [...bySymbol.entries()]
      .map(([symbol, value]) => ({ symbol, value }))
      .sort((a, b) => b.value - a.value)
    const top = ranked.slice(0, 5)
    const rest = ranked.slice(5).reduce((s, r) => s + r.value, 0)
    const slices = rest > 0 ? [...top, { symbol: "Other", value: rest }] : top
    const total = ranked.reduce((s, r) => s + r.value, 0)
    return { slices, total, count: ranked.length }
  }, [onChainBalances, spotTokens, livePrices])

  const activeAssetCount = onChainBalances.filter((b) => b.balance > 0).length + spotTokens.length
  const activeNetworks = Object.values(chainTotals ?? {}).filter((v) => v > 0).length

  if (error) {
    return (
      <CardShell className={HERO_HUE}>
        <ErrorState message={error} />
      </CardShell>
    )
  }

  const name = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Trader" : "Trader"

  const counters: { key: string; label: string; value: React.ReactNode; hint: string }[] = [
    {
      key: "assets",
      label: "Assets",
      value: countsSettled ? activeAssetCount : <Skel className="h-5 w-8" />,
      hint: activeAssetCount === 1 ? "coin held" : "coins held",
    },
    {
      key: "networks",
      label: "Networks",
      value: countsSettled ? activeNetworks : <Skel className="h-5 w-8" />,
      hint: activeNetworks === 1 ? "chain with a balance" : "chains with a balance",
    },
    {
      key: "positions",
      label: "Open positions",
      value: futuresSettled ? hlPositions.length : <Skel className="h-5 w-8" />,
      hint: futuresOpen ? "on the futures venue" : "futures is closed",
    },
    {
      key: "cash",
      label: "Dollar account",
      value: cashSettled ? compactUSD(cashBalance) : <Skel className="h-5 w-14" />,
      hint: "Held separately",
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <CardShell className={HERO_HUE}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* ── Left: who, and how much ─────────────────────────────────── */}
          <div className="flex flex-col gap-5 p-5 lg:p-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">
                {name}
              </h1>
              {/* Reserved height so the client-resolved line does not nudge
                  the figure when it lands. */}
              <p className="min-h-[18px] text-[13px] text-muted-foreground">{todayLine || " "}</p>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="flex items-center gap-2">
                {/* "crypto", not "balance". Two balances exist in a
                    Worldstreet life — this one and the Dollar Account — and
                    naming this one is what lets them be told apart. */}
                <Eyebrow>Total crypto balance</Eyebrow>
                {/* ws-icon-mono while SHOWN: globals paints the inner path of
                    every 24px icon gold, so without the opt-out this eye is
                    gold in both states and the one thing it exists to report
                    cannot be read off it. */}
                <button
                  type="button"
                  onClick={toggleHidden}
                  aria-label={hidden ? "Show balances" : "Hide balances"}
                  aria-pressed={hidden}
                  className={cn(
                    "-m-2 p-2 transition-colors",
                    hidden ? "text-primary" : "ws-icon-mono text-muted-foreground/60 hover:text-foreground",
                  )}
                >
                  <HugeiconsIcon icon={EyeIcon} className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  onClick={openWelcomeGuide}
                  data-vivid-target="open-welcome-guide"
                  data-vivid-label="Open the guide to Worldstreet"
                  className="ws-icon-mono ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-card/70 px-2.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border/40 transition-colors hover:bg-accent hover:text-foreground"
                >
                  <HugeiconsIcon icon={HelpCircleIcon} className="h-3.5 w-3.5" />
                  How this works
                </button>
              </span>

              <Balance
                value={formatUSD(totalBalance)}
                hidden={hidden}
                mask={MASK}
                className="font-medium text-[clamp(2.25rem,9vw,3.25rem)] sm:text-[clamp(2.5rem,4.4vw,3.75rem)]"
              />

              {/* The row exists only when there is a figure in it. With no
                  history and no movement the old arrangement left the word
                  "today" sitting on its own under the balance. */}
              {(changes.today !== null || (dailyPnL !== 0 && !hidden)) && (
                <span className="flex flex-wrap items-center gap-2">
                  {changes.today !== null && <DeltaChip value={changes.today} />}
                  {dailyPnL !== 0 && !hidden && (
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular-nums",
                        dailyPnL >= 0 ? "text-credit" : "text-debit",
                      )}
                    >
                      {dailyPnL >= 0 ? "+" : "−"}
                      {formatUSD(Math.abs(dailyPnL))}
                    </span>
                  )}
                  <span className="text-[13px] text-muted-foreground">today</span>
                </span>
              )}

              {/* The Dollar Account: a different product, so it sits beside
                  the crypto figure rather than inside it. Held back until
                  settled so a real $0.00 is never a request in flight. */}
              {cashSettled && (
                <Link
                  href="https://www.worldstreetgold.com"
                  className="ws-icon-mono inline-flex w-fit items-center gap-2 rounded-full bg-card/60 px-2.5 py-1.5 text-[12px] ring-1 ring-border/40 transition-colors hover:bg-accent"
                >
                  <HugeiconsIcon icon={DollarCircleIcon} className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Dollar Account</span>
                  <span className="font-semibold tabular-nums">
                    {hidden ? "••••" : formatUSD(cashBalance)}
                  </span>
                </Link>
              )}
            </div>

            {/* ── Accounts. Earned, not assumed. ─────────────────────────── */}
            {cards.status === "loading" ? (
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/40">
                {Array.from({ length: Math.min(2, openAccountCount) }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2 bg-card/40 px-3 py-3">
                    <Skel className="h-2.5 w-14" />
                    <Skel className="h-4 w-20" />
                    <Skel className="h-2.5 w-24" />
                  </div>
                ))}
              </div>
            ) : cards.status === "ready" ? (
              <div
                className={cn(
                  "grid gap-px overflow-hidden rounded-xl bg-border/40",
                  cards.accounts.length === 1
                    ? "grid-cols-1"
                    : cards.accounts.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3",
                )}
              >
                {cards.accounts.map((key) => {
                  const meta = ACCOUNTS[key]
                  const series = sparkSeries[key]
                  return (
                    <Link
                      key={key}
                      href={meta.href}
                      className="flex flex-col gap-1.5 bg-card/40 px-3 py-3 transition-colors hover:bg-accent/40"
                    >
                      <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                        {meta.label}
                      </span>
                      <span className="truncate text-[15px] font-semibold tabular-nums">
                        {hidden ? "••••" : formatUSD(accountBalances[key])}
                      </span>
                      {series && series.length > 1 && (
                        <MiniSpark points={series} tone="brand" width={64} height={18} className="w-full" />
                      )}
                      <span className="truncate text-[11px] text-muted-foreground">{meta.caption}</span>
                    </Link>
                  )
                })}
              </div>
            ) : (
              /* The invitation. Three cards reading $0.00 tell a new person
                 the product is empty and they are already behind. */
              <div className={cn("flex flex-col items-start gap-2 rounded-xl p-4", PANEL)}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/[0.12]">
                  <HugeiconsIcon icon={Wallet01Icon} className="h-[18px] w-[18px] text-primary" />
                </span>
                <span className="text-[14px] font-semibold">Your accounts will show up here</span>
                <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Buy your first coin, or have someone send you one. It lands in your holdings and this is
                  where you will see what it is worth.
                </span>
                <Link
                  href="/buy"
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Buy a coin
                </Link>
              </div>
            )}
          </div>

          {/* ── Right: the same money over time, or by composition ───────── */}
          <div className="flex min-w-0 flex-col gap-4 border-t border-border/40 p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Segmented
                size="sm"
                options={[
                  { key: "performance", label: "Performance" },
                  { key: "allocation", label: "Allocation" },
                ]}
                value={view}
                onChange={(k) => setView(k as View)}
              />
              {view === "performance" && (
                <Segmented
                  size="sm"
                  options={RANGES}
                  value={range}
                  onChange={(k) => setRange(k as Range)}
                />
              )}
            </div>

            {view === "performance" ? (
              hasHistory ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Eyebrow>{RANGES.find((r) => r.key === range)?.label} change</Eyebrow>
                    {rangeChange === null ? (
                      <span className="text-[13px] text-muted-foreground">Not enough history yet</span>
                    ) : (
                      <DeltaChip value={rangeChange} />
                    )}
                  </div>
                  <AreaChart
                    points={totalSeries}
                    format={(v) => (hidden ? "••••" : compactUSD(v))}
                    height={196}
                    className="mt-1"
                  />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>30 days ago</span>
                    <span>Now</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                  <span className="text-[14px] font-semibold">No history yet</span>
                  <span className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
                    Your balance over time appears here once there is a day of it to draw.
                  </span>
                </div>
              )
            ) : allocation.slices.length > 0 ? (
              <div className="flex flex-1 flex-wrap items-center justify-center gap-6 py-2 sm:justify-start sm:gap-8">
                <Donut
                  slices={allocation.slices.map((s) => ({ label: s.symbol, value: s.value }))}
                  size={148}
                  thickness={15}
                >
                  <span className="text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
                    Assets
                  </span>
                  <span className="font-display text-[22px] font-light tabular-nums">
                    {allocation.count}
                  </span>
                </Donut>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {allocation.slices.map((s, i) => (
                    <span key={s.symbol} className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: allocationColor(i) }}
                      />
                      <span className="w-14 shrink-0 truncate text-[13px] font-medium">{s.symbol}</span>
                      <span className="flex-1 text-right text-[13px] tabular-nums text-muted-foreground">
                        {hidden ? "••••" : compactUSD(s.value)}
                      </span>
                      <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">
                        {((s.value / (allocation.total || 1)) * 100).toFixed(1)}%
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                <span className="text-[14px] font-semibold">Nothing to break down yet</span>
                <span className="max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
                  Once you hold a coin, this shows what share of your balance each one is.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Counters ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-px border-t border-border/40 bg-border/40 2xl:grid-cols-4">
          {counters.map((c) => (
            <div key={c.key} className="flex flex-col gap-1 bg-card/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.07em] text-muted-foreground">
                  {c.label}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground/70">{c.hint}</span>
              </div>
              <span className="shrink-0 font-display text-[20px] font-medium tabular-nums">{c.value}</span>
            </div>
          ))}
        </div>
      </CardShell>

      {/* ── Action rail ──────────────────────────────────────────────────── */}
      <div className="scrollbar-none -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        <RailButton
          icon={ArrowDownLeft01Icon}
          label="Deposit"
          onClick={() => openDoor("deposit")}
          vivid="open-deposit"
          vividLabel="Ask where the money is coming from, then deposit"
        />
        <RailButton
          icon={ArrowUpRight01Icon}
          label="Withdraw"
          onClick={() => openDoor("withdraw")}
          vivid="open-withdraw"
          vividLabel="Send crypto out of your wallet"
        />
        <RailButton icon={CoinsSwapIcon} label="Swap" href="/swap" vivid="go-swap" vividLabel="Go to the swap page" />
        <RailButton
          icon={ChartLineData01Icon}
          label="Trade"
          href="/trade"
          vivid="go-trade"
          vividLabel="Go to the trading workspace"
        />
      </div>
    </div>
  )
}

function RailButton({
  icon,
  label,
  href,
  onClick,
  vivid,
  vividLabel,
}: {
  icon: typeof Wallet01Icon
  label: string
  href?: string
  onClick?: () => void
  vivid: string
  vividLabel: string
}) {
  const cls =
    "ws-card-glass flex shrink-0 items-center gap-2.5 rounded-full bg-card/40 py-2 pl-2 pr-4 ring-1 ring-border/40 transition-all hover:bg-accent/70 active:scale-[0.96] motion-reduce:active:scale-100"
  const inner = (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/[0.12]">
        <HugeiconsIcon icon={icon} className="h-4 w-4 text-primary" />
      </span>
      <span className="text-[14px] font-semibold">{label}</span>
    </>
  )
  return href ? (
    <Link href={href} className={cls} data-vivid-target={vivid} data-vivid-label={vividLabel}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} data-vivid-target={vivid} data-vivid-label={vividLabel}>
      {inner}
    </button>
  )
}
