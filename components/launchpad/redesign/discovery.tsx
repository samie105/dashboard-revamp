"use client"

/**
 * The launchpad board, pump.fun style: every launch on the chosen network,
 * art first, with its market over a rolling window.
 *
 *   live trades ticker
 *   → header (network: Mainnet | Devnet, search, launch button)
 *   → king of the hill (the live launch closest to graduating)
 *   → your launches & holdings
 *   → the board: Trending | New | About to graduate | Graduated,
 *     window (5m/1h/6h/24h), a grid of cards
 *   → how it works
 *
 * Mainnet and devnet are separate launchpads (separate curves and tokens).
 * Devnet is labelled as test tokens wherever it shows: the network tab, a
 * banner, and a TEST tag on every devnet card.
 *
 * Launches, their curves and the network list are real (backend). Market
 * stats, the ticker and the portfolio come through
 * lib/launchpad-market/source.ts: until the backend serves them, the board
 * falls back to the launches' own curve data and those parts stay out (the
 * board says prices are coming). Locally, NEXT_PUBLIC_LAUNCHPAD_MOCKS fills
 * them with demo data (labelled "Demo data").
 *
 * Kept from the old page: the pause notice and paused launch button, the
 * chain availability chips, loading, error and empty states.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Cancel01Icon, Rocket01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import type { LaunchpadFeedFilter, LaunchpadNetworkId } from "@/lib/crypto-backend/types"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { Icon, Panel } from "@/components/dashboard/redesign/ui"
import { Chip, DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { cardView, type LaunchCardView } from "@/lib/launchpad-view"
import { launchpadMarket } from "@/lib/launchpad-market/source"
import { isMarketUnavailable, MARKET_WINDOWS, type LaunchMarketStats, type MarketWindow } from "@/lib/launchpad-market/types"
import { searchBoard, sortBoard, tinyPrice, type BoardRow, type BoardSort } from "@/lib/launchpad-market/view"
import { useLaunchActivity, useLaunchFeed, useLaunchPortfolio, useLaunchStats } from "@/hooks/launchpad/useLaunchpadMarket"
import { isDevnet, useLaunchNetwork } from "../network"
import { ChangeText, KingOfTheHill, LaunchCard, TestTag, TradeTicker } from "./board"
import { HowItWorks } from "./how-it-works"
import { ChainChips, LaunchAvatar, PausedNotice, useLaunchAvailability } from "./ui"

export { LaunchCard }

function useNow() {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/* ── Network: two launchpads, clearly apart ───────────────────────────── */

function NetworkTabs({ networks, networkId, onChange }: { networks: Array<{ networkId: LaunchpadNetworkId; label: string }>; networkId: LaunchpadNetworkId | null; onChange: (n: LaunchpadNetworkId) => void }) {
  if (!networkId || networks.length === 0) return <span className="skel h-11 w-[200px] rounded-xl" aria-hidden />
  return (
    <div role="tablist" aria-label="Network" className="inline-flex h-11 gap-1 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] p-1">
      {networks.map((n) => {
        const on = n.networkId === networkId
        const dev = isDevnet(n.networkId)
        return (
          <button
            key={n.networkId}
            type="button"
            role="tab"
            aria-selected={on}
            title={dev ? "Test tokens, no value" : "Real tokens"}
            onClick={() => onChange(n.networkId)}
            className={cn(
              "flex items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
              on ? (dev ? "bg-warning/[0.14] text-warning ring-1 ring-warning/30" : "bg-foreground/[0.08] text-foreground ring-1 ring-foreground/10") : "text-muted-foreground hover:text-foreground",
            )}
          >
            {n.label}
            {dev && <TestTag />}
          </button>
        )
      })}
    </div>
  )
}

/* ── Header ───────────────────────────────────────────────────────────── */

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="group flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 transition-colors focus-within:border-primary/40 md:w-[280px]">
      <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
      <span className="sr-only">Search launches</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search name, ticker or mint" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
          <Icon icon={Cancel01Icon} className="size-4" />
        </button>
      )}
    </label>
  )
}

