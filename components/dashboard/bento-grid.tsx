"use client"

import * as React from "react"
import Link from "next/link"
import type { CoinData } from "@/lib/actions"

// Market rows for the Spot tab — the service's price feed with the display
// fields the old spotv2 pair registry carried.
import { ErrorState } from "@/components/error-state"
import {
  CardHeader,
  CardShell,
  ChangeText,
  EmptyState as SystemEmptyState,
  SkeletonRows,
  type IllustrationKey,
} from "@/components/ui/system"
import { fetchProfile } from "@/lib/profile-actions"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord, type LedgerRow } from "@/lib/ledger-rows"
import { explorerTxUrl } from "@/lib/crypto-backend/network-meta"
import { chainLabel } from "@/lib/spot-market-search"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE } from "@/components/ui/surface"
import { cn } from "@/lib/utils"
import { DashboardInsights } from "@/components/dashboard/insights"


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
/**
 * Markets — a SUMMARY, not a screener.
 *
 * It used to pull the whole spot registry through `useSpotRegistry` — 2,000+
 * rows — and then render six of them behind a "Show more". The catalogue was
 * fetched so it could be thrown away.
 *
 * Now it asks the backend for the most liquid handful (`loadTopSpotMarkets`,
 * which sends `?limit=`). The backend sorts by liquidity descending, so the
 * top of that list IS the mainstream end of the market — no client-side
 * ranking, and nothing downloaded that is not shown.
 *
 * The search box went with the registry. Searching two thousand markets is
 * what /trading/markets is for, and a search box over six rows that silently
 * cannot see the other 1,994 is worse than no search box. "View all" goes
 * there instead.
 */
/**
 * The markets summary.
 *
 * It used to fetch `/trading/spot/markets`, which is the *venue registry* —
 * the three pairs the swap router can actually fill — and dressing three rows
 * up as "Markets" on a dashboard reads like the feed is broken. The list the
 * app already has is `coins`, fetched server-side for this page and handed
 * down as a prop, several hundred rows deep with a 24h move on each.
 *
 * So: no second request, and the page is never asked to lay out hundreds of
 * rows. The mainstream slice is the top `MARKET_POOL` by 24h volume — the
 * ordering "most traded right now" already claims — and only one page of it
 * is in the DOM at a time. `View all` goes to the full table.
 */
function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  return `$${Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)}`
}

const MARKET_PAGE = 6
const MARKET_POOL = 30

