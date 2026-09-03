"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
} from "@hugeicons/core-free-icons"
import type { CoinData } from "@/lib/actions"
import { getPrices } from "@/lib/actions"

// Market rows for the Spot tab — the service's price feed with the display
// fields the old spotv2 pair registry carried.
import { ErrorState } from "@/components/error-state"
import {
  CardHeader,
  CardShell,
  ChangeText,
  EmptyState as SystemEmptyState,
  Eyebrow,
  SkeletonRows,
  type IllustrationKey,
} from "@/components/ui/system"
import { fetchProfile } from "@/lib/profile-actions"
import { SwapClient } from "@/components/swap/swap-client"
import { ActivityCard } from "@/components/dashboard/activity-card"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useWalletBalances } from "@/hooks/useWalletBalances"
import { useSpotRegistry, tradeHref } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { chainLabel } from "@/lib/spot-market-search"
import { CoinAvatar } from "@/components/ui/coin-avatar"
// TEMPORARILY OFF — see the parked block below.
// import { WorldstreetTokenCard } from "@/components/dashboard/worldstreet-token-card"


/* ── TEMPORARY: the futures venue is not open ───────────────────────────
   Perpetual futures are not live on the platform yet. Every futures surface in
   this file stays VISIBLE and stays PRESSABLE — the tabs are built, people have
   already found them, and the feature is coming. Selecting one is how you find
   out: its panel is the ComingSoon message instead of the futures UI, so a tap
   explains itself where there is no hover to carry a tooltip. What the gate does
   remove is every link into /trade?market=futures — a tab that explains itself
   is not the same thing as a button into a venue that cannot take an order.
   Flip this one constant to `true` when the venue opens; nothing else in this
   file needs unwinding.

   The `: boolean` annotation is load-bearing. Without it TS narrows the type to
   the literal `false`, and every `tab === "Futures"` / `view === "positions"`
   comparison below becomes a "comparison appears unintentional" error. */

/**
 * Markets — spot, and only spot.
 *
 * It carried Spot / Futures / Total tabs over a price FEED: rows with no
 * chain, no token address and no route, whose "Trade" link was a symbol
 * lookup that landed on whatever pair the workspace defaulted to. Futures is
 * closed, so one of the three tabs could never do anything.
 *
 * This is the tradable registry instead — the same rows the trade workspace
 * lists, already filtered to what can be routed — so every row here is a
 * market you can actually open, on a named chain, by id rather than by symbol.
 */
function MarketsTable() {
  const [search, setSearch] = React.useState("")
  const [visibleCount, setVisibleCount] = React.useState(6)
  const registry = useSpotRegistry()

  const markets = React.useMemo(() => {
    const rows = [...registry.bySymbol.values()].flat()
    const query = search.trim().toLowerCase()
    /* Registry order is kept, because it is now MEANINGFUL: the backend ranks
       by the depth behind each market and excludes anything with no price. Any
       sort here would throw that away and put the alphabet back. */
    return query ? rows.filter((row) => row.symbol.toLowerCase().includes(query)) : rows
  }, [registry, search])

  React.useEffect(() => {
    setVisibleCount(6)
  }, [search])

  const shown = markets.slice(0, visibleCount)
  const remaining = markets.length - shown.length

  return (
    <CardShell data-onboarding="dash-markets">
      <CardHeader
        title="Markets"
        subtitle="Live prices"
        className="pb-2"
        right={
          <div className="relative shrink-0">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-36 rounded-full bg-surface-sunken py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:bg-accent"
            />
          </div>
        }
      />

      {registry.loading && markets.length === 0 ? (
        <SkeletonRows rows={5} label="Loading markets" />
      ) : markets.length === 0 ? (
        <EmptyState
          illustration="cryptoTrade"
          title={search ? "No markets match" : "Markets unavailable"}
          description={
            search
              ? "Try a different symbol."
              : "The market list isn't loading right now — your balances are unaffected."
          }
        />
      ) : (
        <>
          <div className="flex flex-1 flex-col divide-y divide-border/20 px-1">
            {shown.map((market) => (
              <Link
                key={market.id}
                href={tradeHref(market)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40"
              >
                <CoinAvatar symbol={market.symbol} src={market.icon} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[13.5px] font-medium">{market.symbol}</span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {chainLabel(market.networkId)} · {market.quote}
                  </span>
                </span>
                <span className="shrink-0 text-[13.5px] font-semibold tabular-nums">
                  {market.price > 0
                    ? `$${market.price.toLocaleString(undefined, {
                        maximumFractionDigits: market.price < 1 ? 6 : 2,
                      })}`
                    : "—"}
                </span>
              </Link>
            ))}
          </div>
          {remaining > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + 10)}
              className="mx-3 mb-2 rounded-lg bg-surface-sunken py-2 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Show more · {remaining.toLocaleString()} left
            </button>
          )}
        </>
      )}
    </CardShell>
  )
}