function Header({ paused, network, availability, query, onQuery }: { paused: boolean; network: ReturnType<typeof useLaunchNetwork>; availability: ReturnType<typeof useLaunchAvailability>["data"]; query: string; onQuery: (v: string) => void }) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[30px]">Launchpad</h1>
          {launchpadMarket.isMock && <Chip>Demo data</Chip>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChainChips availability={availability} />
          <a href="#how-it-works" className="hidden text-[12.5px] font-medium md:inline text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">How it works</a>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <SearchBox value={query} onChange={onQuery} />
        <NetworkTabs networks={network.networks} networkId={network.networkId} onChange={network.setNetworkId} />
        {paused ? (
          <span aria-disabled="true" className="flex h-11 items-center rounded-xl border border-warning/30 bg-warning/[0.08] px-4 text-[13.5px] font-semibold text-warning">
            Launches paused
          </span>
        ) : (
          <Link href="/launchpad/create" className="ds-gold group flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-[14px] font-semibold md:flex-none">
            <Icon icon={Rocket01Icon} className="hidden size-[18px] transition-transform sm:block duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
            Launch a token
          </Link>
        )}
      </div>
    </header>
  )
}

/* ── Your launches & holdings ─────────────────────────────────────────── */

function YourLaunches({ networkId, byId, devnet }: { networkId: LaunchpadNetworkId | null; byId: Map<string, LaunchCardView>; devnet: boolean }) {
  const portfolio = useLaunchPortfolio(networkId)
  // Not served yet in production: leave the strip out rather than an empty section.
  if (portfolio.error && isMarketUnavailable(portfolio.error)) return null
  const items = portfolio.data
    ? [
        ...portfolio.data.holdings.map((h) => ({ id: h.launchId, kind: "holding" as const, h })),
        ...portfolio.data.launchedIds.filter((id) => !portfolio.data!.holdings.some((h) => h.launchId === id)).map((id) => ({ id, kind: "launched" as const, h: null })),
      ].filter((x) => byId.has(x.id))
    : null
  return (
    <section aria-labelledby="your-launches" className="flex flex-col gap-3">
      <h2 id="your-launches" className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Your launches &amp; holdings{items && items.length > 0 && <span className="ml-1.5 font-semibold normal-case tracking-normal">· {items.length}</span>}
      </h2>
      {portfolio.error ? (
        <p className="text-[13px] text-debit">Couldn&apos;t load your launches. {formatWalletActionError(portfolio.error, "solana")}</p>
      ) : !items ? (
        <div className="flex gap-3 overflow-hidden">{[0, 1, 2].map((i) => <span key={i} className="skel h-[62px] w-[240px] shrink-0 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          You haven&apos;t launched or bought a token on {devnet ? "devnet" : "mainnet"} yet.{" "}
          <Link href="/launchpad/create" className="font-semibold text-primary hover:underline">Launch your first</Link>
        </p>
      ) : (
        <ul className="scrollbar-none flex snap-x gap-3 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]">
          {items.map((x) => {
            const v = byId.get(x.id)!
            return (
              <li key={x.id} className="snap-start">
                <Link href={`/launchpad/${encodeURIComponent(v.id)}`} className="ds-panel flex w-[240px] items-center gap-3 rounded-2xl px-3.5 py-3 outline-none transition-colors hover:border-foreground/[0.16] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50">
                  <LaunchAvatar symbol={v.symbol} iconUrl={v.iconUrl} mint={v.mint} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold text-foreground">${v.symbol}</span>
                      {devnet && <TestTag />}
                    </span>
                    <span className="truncate text-[11.5px] text-muted-foreground">{x.kind === "launched" ? "You launched this" : `${(x.h!.tokens / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M held`}</span>
                  </span>
                  {x.h && (
                    <span className="flex flex-col items-end">
                      <span className="text-[12px] font-semibold tabular-nums text-foreground">{tinyPrice(x.h.valueSol < 0.001 ? x.h.valueSol : Number(x.h.valueSol.toFixed(3)), "SOL")}</span>
                      <ChangeText value={x.h.pnlPct} className="text-[11px] font-semibold" />
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ── The board ────────────────────────────────────────────────────────── */

type Tab = "trending" | "new" | "near" | "graduated"

/** Each tab is one backend list in one order. */
const TABS: { key: Tab; label: string; feed: LaunchpadFeedFilter; sort: BoardSort; fallback: BoardSort }[] = [
  { key: "trending", label: "Trending", feed: "all", sort: "trending", fallback: "newest" },
  { key: "new", label: "New", feed: "new", sort: "newest", fallback: "newest" },
  { key: "near", label: "About to graduate", feed: "near", sort: "near", fallback: "near" },
  { key: "graduated", label: "Graduated", feed: "graduated", sort: "mcap", fallback: "newest" },
]

const EMPTY_COPY: Record<Tab, string> = {
  trending: "Nothing is on the curve here yet. Be the first to launch.",
  new: "Nothing launched in the last day.",
  near: "No launch is past 75% of its target yet.",
  graduated: "Nothing has graduated here yet.",
}

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"

function Board({ networkId, networkError, stats, statsUnavailable, devnet, now, query }: { networkId: LaunchpadNetworkId | null; networkError: unknown; stats?: Record<string, LaunchMarketStats>; statsUnavailable: boolean; devnet: boolean; now: number; query: string }) {
  const [tab, setTab] = React.useState<Tab>("trending")
  const [window, setWindow] = React.useState<MarketWindow>("1h")
  const def = TABS.find((t) => t.key === tab)!
  const feed = useLaunchFeed(networkId, def.feed)
  // Tab counts only for lists already read; never a fetch just to count.
  const counts: Record<Tab, number | undefined> = {
    trending: useLaunchFeed(networkId, "all", false).data?.length,
    new: useLaunchFeed(networkId, "new", false).data?.length,
    near: useLaunchFeed(networkId, "near", false).data?.length,
    graduated: useLaunchFeed(networkId, "graduated", false).data?.length,
  }
  // Without market data, the market orders can't be honoured.
  const sort = statsUnavailable ? def.fallback : def.sort
  const rows: BoardRow[] = React.useMemo(
    () => sortBoard(searchBoard((feed.data ?? []).map((t) => ({ card: cardView(t), stats: stats?.[t.launchId] ?? null })), query), sort, window),
    [feed.data, stats, query, sort, window],
  )

  return (
    <section aria-label="Launches" className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div role="tablist" aria-label="Board" className="scrollbar-none flex gap-2 overflow-x-auto">
          {TABS.map((t) => {
            const on = t.key === tab
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
                  on ? "bg-foreground text-background" : "bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground",
                )}
              >
                {t.label}
                {counts[t.key] !== undefined && <span className={cn("text-[11px] tabular-nums", on ? "text-background/70" : "text-muted-foreground/80")}>{counts[t.key]}</span>}
              </button>
            )
          })}
        </div>
        {!statsUnavailable && (
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-muted-foreground">Change over</span>
            <div role="tablist" aria-label="Change window" className="flex h-9 items-center gap-0.5 rounded-full bg-foreground/[0.05] p-1">
              {MARKET_WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="tab"
                  aria-selected={window === w}
                  onClick={() => setWindow(w)}
                  className={cn("h-7 rounded-full px-3 text-[12.5px] font-semibold tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60", window === w ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {statsUnavailable && <p className="text-[12.5px] text-muted-foreground">Market caps, price changes and trending are coming soon. Until then each card shows its curve.</p>}

      {networkError ? (
        <Panel className="px-6 py-8 text-center text-[13px] text-debit">{formatWalletActionError(networkError, "solana")}</Panel>
      ) : feed.isLoading || !networkId ? (
        <div className={GRID} role="status" aria-label="Loading launches">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className="skel aspect-[4/5] rounded-[20px]" />)}
        </div>
      ) : feed.error ? (
        <Panel className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-[13px] text-debit">{formatWalletActionError(feed.error, "solana")}</p>
          <button type="button" onClick={() => void feed.refetch()} className="rounded-xl border border-foreground/[0.1] px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-foreground/[0.04]">Try again</button>
        </Panel>
      ) : rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-foreground">{query.trim() ? `Nothing matches “${query.trim()}”` : "No launches"}</p>
          <p className="text-[13px] text-muted-foreground">{query.trim() ? "Try another name, ticker or mint." : EMPTY_COPY[tab]}</p>
          {!query.trim() && tab === "trending" && (
            <Link href="/launchpad/create" className="mt-2 text-[13px] font-semibold text-primary hover:underline">Launch a token</Link>
          )}
        </Panel>
      ) : (
        <motion.div layout className={GRID}>
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((r, i) => (
              <motion.div
                key={r.card.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.025, ease: [0.22, 1, 0.36, 1] }}
              >
                <LaunchCard v={r.card} now={now} stats={r.stats} window={window} devnet={devnet} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export function LaunchpadDiscoveryPage() {
  const network = useLaunchNetwork()
  const networkId = network.networkId
  const devnet = isDevnet(networkId)
  const availability = useLaunchAvailability()
  const paused = availability.data?.solana.state === "paused"
  const now = useNow()
  const [query, setQuery] = React.useState("")
  const onCurve = useLaunchFeed(networkId, "all")
  const graduated = useLaunchFeed(networkId, "graduated")
  const stats = useLaunchStats(networkId)
  const statsUnavailable = Boolean(stats.error)
  const activity = useLaunchActivity(networkId)

  const onCurveCards = React.useMemo(() => onCurve.data?.map(cardView), [onCurve.data])
  const graduatedCards = React.useMemo(() => graduated.data?.map(cardView), [graduated.data])
  const byId = React.useMemo(() => new Map([...(onCurveCards ?? []), ...(graduatedCards ?? [])].map((v) => [v.id, v])), [onCurveCards, graduatedCards])
  const king = React.useMemo(() => [...(onCurveCards ?? [])].filter((v) => v.status === "live").sort((a, b) => b.progressBps - a.progressBps)[0] ?? null, [onCurveCards])
  const target = [...(onCurveCards ?? []), ...(graduatedCards ?? [])].find((v) => v.graduationSol !== null)?.graduationSol ?? null

  return (
    // Spacing follows one scale (4·8·12·16·24·32·40·48): related blocks sit close
    // (masthead 16, featured 24), separate groups far apart (40), and the
    // explainer is set off by a rule with 48 either side.
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-8 px-4 pb-12 pt-4 md:gap-10 md:px-8 md:pb-16 md:pt-6">
      <div className="flex flex-col gap-4">
        {!activity.error && <TradeTicker trades={activity.data} loading={activity.isLoading && Boolean(networkId)} />}
        <PausedNotice availability={availability.data} />
        <Rise>
          <Header paused={paused} network={network} availability={availability.data} query={query} onQuery={setQuery} />
        </Rise>
        {devnet && (
          <p role="note" className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/[0.07] px-4 py-3 text-[12.5px] text-foreground/85">
            <TestTag />
            You&apos;re on devnet. These are test tokens: they have no value and can&apos;t be moved to mainnet.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-6 empty:hidden">
        {king && !query.trim() && (
          <Rise delay={50}>
            <KingOfTheHill v={king} stats={stats.data?.[king.id] ?? null} devnet={devnet} now={now} />
          </Rise>
        )}
        {onCurve.isLoading && <span className="skel h-[208px] rounded-[24px]" aria-hidden />}
        <Rise delay={90}>
          <YourLaunches networkId={networkId} byId={byId} devnet={devnet} />
        </Rise>
      </div>
      <Rise delay={120}>
        <Board key={networkId ?? "none"} networkId={networkId} networkError={network.error} stats={stats.data} statsUnavailable={statsUnavailable} devnet={devnet} now={now} query={query} />
      </Rise>
      <HowItWorks target={target} paused={paused} />
    </DashScope>
  )
}
