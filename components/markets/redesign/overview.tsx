"use client"

/**
 * The top of the markets page: the preview's heading, tape and five stat
 * cards (components/markets-unauth/overview.tsx) on the page's real figures.
 *
 * Kept from the preview: every card and its layout. Swapped for real data:
 * market cap and its 24h move, 24h volume and BTC dominance from the global
 * feed; breadth from the listed assets; Fear & Greed from /insights, or the
 * public alternative.me index when /insights has no reading.
 * The BTC / ETH / other split reads both shares from the same global
 * response. The market-cap curve and the seven daily volume bars come from
 * getMarketHistory: BTC, ETH and USDT's own 7-day charts, summed (the
 * free API has no whole-market history), and say so in their tooltips. If
 * that history can't be fetched, the cards keep their figures and draw no
 * chart. A figure the feed doesn't have shows its empty state, not a 0.
 */

import * as React from "react"
import Link from "next/link"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { Panel, Spark } from "@/components/dashboard/redesign/ui"
import { getFearGreed, getMarketHistory } from "@/lib/actions"
import { listAssets, type MarketHistory } from "@/lib/market-history"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { UNKNOWN, breadthOf, formatFunding, formatLarge, formatPrice, futuresTotals } from "@/lib/markets-view"
import type { CoinData, FuturesMarket } from "@/lib/actions"

const EASE = [0.22, 1, 0.36, 1] as const
/** The preview's split tones: BTC, ETH, everything else. */
const SPLIT_TONES: Record<string, { bar: string; dot: string }> = {
  BTC: { bar: "bg-primary", dot: "bg-primary" },
  ETH: { bar: "bg-primary/45", dot: "bg-primary/45" },
  Other: { bar: "bg-foreground/15", dot: "bg-foreground/30" },
}

export type GlobalStats = {
  totalMarketCap: number
  totalVolume: number
  btcDominance: number
  ethDominance?: number
  marketCapChange24h: number
}

/* ── Heading ──────────────────────────────────────────────────────────── */

export function MarketsHeading({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Markets</h1>
      <p className="text-[14px] text-muted-foreground">{subtitle}</p>
    </div>
  )
}

/* ── Tape ─────────────────────────────────────────────────────────────── */

/** How many symbols ride the tape, as before. */
const TAPE_LENGTH = 14