function MarketsTable({ coins }: { coins: CoinData[] }) {
  const pool = React.useMemo(
    () =>
      coins
        .filter((c) => c.price > 0)
        // A no-op when the feed carries no volume, which leaves the upstream's
        // own ordering — already mainstream-first — untouched.
        .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
        .slice(0, MARKET_POOL),
    [coins],
  )

  /* The 24h move comes from a secondary enrichment that is often absent, and
     when it is every coin reads a flat, green "+0.00%" — six invented signals
     in a row. If nothing in the pool has moved, the number is not there, so
     the card shows 24h volume instead and says nothing it cannot support. */
  const hasMoves = React.useMemo(() => pool.some((c) => c.change24h !== 0), [pool])
  /* Same again for volume: the price feed in use carries quotes only, so when
     it is empty the row is just a price, rather than a column of em dashes
     standing in for a figure nothing supplies. */
  const hasVolume = React.useMemo(() => pool.some((c) => c.volume24h > 0), [pool])

  const pages = Math.max(1, Math.ceil(pool.length / MARKET_PAGE))
  const [page, setPage] = React.useState(0)
  // A shorter list after a refresh must not leave the view on a page that no
  // longer exists.
  const safePage = Math.min(page, pages - 1)
  const rows = pool.slice(safePage * MARKET_PAGE, safePage * MARKET_PAGE + MARKET_PAGE)

  return (
    <CardShell className={CARD_HUE} data-onboarding="dash-markets">
      <CardHeader
        title="Markets"
        subtitle="Most traded right now"
        link={{ label: "View all", href: "/trading/markets" }}
      />

      {pool.length === 0 ? (
        <EmptyState
          illustration="cryptoTrade"
          title="Markets unavailable"
          description="The market list isn't loading right now — your balances are unaffected."
        />
      ) : (
        <>
          <div className="flex flex-1 flex-col divide-y divide-border/20 px-1">
            {rows.map((coin) => {
              const up = coin.change24h >= 0
              return (
                <Link
                  key={coin.id}
                  href={`/trade?symbol=${encodeURIComponent(coin.symbol)}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/40"
                >
                  <CoinAvatar symbol={coin.symbol} src={coin.image} size="md" />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13.5px] font-semibold">{coin.symbol}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{coin.name}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end leading-tight">
                    <span className="text-[13.5px] font-semibold tabular-nums">
                      {`$${coin.price.toLocaleString(undefined, {
                        maximumFractionDigits: coin.price < 1 ? 6 : 2,
                      })}`}
                    </span>
                    {/* Green and red here are price direction, the one place
                        on this card where a non-gold accent earns its keep. */}
                    {hasMoves ? (
                      <span
                        className={cn(
                          "text-[11.5px] font-semibold tabular-nums",
                          up ? "text-credit" : "text-debit",
                        )}
                      >
                        {up ? "+" : ""}
                        {coin.change24h.toFixed(2)}%
                      </span>
                    ) : hasVolume ? (
                      <span className="text-[11.5px] tabular-nums text-muted-foreground">
                        {formatCompactUsd(coin.volume24h)} vol
                      </span>
                    ) : null}
                  </span>
                </Link>
              )
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                {safePage * MARKET_PAGE + 1}–{safePage * MARKET_PAGE + rows.length} of {pool.length}
              </span>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, Math.min(p, pages - 1) - 1))}
                  disabled={safePage === 0}
                  aria-label="Previous markets"
                  className="rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pages - 1, Math.min(p, pages - 1) + 1))}
                  disabled={safePage >= pages - 1}
                  aria-label="Next markets"
                  className="rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                >
                  Next
                </button>
              </span>
            </div>
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
    <CardShell className={CARD_HUE} data-onboarding="dash-trades">
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
    <CardShell className={CARD_HUE} data-onboarding="dash-watchlist">
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
/* ========== Dashboard Grid ========== */
interface DashboardGridProps {
  coins: CoinData[]
  prices: Record<string, number>
  error?: string
}

/* One rule per section — the label, then a hairline to the end of the row.
   Cheap, and it does what another card title could not: it groups.

   Module scope, not inside DashboardGrid: a component declared during render
   is a NEW component type on every pass, so React unmounts and remounts the
   whole subtree under it each time the parent renders. */
function Rule({ label, note }: { label: string; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-border/50" />
      {note && <span className="shrink-0 text-[11px] text-muted-foreground/70">{note}</span>}
    </div>
  )
}

export function DashboardGrid({ coins, error }: DashboardGridProps) {
  // Information architecture, ownership first.
  // Row 1 — your money in motion: activity beside everything you hold.
  // Row 2 — the market: the summary beside what you starred.
  // Row 3 — your fills. (`prices` left the props with the swap desk: nothing
  // in this grid values anything any more, the hero owns that.)
  // Each row is its own grid so partners stretch to equal height.
  // Each card carries its own `rise` delay, stepping down the page in reading
  // order — the grid assembles card by card instead of landing as one slab.
  // (This plays when the streamed data mounts, after the skeleton, so it also
  // marks the moment the numbers became real.)
  const cell = (delay: number): React.CSSProperties =>
    ({ "--rise-delay": `${delay}ms` }) as React.CSSProperties

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Insights — four readouts, every figure already on the client. */}
      <div className="flex flex-col gap-3">
        <div className="rise" style={cell(140)}>
          <Rule label="Insights" note="From what you hold" />
        </div>
        <div className="rise" style={cell(180)}>
          <DashboardInsights coins={coins} />
        </div>
      </div>

      <div className="rise" style={cell(220)}>
        <Rule label="Markets &amp; trading" />
      </div>

      <div className="grid w-full gap-4 lg:grid-cols-5">
        <div className="rise min-w-0 lg:col-span-3" style={cell(180)}>
          <MarketsTable coins={coins} />
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

      {/* The swap desk that used to sit beside this is gone — it mounted the
          old swap modal, and a dashboard is not the place to keep a second
          copy of a flow that has its own screen. Trades take the row. */}
      <div className="rise w-full" style={cell(320)}>
        <RecentTrades />
      </div>
    </div>
  )
}