/* ========== Recent Trades ========== */
/**
 * The trades you have actually made — the same ledger the trade workspace's
 * Orders table reads.
 *
 * It called `getSpotTradeHistory`, which asks `/api/transactions/unified` for
 * `type=swap`. That endpoint does not exist on the crypto backend, so the card
 * showed "No spot trades yet" to users with a page of fills. It also carried a
 * Futures tab that could never have rows, because the venue serves no fill
 * history — two tabs, one impossible, neither populated.
 */
function RecentTrades() {
  const { records, loading } = useLedgerRecords()
  const registry = useSpotRegistry()
  const [now, setNow] = React.useState(() => Date.now())

  /* "2m ago" needs a now to measure against, and reading the clock during
     render makes the output non-idempotent — two renders in the same tick can
     disagree. The clock is state, ticking at the resolution these labels have. */
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const trades = React.useMemo(
    () =>
      records
        .map((record) => describeLedgerRecord(record, registry))
        .filter((row): row is LedgerRow => row !== null && row.kind === "trade")
        .slice(0, 5),
    [records, registry],
  )

  function since(iso: string | null) {
    if (!iso) return ""
    const diff = now - new Date(iso).getTime()
    if (!Number.isFinite(diff)) return ""
    if (diff < 60_000) return "Just now"
    const min = Math.floor(diff / 60_000)
    if (min < 60) return `${min}m ago`
    const hrs = Math.floor(min / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <CardShell data-onboarding="dash-trades">
      <CardHeader
        title="Recent Trades"
        subtitle="Your latest fills"
        link={{ label: "View all", href: "/trade" }}
      />
      {loading && records.length === 0 ? (
        <SkeletonRows rows={4} label="Loading trades" />
      ) : trades.length === 0 ? (
        <EmptyState
          illustration="noTransactions"
          title="No trades yet"
          description="Buy or sell anything and it lands here."
          cta={{ label: "Start trading", href: "/trade" }}
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/20 px-1 pb-2">
          {trades.map((trade) => {
            const buy = trade.direction === "in"
            const explorer = trade.txHash ? explorerTxUrl(trade.networkId, trade.txHash) : null
            const body = (
              <>
                <CoinAvatar symbol={trade.symbol} src={trade.icon} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-medium">{trade.symbol}</span>
                    <span
                      className={`text-[10px] font-bold uppercase ${buy ? "text-credit" : "text-debit"}`}
                    >
                      {buy ? "Buy" : "Sell"}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {chainLabel(trade.networkId)} · {since(trade.createdAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  {trade.amountText && (
                    <span className="text-[13.5px] font-semibold tabular-nums">
                      {trade.amountText}
                    </span>
                  )}
                  {trade.valueUsd !== null && (
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      ${trade.valueUsd.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: trade.valueUsd < 1 ? 4 : 2,
                      })}
                    </span>
                  )}
                </span>
              </>
            )
            const className =
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40"
            return explorer ? (
              <a
                key={trade.id}
                href={explorer}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {body}
              </a>
            ) : (
              <div key={trade.id} className={className}>
                {body}
              </div>
            )
          })}
        </div>
      )}
    </CardShell>
  )
}

/* ========== Watchlist ========== */
function Watchlist({ coins, error }: { coins: CoinData[]; error?: string }) {
  const [watchlistSymbols, setWatchlistSymbols] = React.useState<string[] | null>(null)

  React.useEffect(() => {
    fetchProfile()
      .then((result) => {
        if (result.success && result.profile) {
          setWatchlistSymbols(result.profile.watchlist ?? [])
        } else {
          setWatchlistSymbols([])
        }
      })
      .catch(() => setWatchlistSymbols([]))
  }, [])

  const items = React.useMemo(() => {
    if (watchlistSymbols === null) return null
    if (watchlistSymbols.length === 0) return []
    return coins.filter((c) => watchlistSymbols.includes(c.symbol)).slice(0, 10)
  }, [coins, watchlistSymbols])

  return (
    <CardShell data-onboarding="dash-watchlist">
      <CardHeader
        title="Watchlist"
        subtitle="Starred assets"
        link={{ label: "View all", href: "/trade" }}
      />
      {items === null ? (
        <SkeletonRows rows={6} label="Loading watchlist" />
      ) : error && items.length === 0 ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          illustration="cryptoBuy"
          title="No favorites yet"
          description="Star assets on the Spot page to build your watchlist"
          cta={{ label: "Browse markets", href: "/trade" }}
        />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border/30">
          {items.map((coin) => (
            <div key={coin.symbol} className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30">
              {coin.image ? (
                <img src={coin.image} alt={coin.symbol} className="h-5 w-5 rounded-full" />
              ) : (
                <span className="text-xs font-bold text-primary">{coin.symbol.slice(0, 2)}</span>
              )}
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-medium">{coin.symbol}</span>
                <span className="text-xs text-muted-foreground">{coin.name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">
                  ${coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {coin.change24h !== 0 && <ChangeText value={coin.change24h} className="text-xs" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
  )
}

/* ========== Empty State — the mobile illustration + outlined gold CTA ====== */
function EmptyState({
  illustration = "noCrypto",
  title,
  description,
  cta,
}: {
  illustration?: IllustrationKey
  title: string
  description: string
  cta?: { label: string; href: string }
}) {
  return (
    <SystemEmptyState
      illustration={illustration}
      title={title}
      description={description}
      ctas={cta ? [cta] : []}
    />
  )
}

/* ========== My Positions ========== */
/**
 * What you hold — the wallet's assets, which is what the subtitle always
 * claimed and never showed.
 *
 * It read the Hyperliquid trading account through the spot ledger adapter, so
 * a wallet full of tokens across three chains reported "No spot holdings".
 * The card says "Everything you hold, across every chain"; this is that, from
 * the same balance source the wallet page's assets section uses.
 */
function MyPositions() {
  const { balances, isLoading } = useWalletBalances()
  const [prices, setPrices] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    let cancelled = false
    const load = () =>
      getPrices()
        .then((result) => {
          if (!cancelled) setPrices(result.prices)
        })
        .catch(() => {})
    void load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const holdings = React.useMemo(() => {
    const priced = balances
      .filter((balance) => balance.balance > 0)
      .map((balance) => {
        const price =
          prices[balance.symbol] ??
          prices[balance.symbol.toUpperCase()] ??
          (balance.symbol === "USDC" || balance.symbol === "USDT" ? 1 : 0)
        return { ...balance, value: balance.balance * price }
      })
    // Biggest first: a holdings list read top-down should answer "what am I
    // mostly holding?" before anything else.
    return priced.sort((a, b) => b.value - a.value)
  }, [balances, prices])

  const total = holdings.reduce((sum, holding) => sum + holding.value, 0)
  const shown = holdings.slice(0, 5)

  return (
    <CardShell>
      <CardHeader
        className="flex-wrap"
        title="My Holdings"
        subtitle="Everything you hold, across every chain"
        link={{ label: "View all", href: "/assets" }}
      />

      {isLoading && holdings.length === 0 ? (
        <SkeletonRows rows={4} label="Loading holdings" />
      ) : holdings.length === 0 ? (
        <EmptyState
          illustration="noCrypto"
          title="Nothing here yet"
          description="Deposit into your wallet and your assets appear here."
          cta={{ label: "Go to wallet", href: "/wallet/modern" }}
        />
      ) : (
        <>
          <div className="flex flex-1 flex-col divide-y divide-border/20 px-1">
            {shown.map((holding) => (
              <div
                key={`${holding.chain}-${holding.symbol}-${holding.contractAddress ?? "native"}`}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <CoinAvatar symbol={holding.symbol} src={holding.logo} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[13.5px] font-medium">{holding.symbol}</span>
                  <span className="truncate text-[12px] text-muted-foreground">
                    {holding.networkName ?? holding.chain}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  <span className="text-[13.5px] font-semibold tabular-nums">
                    {holding.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </span>
                  {/* A token with no price shows its amount and nothing else,
                      rather than a confident $0.00 beside a real balance. */}
                  {holding.value > 0 && (
                    <span className="text-[11.5px] tabular-nums text-muted-foreground">
                      ${holding.value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
            <span className="text-[12px] text-muted-foreground">
              {holdings.length} {holdings.length === 1 ? "asset" : "assets"}
            </span>
            <span className="text-[13px] font-semibold tabular-nums">
              ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </>
      )}
    </CardShell>
  )
}

/* ========== Dashboard Grid ========== */
interface DashboardGridProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
}

export function DashboardGrid({ coins, prices, error }: DashboardGridProps) {
  // Information architecture: three paired rows, ownership first.
  // Row 1 — your money in motion: activity beside everything you hold.
  // Row 2 — the market: the screener beside what you starred.
  // Row 3 — acting on it: your fills beside the swap desk.
  // Each row is its own grid so partners stretch to equal height.
  // Each card carries its own `rise` delay, stepping down the page in reading
  // order — the grid assembles card by card instead of landing as one slab.
  // (This plays when the streamed data mounts, after the skeleton, so it also
  // marks the moment the numbers became real.)
  const cell = (delay: number): React.CSSProperties =>
    ({ "--rise-delay": `${delay}ms` }) as React.CSSProperties
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-2" style={cell(0)}>
          <ActivityCard />
        </div>
        <div className="rise min-w-0 lg:col-span-3" style={cell(70)}>
          <MyPositions />
        </div>
      </div>

      {/* Wayfinding — the page's one break: "your money" above this line,
          "the market" below it. */}
      <div className="rise flex items-center gap-3 pt-1" style={cell(140)}>
        <Eyebrow>Markets &amp; trading</Eyebrow>
        <div className="h-px flex-1 bg-border/60" />
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-3" style={cell(180)}>
          <MarketsTable />
        </div>
        {/* Right column carries two cards: the user's stars, then the house
            token — the screener is tall enough to partner both. */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {/* TEMPORARILY OFF (2026-09-02) — the house-token work is still in
              progress, so the card and the MnaBanner that scrolls to it are
              both parked. The Watchlist takes the whole column meanwhile.
              Restore this block together with the <MnaBanner /> in
              app/page.tsx; they only make sense as a pair. */}
          <div className="rise min-w-0 flex-1 [&>div]:h-full" style={cell(250)}>
            <Watchlist coins={coins} error={error} />
          </div>
          {/*
          <div className="rise min-w-0 flex-1 [&>div]:h-full" style={cell(320)}>
            <WorldstreetTokenCard />
          </div>
          */}
        </div>
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-3" style={cell(320)}>
          <RecentTrades />
        </div>
        {/* [&>div]:h-full — the compact swap card is shorter than the trades
            list; stretch its shell so the pair shares one bottom edge. */}
        <div className="rise min-w-0 lg:col-span-2 [&>div]:h-full" style={cell(390)}>
          <SwapClient coins={coins} prices={prices} error={error} compact />
        </div>
      </div>
    </div>
  )
}