function TapeItem({ coin, change }: { coin: CoinData; change: number | null }) {
  const up = (change ?? 0) >= 0
  return (
    <Link
      href={`/trade?symbol=${encodeURIComponent(coin.symbol)}`}
      className="flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 transition-colors hover:bg-foreground/[0.04]"
    >
      <CoinAvatar symbol={coin.symbol} src={coin.image} size="md" className="ring-1 ring-foreground/10" />
      <span className="text-[13px] font-semibold text-foreground">{coin.symbol}</span>
      <span className="text-[13px] font-medium tabular-nums text-foreground/80">${formatPrice(coin.price)}</span>
      {change !== null && (
        <span className={cn("text-[12.5px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
          {up ? "+" : "−"}
          {Math.abs(change).toFixed(2)}%
        </span>
      )}
    </Link>
  )
}

/** The most liquid assets (as before), with the same 24h move the rows show.
 *  The change is left off entirely while no asset has moved: a tape of flat
 *  "+0.00%" is a signal nobody measured. */
export function Tape({ coins, changeOf }: { coins: CoinData[]; changeOf: (c: CoinData) => number }) {
  const tape = React.useMemo(
    () => [...coins].filter((c) => c.price > 0).sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0)).slice(0, TAPE_LENGTH),
    [coins],
  )
  const showChange = tape.some((c) => changeOf(c) !== 0)
  if (tape.length === 0) return null
  return (
    <Panel className="dash-fade-x py-2" aria-label="Most traded assets">
      <div className="dash-marquee flex w-max motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-1 pr-1" aria-hidden={copy === 1 || undefined}>
            {tape.map((c) => (
              <TapeItem key={`${copy}-${c.id}`} coin={c} change={showChange ? changeOf(c) : null} />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}

/* ── Stat cards ───────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  aside,
  className,
  children,
}: {
  label: string
  value: React.ReactNode
  aside?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Panel as="article" className={cn("ds-lift flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-[20px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground sm:text-[23px]">{value}</span>
          {aside}
        </span>
      </div>
      <div className="min-h-[34px]">{children}</div>
    </Panel>
  )
}

/** A card's figure isn't available: the dash, and why, in the visual's slot. */
function Unavailable({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-muted-foreground">{children}</span>
}

/** The Fear & Greed reading: the backend's /insights first (the request the
 *  previous strip made), else the public index through getFearGreed. Null
 *  when neither has one. */
function useSentiment() {
  const [value, setValue] = React.useState<{ value: number; classification: string } | null>(null)
  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    const controller = new AbortController()
    const fromBackend = isCryptoBackendEnabled
      ? cryptoBackendClient
          .getInsights(1, controller.signal)
          .then((data) => data.fearGreed ?? null)
          .catch(() => null) // Expected before the backend carrying /insights is deployed.
      : Promise.resolve(null)
    fromBackend
      .then((reading) => reading ?? getFearGreed().catch(() => null))
      .then((reading) => {
        if (controller.signal.aborted) return
        if (reading) setValue(reading)
        setSettled(true)
      })
    return () => controller.abort()
  }, [])
  return { sentiment: value, settled }
}

/** The 7-day history behind the two charts: undefined while loading, null
 *  when it couldn't be fetched. One server call, cached there for 30 minutes. */
function useMarketHistory() {
  const [history, setHistory] = React.useState<MarketHistory | null | undefined>(undefined)
  React.useEffect(() => {
    let live = true
    getMarketHistory()
      .then((value) => live && setHistory(value))
      .catch(() => live && setHistory(null))
    return () => {
      live = false
    }
  }, [])
  return history
}

/* The preview's grid: two up on a phone with market cap spanning the top
   row; six tracks from lg so 5 cards land as 2 + 3; five across from 2xl. */
const GRID = "grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-6 2xl:grid-cols-5"
const WIDE = "lg:col-span-3 2xl:col-span-1"
const NARROW = "lg:col-span-2 2xl:col-span-1"

export function MarketStats({ coins, changeOf, globalStats, movesKnown }: { coins: CoinData[]; changeOf: (c: CoinData) => number; globalStats: GlobalStats; movesKnown: boolean }) {
  const { sentiment, settled } = useSentiment()
  const history = useMarketHistory()
  const covered = history ? `Last 7 days, summed over ${listAssets(history.assets)}` : undefined
  const volMax = history ? Math.max(...history.volumeDays, 1) : 1
  const breadth = React.useMemo(() => breadthOf(coins, changeOf), [coins, changeOf])
  const capUp = globalStats.marketCapChange24h >= 0
  const dominance = globalStats.btcDominance
  const eth = globalStats.ethDominance ?? 0
  // BTC, ETH and the rest, as the preview splits it; BTC and the rest when
  // the feed carries no ETH share.
  const split =
    eth > 0
      ? [
          { label: "BTC", pct: dominance },
          { label: "ETH", pct: eth },
          { label: "Other", pct: Math.max(0, 100 - dominance - eth) },
        ]
      : [
          { label: "BTC", pct: dominance },
          { label: "Other", pct: Math.max(0, 100 - dominance) },
        ]

  return (
    <div className={GRID}>
      <StatCard
        className={cn("col-span-2", WIDE)}
        label="Market cap"
        value={formatLarge(globalStats.totalMarketCap)}
        aside={
          globalStats.totalMarketCap > 0 && globalStats.marketCapChange24h !== 0 ? (
            <span className={cn("text-[13px] font-semibold tabular-nums", capUp ? "text-credit" : "text-debit")}>
              {capUp ? "+" : "−"}
              {Math.abs(globalStats.marketCapChange24h).toFixed(2)}%
            </span>
          ) : undefined
        }
      >
        {globalStats.totalMarketCap <= 0 ? (
          <Unavailable>Not reported by the price feed</Unavailable>
        ) : history === undefined ? (
          <span className="skel block h-[34px] w-full rounded-md" aria-hidden />
        ) : history ? (
          <div title={covered} aria-label={`Market cap, ${covered?.toLowerCase()}`} role="img">
            <Spark points={history.capSeries} width={240} height={34} fluid />
          </div>
        ) : null}
      </StatCard>

      <StatCard
        className={WIDE}
        label="24h volume"
        value={formatLarge(globalStats.totalVolume)}
        aside={history ? <span className="text-[12.5px] font-medium text-muted-foreground">7 days</span> : undefined}
      >
        {globalStats.totalVolume <= 0 ? (
          <Unavailable>Not reported by the price feed</Unavailable>
        ) : history === undefined ? (
          <span className="skel block h-[34px] w-full rounded-md" aria-hidden />
        ) : history ? (
          <div className="flex h-[34px] items-end gap-1.5" title={covered} aria-label={`Daily volume, ${covered?.toLowerCase()}`} role="img">
            {history.volumeDays.map((v, i) => (
              <motion.span
                key={i}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: v / volMax }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: EASE }}
                className={cn(
                  "h-full flex-1 origin-bottom rounded-[4px]",
                  i === history.volumeDays.length - 1
                    ? "bg-gradient-to-t from-primary/70 to-primary shadow-[0_0_12px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                    : "bg-foreground/[0.09]",
                )}
              />
            ))}
          </div>
        ) : null}
      </StatCard>

      <StatCard className={NARROW} label="BTC dominance" value={dominance > 0 ? `${dominance.toFixed(1)}%` : UNKNOWN}>
        {dominance > 0 ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {split.map((d, i) => (
                <motion.span
                  key={d.label}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.pct}%` }}
                  transition={{ duration: 0.9, delay: 0.25 + i * 0.08, ease: EASE }}
                  className={cn("h-full", SPLIT_TONES[d.label].bar)}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-medium text-muted-foreground">
              {split.map((d) => (
                <span key={d.label} className="flex items-center gap-1.5">
                  <span className={cn("size-1.5 rounded-full", SPLIT_TONES[d.label].dot)} />
                  {d.label} <span className="tabular-nums text-foreground/70">{d.pct.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <Unavailable>Not reported by the price feed</Unavailable>
        )}
      </StatCard>

      <StatCard
        className={NARROW}
        label="Fear & Greed"
        value={sentiment ? sentiment.value : settled ? UNKNOWN : <span className="skel inline-block h-6 w-10 rounded" />}
        aside={
          sentiment?.classification ? (
            <span className="rounded-md bg-primary/[0.12] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-primary">{sentiment.classification}</span>
          ) : undefined
        }
      >
        {sentiment ? (
          <div className="flex flex-col gap-2">
            <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,var(--debit),var(--warning)_50%,var(--credit))]">
              <motion.span
                initial={{ left: "0%", opacity: 0 }}
                animate={{ left: `${Math.min(100, Math.max(0, sentiment.value))}%`, opacity: 1 }}
                transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
                className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_20%,transparent)]"
              />
            </div>
            <div className="flex justify-between text-[11.5px] font-medium text-muted-foreground">
              <span>Fear</span>
              <span>Greed</span>
            </div>
          </div>
        ) : settled ? (
          <Unavailable>No reading available yet</Unavailable>
        ) : null}
      </StatCard>

      <StatCard
        className={NARROW}
        label="Breadth"
        value={
          breadth ? (
            <>
              <span className="text-credit">{breadth.advancing}</span>
              <span className="mx-1 text-[15px] font-medium text-muted-foreground">up</span>
              <span className="text-debit">{breadth.declining}</span>
              <span className="ml-1 text-[15px] font-medium text-muted-foreground">down</span>
            </>
          ) : movesKnown ? (
            UNKNOWN
          ) : (
            <span className="skel inline-block h-6 w-24 rounded" />
          )
        }
      >
        {breadth ? (
          <div className="flex flex-col gap-2">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${breadth.pct}%` }}
                transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
                className="h-full rounded-l-full bg-credit"
              />
              <span className="h-full flex-1 rounded-r-full bg-debit/80" />
            </div>
            <span className="text-[11.5px] font-medium text-muted-foreground">
              <span className="tabular-nums text-foreground/70">{Math.round(breadth.pct)}%</span> of listed assets up in the last 24h
            </span>
          </div>
        ) : movesKnown ? (
          <Unavailable>No 24h moves to count yet</Unavailable>
        ) : null}
      </StatCard>
    </div>
  )
}

/** The futures venue's own four figures, in the same cards. */
export function FuturesStats({ markets, loading }: { markets: FuturesMarket[]; loading: boolean }) {
  const t = futuresTotals(markets)
  const cards = [
    { label: "24h volume", value: formatLarge(t.volume) },
    { label: "Open interest", value: formatLarge(t.openInterest) },
    { label: "Avg funding rate", value: t.contracts > 0 ? formatFunding(t.avgFunding) : UNKNOWN, tone: t.contracts > 0 ? (t.avgFunding >= 0 ? "text-credit" : "text-debit") : undefined },
    { label: "Contracts", value: String(t.contracts) },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={loading ? <span className="skel inline-block h-6 w-20 rounded" /> : <span className={c.tone}>{c.value}</span>} />
      ))}
    </div>
  )
}
