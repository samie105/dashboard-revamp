"use client"

/**
 * The launchpad board (pump.fun-style): every launch on the chosen network,
 * with its market over a rolling window.
 *
 *   header (network: Mainnet | Devnet, launch button)
 *   → network stats → closest to graduation → your launches & holdings
 *   → the board: filter, window (5m/1h/6h/24h), sort, grid or list
 *   → how it works
 *
 * Mainnet and devnet are separate launchpads (separate curves and tokens).
 * Devnet is labelled as test tokens wherever it shows: the network tab, a
 * banner, and a TEST tag on every devnet card and row.
 *
 * Launches, their curves and the network list are real (backend). Market
 * stats and portfolio come through lib/launchpad-market/source.ts: until the
 * backend serves them, the board falls back to the launches' own curve data
 * and those sections say they're coming. Locally, NEXT_PUBLIC_LAUNCHPAD_MOCKS
 * fills them with demo data (labelled "Demo data").
 *
 * Kept from the old page: the pause notice and paused launch button, the
 * chain availability chips, loading, error and empty states.
 */

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight02Icon, Cancel01Icon, GridViewIcon, LeftToRightListBulletIcon, Rocket01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import type { LaunchpadFeedFilter, LaunchpadNetworkId } from "@/lib/crypto-backend/types"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { Icon, Panel, PanelTitle, PillTabs, Spark, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { Chip, DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { agoFrom, cardView, progressLabel, type LaunchCardView } from "@/lib/launchpad-view"
import { launchpadMarket } from "@/lib/launchpad-market/source"
import { isMarketUnavailable, MARKET_WINDOWS, type LaunchMarketStats, type MarketWindow } from "@/lib/launchpad-market/types"
import { BOARD_SORT_LABEL, BOARD_SORTS, compactUsd, searchBoard, sortBoard, tinyPrice, type BoardRow, type BoardSort } from "@/lib/launchpad-market/view"
import { useLaunchFeed, useLaunchPortfolio, useLaunchStats } from "@/hooks/launchpad/useLaunchpadMarket"
import { isDevnet, useLaunchNetwork } from "../network"
import { BoardTable, ChangeText, LaunchCard, TestTag } from "./board"
import { ChainChips, LaunchAvatar, PausedNotice, ProgressBar, useLaunchAvailability } from "./ui"

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
  if (!networkId || networks.length === 0) return <span className="skel h-[52px] w-[320px] rounded-2xl" aria-hidden />
  return (
    <div role="tablist" aria-label="Network" className="inline-flex gap-1 rounded-2xl border border-foreground/[0.07] bg-foreground/[0.025] p-1">
      {networks.map((n) => {
        const on = n.networkId === networkId
        const dev = isDevnet(n.networkId)
        return (
          <button
            key={n.networkId}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(n.networkId)}
            className={cn(
              "flex flex-col items-start rounded-xl px-3.5 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
              on ? (dev ? "bg-warning/[0.14] ring-1 ring-warning/30" : "bg-foreground/[0.08] ring-1 ring-foreground/10") : "hover:bg-foreground/[0.04]",
            )}
          >
            <span className={cn("flex items-center gap-1.5 text-[13.5px] font-semibold", on ? (dev ? "text-warning" : "text-foreground") : "text-muted-foreground")}>
              {n.label}
              {dev && <TestTag />}
            </span>
            <span className="text-[11px] text-muted-foreground">{dev ? "Test tokens, no value" : "Real tokens"}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ── Header + network stats ───────────────────────────────────────────── */

function Header({ paused, network, availability }: { paused: boolean; network: ReturnType<typeof useLaunchNetwork>; availability: ReturnType<typeof useLaunchAvailability>["data"] }) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground md:text-[32px]">Launchpad</h1>
          {launchpadMarket.isMock && <Chip>Demo data</Chip>}
          <ChainChips availability={availability} />
        </div>
        <p className="max-w-[60ch] text-[13.5px] text-muted-foreground">Launch a token in a minute and trade it from the first second. Every token starts on a bonding curve and graduates to the open market when the curve fills.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <NetworkTabs networks={network.networks} networkId={network.networkId} onChange={network.setNetworkId} />
        {paused ? (
          <span aria-disabled="true" className="flex h-[52px] items-center rounded-2xl border border-warning/30 bg-warning/[0.08] px-5 text-[14px] font-semibold text-warning">
            Launches paused
          </span>
        ) : (
          <Link href="/launchpad/create" className="ds-gold group flex h-[52px] items-center gap-2 rounded-2xl px-5 text-[14.5px] font-semibold">
            <Icon icon={Rocket01Icon} className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
            Launch a token
          </Link>
        )}
      </div>
    </header>
  )
}

function NetworkStats({ onCurve, graduated, stats }: { onCurve?: LaunchCardView[]; graduated?: LaunchCardView[]; stats?: Record<string, LaunchMarketStats> }) {
  const raised = onCurve?.reduce((s, v) => s + (v.solRaised ?? 0), 0)
  const volume = stats ? Object.values(stats).reduce((s, x) => s + x.volumeUsd["24h"], 0) : null
  const txns = stats ? Object.values(stats).reduce((s, x) => s + x.txns["24h"].buys + x.txns["24h"].sells, 0) : null
  const items = [
    { k: "On the curve", v: onCurve ? onCurve.length.toLocaleString("en-US") : null },
    { k: "SOL in curves", v: raised === undefined ? null : raised.toLocaleString("en-US", { maximumFractionDigits: 1 }) },
    { k: "Graduated", v: graduated ? graduated.length.toLocaleString("en-US") : null },
    { k: "Volume 24h", v: stats ? compactUsd(volume) : "—", hint: stats ? undefined : "Coming soon" },
    { k: "Trades 24h", v: stats ? (txns ?? 0).toLocaleString("en-US") : "—", hint: stats ? undefined : "Coming soon" },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.06] sm:grid-cols-3 lg:grid-cols-5">
      {items.map((s) => (
        <div key={s.k} className="flex flex-col gap-0.5 bg-card px-4 py-3 dark:bg-[color-mix(in_oklab,var(--card)_55%,var(--background))]">
          <dd className="font-display text-[20px] font-semibold tabular-nums text-foreground">{s.v ?? <span className="skel inline-block h-6 w-14 rounded-md align-middle" aria-label="Loading" />}</dd>
          <dt className="text-[11.5px] text-muted-foreground">
            {s.k}
            {s.hint && <span className="text-muted-foreground/60"> · {s.hint}</span>}
          </dt>
        </div>
      ))}
    </dl>
  )
}

/* ── Closest to graduation ────────────────────────────────────────────── */

function Spotlight({ top, stats, devnet, now }: { top: LaunchCardView | null; stats: LaunchMarketStats | null; devnet: boolean; now: number }) {
  if (!top) return null
  const spark = stats?.spark["24h"] ?? []
  return (
    <Link href={`/launchpad/${encodeURIComponent(top.id)}`} className="group block rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      <Panel className="ds-lift relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_50%,color-mix(in_oklab,var(--primary)_9%,transparent),transparent_60%)]" />
        <div className="relative grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:gap-8 md:p-6">
          <div className="flex items-center gap-4">
            <LaunchAvatar symbol={top.symbol} iconUrl={top.iconUrl} mint={top.mint} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Closest to graduation</span>
              <span className="flex min-w-0 items-center gap-2 font-display text-[21px] font-semibold tracking-[-0.02em] text-foreground">
                <span className="truncate">{top.name}</span>
                <span className="text-muted-foreground">${top.symbol}</span>
                {devnet && <TestTag />}
              </span>
              <span className="text-[12.5px] text-muted-foreground">
                {stats && (
                  <>
                    {compactUsd(stats.marketCapUsd)} mkt cap · <ChangeText value={stats.changePct["24h"]} className="font-semibold" /> 24h ·{" "}
                  </>
                )}
                {agoFrom(top.createdAt, now) || "—"}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            {spark.length > 1 && <Spark points={spark} width={300} height={42} fluid tone="brand" />}
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-semibold tabular-nums text-foreground">
                {top.solRaised === null ? "—" : top.solRaised.toFixed(1)} <span className="font-medium text-muted-foreground">of {top.graduationSol === null ? "—" : top.graduationSol.toLocaleString("en-US")} SOL</span>
              </span>
              <span className="font-display text-[17px] font-semibold tabular-nums text-primary">{progressLabel(top.progressBps, top.status)}</span>
            </div>
            <ProgressBar bps={top.progressBps} status={top.status} size="lg" />
          </div>
          <span className="flex h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-primary/50 px-4 text-[13.5px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground md:self-center">
            Trade
            <Icon icon={ArrowRight02Icon} className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </span>
        </div>
      </Panel>
    </Link>
  )
}

/* ── Your launches & holdings ─────────────────────────────────────────── */

function YourLaunches({ networkId, byId, devnet }: { networkId: LaunchpadNetworkId | null; byId: Map<string, LaunchCardView>; devnet: boolean }) {
  const portfolio = useLaunchPortfolio(networkId)
  // Not served yet in production: one quiet line instead of a whole empty section.
  if (portfolio.error && isMarketUnavailable(portfolio.error)) return null
  const items = portfolio.data
    ? [
        ...portfolio.data.holdings.map((h) => ({ id: h.launchId, kind: "holding" as const, h })),
        ...portfolio.data.launchedIds.filter((id) => !portfolio.data!.holdings.some((h) => h.launchId === id)).map((id) => ({ id, kind: "launched" as const, h: null })),
      ].filter((x) => byId.has(x.id))
    : null
  return (
    <section aria-labelledby="your-launches" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="your-launches" className="font-display text-[16px] font-semibold text-foreground">Your launches &amp; holdings</h2>
        {items && items.length > 0 && <span className="text-[12px] text-muted-foreground">{items.length} on {devnet ? "devnet" : "mainnet"}</span>}
      </div>
      {portfolio.error ? (
        <Panel className="px-5 py-4 text-[13px] text-debit">Couldn&apos;t load your launches. {formatWalletActionError(portfolio.error, "solana")}</Panel>
      ) : !items ? (
        <div className="flex gap-3 overflow-hidden">{[0, 1, 2].map((i) => <span key={i} className="skel h-[76px] w-[260px] shrink-0 rounded-2xl" />)}</div>
      ) : items.length === 0 ? (
        <Panel className="flex flex-col items-start gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-muted-foreground">You haven&apos;t launched or bought a token on {devnet ? "devnet" : "mainnet"} yet.</p>
          <Link href="/launchpad/create" className="text-[13px] font-semibold text-primary hover:underline">Launch your first token</Link>
        </Panel>
      ) : (
        <ul className="scrollbar-none -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {items.map((x) => {
            const v = byId.get(x.id)!
            return (
              <li key={x.id} className="snap-start">
                <Link href={`/launchpad/${encodeURIComponent(v.id)}`} className="ds-panel ds-lift flex w-[260px] items-center gap-3 rounded-2xl px-3.5 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                  <LaunchAvatar symbol={v.symbol} iconUrl={v.iconUrl} mint={v.mint} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-semibold text-foreground">{v.name}</span>
                      {devnet && <TestTag />}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">{x.kind === "launched" ? "You launched this" : `${(x.h!.tokens / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })}M $${v.symbol}`}</span>
                  </span>
                  {x.h && (
                    <span className="flex flex-col items-end">
                      <span className="text-[12.5px] font-semibold tabular-nums text-foreground">{tinyPrice(x.h.valueSol < 0.001 ? x.h.valueSol : Number(x.h.valueSol.toFixed(3)), "SOL")}</span>
                      <ChangeText value={x.h.pnlPct} className="text-[11.5px] font-semibold" />
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

const TABS: { key: LaunchpadFeedFilter; label: string }[] = [
  { key: "all", label: "On the curve" },
  { key: "new", label: "New" },
  { key: "near", label: "Near graduation" },
  { key: "graduated", label: "Graduated" },
]

const EMPTY_COPY: Record<LaunchpadFeedFilter, string> = {
  all: "Nothing is on the curve here yet. Be the first to launch.",
  new: "Nothing launched in the last day.",
  near: "No launch is past 75% of its target yet.",
  graduated: "Nothing has graduated here yet.",
}

type View = "grid" | "list"

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div role="group" aria-label="Layout" className="inline-flex rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] p-0.5">
      {([["grid", GridViewIcon, "Grid"], ["list", LeftToRightListBulletIcon, "List"]] as const).map(([key, icon, label]) => (
        <button key={key} type="button" aria-pressed={value === key} aria-label={label} title={label} onClick={() => onChange(key)} className={cn("flex size-8 items-center justify-center rounded-[9px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60", value === key ? "bg-foreground/[0.09] text-foreground" : "text-muted-foreground hover:text-foreground")}>
          <Icon icon={icon} className="size-4" />
        </button>
      ))}
    </div>
  )
}

function Board({ networkId, networkError, stats, statsUnavailable, devnet, now }: { networkId: LaunchpadNetworkId | null; networkError: unknown; stats?: Record<string, LaunchMarketStats>; statsUnavailable: boolean; devnet: boolean; now: number }) {
  const [filter, setFilter] = React.useState<LaunchpadFeedFilter>("all")
  const [sort, setSort] = React.useState<BoardSort>("trending")
  const [window, setWindow] = React.useState<MarketWindow>("1h")
  const [view, setView] = React.useState<View>("grid")
  const [query, setQuery] = React.useState("")
  const feed = useLaunchFeed(networkId, filter)
  // Tab counts only for lists already read; never a fetch just to count.
  const counts = {
    all: useLaunchFeed(networkId, "all", false).data?.length,
    new: useLaunchFeed(networkId, "new", false).data?.length,
    near: useLaunchFeed(networkId, "near", false).data?.length,
    graduated: useLaunchFeed(networkId, "graduated", false).data?.length,
  }
  // Without market data, the market sorts can't be honoured: fall back to newest.
  const effectiveSort: BoardSort = statsUnavailable && sort !== "near" && sort !== "newest" ? "newest" : sort
  const rows: BoardRow[] = React.useMemo(
    () => sortBoard(searchBoard((feed.data ?? []).map((t) => ({ card: cardView(t), stats: stats?.[t.launchId] ?? null })), query), effectiveSort, window),
    [feed.data, stats, query, effectiveSort, window],
  )

  return (
    <section aria-label="Launches" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="border-b border-foreground/[0.06] lg:flex-1">
            <UnderlineTabs
              id="lp-filter"
              className="scrollbar-none overflow-x-auto"
              options={TABS.map((t) => ({
                key: t.key,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {t.label}
                    {counts[t.key] !== undefined && <span className="rounded-md bg-foreground/[0.07] px-1.5 text-[11px] tabular-nums text-muted-foreground">{counts[t.key]}</span>}
                  </span>
                ),
              }))}
              value={filter}
              onChange={setFilter}
            />
          </div>
          <label className="group flex h-10 min-w-0 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 transition-colors focus-within:border-primary/40 lg:mb-2 lg:w-[260px]">
            <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
            <span className="sr-only">Search launches</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ticker or mint address" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70" />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <Icon icon={Cancel01Icon} className="size-4" />
              </button>
            )}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PillTabs
            id="lp-sort"
            size="sm"
            options={BOARD_SORTS.filter((s) => !statsUnavailable || s === "newest" || s === "near").map((s) => ({ key: s, label: BOARD_SORT_LABEL[s] }))}
            value={effectiveSort}
            onChange={setSort}
          />
          <div className="ml-auto flex items-center gap-2">
            {!statsUnavailable && (
              <PillTabs id="lp-window" size="sm" options={MARKET_WINDOWS.map((w) => ({ key: w, label: w }))} value={window} onChange={setWindow} />
            )}
            <ViewToggle value={view} onChange={setView} />
          </div>
        </div>
        {statsUnavailable && <p className="text-[12px] text-muted-foreground">Prices, charts and volume per window are coming soon. Until then the board shows each launch&apos;s curve.</p>}
      </div>

      {networkError ? (
        <Panel className="px-6 py-8 text-center text-[13px] text-debit">{formatWalletActionError(networkError, "solana")}</Panel>
      ) : feed.isLoading || !networkId ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" role="status" aria-label="Loading launches">
          {[0, 1, 2, 3].map((i) => <span key={i} className="skel h-[268px] rounded-[20px]" />)}
        </div>
      ) : feed.error ? (
        <Panel className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-[13px] text-debit">{formatWalletActionError(feed.error, "solana")}</p>
          <button type="button" onClick={() => void feed.refetch()} className="rounded-xl border border-foreground/[0.1] px-4 py-2 text-[13px] font-semibold text-foreground hover:bg-foreground/[0.04]">Try again</button>
        </Panel>
      ) : rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-foreground">{query.trim() ? `Nothing matches “${query.trim()}”` : "No launches"}</p>
          <p className="text-[13px] text-muted-foreground">{query.trim() ? "Try another name, ticker or mint." : EMPTY_COPY[filter]}</p>
        </Panel>
      ) : view === "list" ? (
        <BoardTable rows={rows} now={now} window={window} devnet={devnet} />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((r, i) => (
              <motion.div
                key={r.card.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
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

/* ── How it works ─────────────────────────────────────────────────────── */

function HowItWorks({ target }: { target: number | null }) {
  const steps = [
    { n: "01", title: "Create", body: "Name, ticker, icon and an optional creator allocation, launched in one transaction you sign on this device." },
    { n: "02", title: "Trade on the curve", body: "Anyone can buy or sell from the first second. The price rises as supply is bought — no order book, always liquid." },
    { n: "03", title: "Graduate", body: `At ${target !== null ? `${target.toLocaleString("en-US")} SOL` : "the curve's target"} the curve closes and the raised SOL seeds an open-market pool. Trading continues there.` },
  ]
  return (
    <section id="how-it-works" className="scroll-mt-6">
      <Panel className="p-5 md:p-6">
        <PanelTitle className="mb-4 text-[17px]">How it works</PanelTitle>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.n} className="relative flex flex-col gap-2 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
              <span className="font-display text-[13px] font-semibold tabular-nums text-primary">{s.n}</span>
              <span className="text-[15px] font-semibold text-foreground">{s.title}</span>
              <span className="text-[12.5px] leading-relaxed text-muted-foreground">{s.body}</span>
              {i < steps.length - 1 && (
                <span aria-hidden className="absolute -right-2.5 top-1/2 z-10 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/[0.08] bg-card text-primary md:flex">
                  <Icon icon={ArrowRight02Icon} className="size-3" strokeWidth={2.2} />
                </span>
              )}
            </li>
          ))}
        </ol>
      </Panel>
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
  const onCurve = useLaunchFeed(networkId, "all")
  const graduated = useLaunchFeed(networkId, "graduated")
  const stats = useLaunchStats(networkId)
  const statsUnavailable = Boolean(stats.error)

  const onCurveCards = React.useMemo(() => onCurve.data?.map(cardView), [onCurve.data])
  const graduatedCards = React.useMemo(() => graduated.data?.map(cardView), [graduated.data])
  const byId = React.useMemo(() => new Map([...(onCurveCards ?? []), ...(graduatedCards ?? [])].map((v) => [v.id, v])), [onCurveCards, graduatedCards])
  const top = React.useMemo(() => [...(onCurveCards ?? [])].filter((v) => v.status === "live").sort((a, b) => b.progressBps - a.progressBps)[0] ?? null, [onCurveCards])
  const target = [...(onCurveCards ?? []), ...(graduatedCards ?? [])].find((v) => v.graduationSol !== null)?.graduationSol ?? null

  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-5 p-4 md:gap-6 md:p-6">
      <PausedNotice availability={availability.data} />
      <Rise>
        <Header paused={paused} network={network} availability={availability.data} />
      </Rise>
      {devnet && (
        <p role="note" className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/[0.07] px-4 py-2.5 text-[12.5px] text-foreground/85">
          <TestTag />
          You&apos;re on devnet. These are test tokens: they have no value and can&apos;t be moved to mainnet.
        </p>
      )}
      <Rise delay={40}>
        <NetworkStats onCurve={onCurveCards} graduated={graduatedCards} stats={statsUnavailable ? undefined : stats.data} />
      </Rise>
      <Rise delay={80}>
        <Spotlight top={top} stats={top ? stats.data?.[top.id] ?? null : null} devnet={devnet} now={now} />
      </Rise>
      <Rise delay={110}>
        <YourLaunches networkId={networkId} byId={byId} devnet={devnet} />
      </Rise>
      <Rise delay={140}>
        <Board key={networkId ?? "none"} networkId={networkId} networkError={network.error} stats={stats.data} statsUnavailable={statsUnavailable} devnet={devnet} now={now} />
      </Rise>
      <Rise delay={170}>
        <HowItWorks target={target} />
      </Rise>
    </DashScope>
  )
}
