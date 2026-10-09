"use client"

/**
 * The preview's launchpad discovery (components/launchpad-unauth/discovery.tsx)
 * on the real feed: hero, spotlight, the filterable grid, and how it works.
 *
 * Every launch is a real one from GET /launchpad/tokens (the same per-filter
 * query and key the old page used, refreshed every 30s), on the network the
 * viewer picked (the old devnet/mainnet switch, now in the hero).
 *
 * Swapped for real data:
 *  · the hero's three figures are summed from the "On the curve" and
 *    "Graduated" lists (the second is read for the hero even on another tab);
 *  · the graduation target and SOL raised are each curve's own figures;
 *  · price and market cap aren't in the feed, so the card shows "—" there and
 *    the grid has no "Cap" sort (the preview's third sort is left out);
 *  · tab counts appear for lists that have been read; the others show none
 *    rather than a guess;
 *  · "How it works" drops the preview's assumed fee figure.
 * Kept from the old page: the network switch, the devnet warning, the pause
 * notice and the paused launch button, loading, error and empty states.
 * Not carried over: the reviewer-only "Preview controls" panel.
 */

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight02Icon, Cancel01Icon, Rocket01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { LaunchpadFeedFilter, LaunchpadNetworkId } from "@/lib/crypto-backend/types"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { Icon, Panel, PanelTitle, PillTabs, UnderlineTabs } from "@/components/dashboard/redesign/ui"
import { DashScope } from "@/components/dash"
import { Rise } from "@/components/ui/system"
import { agoFrom, cardView, heroStats, progressLabel, sortAndSearch, spotlightOf, type LaunchCardView, type LaunchSort } from "@/lib/launchpad-view"
import { isDevnet, NetworkSwitch, useLaunchNetwork } from "../network"
import { ChainChips, LaunchAvatar, PausedNotice, ProgressBar, StatusPill, useLaunchAvailability } from "./ui"

const NEAR_BPS = 7500

function useFeed(networkId: LaunchpadNetworkId | null, filter: LaunchpadFeedFilter, enabled = true) {
  return useQuery({
    queryKey: ["launchpad", "feed", networkId, filter],
    queryFn: ({ signal }) => cryptoBackendClient.listLaunchpadTokens(networkId!, filter, signal),
    enabled: enabled && isCryptoBackendEnabled && Boolean(networkId),
    refetchInterval: 30_000,
    select: (rows) => rows.map(cardView),
  })
}

function useNow() {
  const [now, setNow] = React.useState(0)
  React.useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/* ── Hero ─────────────────────────────────────────────────────────────── */

function HeroCurve() {
  const pts = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39
    return `${(t * 320).toFixed(1)},${(150 - Math.pow(t, 1.9) * 130).toFixed(1)}`
  })
  return (
    <svg viewBox="0 0 320 160" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="hero-curve-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,160 ${pts.join(" ")} 320,160`} fill="url(#hero-curve-fill)" />
      <motion.polyline points={pts.join(" ")} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }} />
      <line x1="300" y1="0" x2="300" y2="160" stroke="var(--credit)" strokeDasharray="3 4" opacity="0.6" />
      <text x="296" y="14" textAnchor="end" className="fill-credit text-[10px] font-semibold">
        Graduation
      </text>
      <motion.circle cx="190" cy={150 - Math.pow(190 / 320, 1.9) * 130} r="5" className="fill-primary" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 }} />
    </svg>
  )
}

function DiscoveryHero({
  paused,
  stats,
  target,
  network,
  availability,
}: {
  paused: boolean
  stats: ReturnType<typeof heroStats>
  target: number | null
  network: ReturnType<typeof useLaunchNetwork>
  availability: ReturnType<typeof useLaunchAvailability>["data"]
}) {
  const fig = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: n < 10 ? 2 : 0 }))
  return (
    <Panel className="relative">
      <div aria-hidden className="absolute -right-24 -top-24 size-[420px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_12%,transparent),transparent)]" />
      <div className="relative grid grid-cols-1 gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <NetworkSwitch networks={network.networks} networkId={network.networkId} onChange={network.setNetworkId} />
            <ChainChips availability={availability} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[32px] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground md:text-[40px]">
              Launch a token in a minute.
              <br />
              <span className="text-primary">Trade it from the first second.</span>
            </h1>
            <p className="max-w-[52ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Every token starts on a bonding curve — the price rises as people buy. When the curve raises {target !== null ? `${fig(target)} SOL` : "its target"} it graduates to the open market with liquidity seeded automatically.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {paused ? (
              <span aria-disabled="true" className="flex h-12 items-center rounded-xl border border-warning/30 bg-warning/[0.08] px-5 text-[14px] font-semibold text-warning">
                Launches paused
              </span>
            ) : (
              <Link href="/launchpad/create" className="ds-gold group flex h-12 items-center gap-2 rounded-xl px-5 text-[14.5px] font-semibold">
                <Icon icon={Rocket01Icon} className="size-[18px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
                Launch a token
              </Link>
            )}
            <a href="#how-it-works" className="flex h-12 items-center rounded-xl border border-foreground/[0.09] px-5 text-[14px] font-semibold text-foreground/85 transition-colors hover:border-foreground/[0.16] hover:text-foreground">
              How it works
            </a>
          </div>
          <dl className="grid max-w-[460px] grid-cols-3 gap-px overflow-hidden rounded-2xl border border-foreground/[0.06] bg-foreground/[0.06]">
            {[
              { k: "On the curve", v: fig(stats.onCurve) },
              { k: "SOL raised", v: fig(stats.solRaised) },
              { k: "Graduated", v: fig(stats.graduated) },
            ].map((s) => (
              <div key={s.k} className="flex flex-col gap-0.5 bg-card px-4 py-3 dark:bg-[color-mix(in_oklab,var(--card)_55%,var(--background))]">
                <dd className="font-display text-[20px] font-semibold tabular-nums text-foreground">{s.v}</dd>
                <dt className="text-[11.5px] text-muted-foreground">{s.k}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="hidden h-[240px] lg:block">
          <HeroCurve />
        </div>
      </div>
    </Panel>
  )
}

/* ── Spotlight ────────────────────────────────────────────────────────── */

function Spotlight({ top }: { top: LaunchCardView | null }) {
  if (!top) return null
  return (
    <Link href={`/launchpad/${encodeURIComponent(top.id)}`} className="group block">
      <Panel className="ds-lift relative">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(80%_120%_at_0%_50%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_60%)]" />
        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:gap-8 md:p-6">
          <div className="flex items-center gap-4">
            <LaunchAvatar symbol={top.symbol} iconUrl={top.iconUrl} mint={top.mint} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Closest to graduation</span>
              <span className="font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">
                {top.name} <span className="text-muted-foreground">${top.symbol}</span>
              </span>
              {top.description && <span className="line-clamp-1 text-[13px] text-muted-foreground">{top.description}</span>}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="font-semibold tabular-nums text-foreground">
                {top.solRaised === null ? "—" : top.solRaised.toFixed(1)} <span className="font-medium text-muted-foreground">of {top.graduationSol === null ? "—" : top.graduationSol.toLocaleString("en-US")} SOL</span>
              </span>
              <span className="font-display text-[18px] font-semibold tabular-nums text-primary">{progressLabel(top.progressBps, top.status)}</span>
            </div>
            <ProgressBar bps={top.progressBps} status={top.status} size="lg" />
            <span className="text-[12px] text-muted-foreground">{top.remainingSol === null ? "—" : `${top.remainingSol.toFixed(1)} SOL`} to go</span>
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

/* ── Card ─────────────────────────────────────────────────────────────── */

/** One launch as the feed shows it. `preview` draws it without a link — the
 *  create flow's "how buyers will see it". */
export function LaunchCard({ v, now, preview = false }: { v: LaunchCardView; now: number; preview?: boolean }) {
  const live = v.status === "live"
  const pct = live ? v.progressBps / 100 : 100
  const body = (
      <Panel as="article" className={cn("flex h-full flex-col", !preview && "ds-lift group-hover:border-foreground/[0.13]")}>
        <div className="flex items-start gap-3 p-4 pb-3">
          <LaunchAvatar symbol={v.symbol} iconUrl={v.iconUrl} mint={v.mint} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate font-display text-[16px] font-semibold leading-tight text-foreground">{v.name}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground/80">${v.symbol}</span>
              {(() => {
                const when = preview && !v.mint ? "Not launched" : agoFrom(v.createdAt, now)
                return when ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{when}</span>
                  </>
                ) : null
              })()}
            </span>
            {!live && <StatusPill status={v.status} raw={v.rawStatus} className="mt-0.5 w-fit" />}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5" title="Market cap needs a per-token price, which the feed doesn't serve yet">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Mkt cap</span>
            <span className="font-display text-[17px] font-semibold tabular-nums text-foreground">—</span>
          </div>
        </div>

        <p className="line-clamp-2 min-h-[2.8em] px-4 text-[13px] leading-[1.4] text-muted-foreground">{v.description ?? " "}</p>

        <div className="mt-auto flex flex-col gap-2 px-4 pb-4 pt-4">
          <div className="flex items-end justify-between gap-2">
            <span className={cn("font-display text-[22px] font-semibold leading-none tabular-nums", !live ? "text-credit" : pct >= NEAR_BPS / 100 ? "text-primary" : "text-foreground")}>
              {live ? `${pct.toFixed(pct < 10 ? 1 : 0)}%` : v.status === "graduating" ? "Full" : v.status === "graduated" ? "Graduated" : "—"}
            </span>
            <span className="text-[12px] tabular-nums text-muted-foreground">
              {live ? (
                <>
                  <span className="font-semibold text-foreground/85">{v.solRaised === null ? "—" : v.solRaised.toFixed(1)}</span> / {v.graduationSol === null ? "—" : v.graduationSol.toLocaleString("en-US")} SOL
                </>
              ) : v.status === "graduated" ? (
                "On the open market"
              ) : (
                " "
              )}
            </span>
          </div>
          <ProgressBar bps={v.progressBps} status={v.status} />
        </div>

        <dl className="grid grid-cols-3 divide-x divide-foreground/[0.05] border-t border-foreground/[0.06] bg-foreground/[0.015] text-[12px]">
          <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5" title="A per-token price needs the curve read, which the feed doesn't carry">
            <dt className="text-[10.5px] text-muted-foreground">Price</dt>
            <dd className="truncate font-semibold tabular-nums text-foreground">—</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5" title="Share of curve supply the creator bought at launch">
            <dt className="text-[10.5px] text-muted-foreground">Creator</dt>
            <dd className={cn("font-semibold tabular-nums", v.creatorBps >= 1000 ? "text-warning" : "text-foreground")}>{(v.creatorBps / 100).toFixed(1)}%</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5" title={v.mint ?? "Assigned at launch"}>
            <dt className="text-[10.5px] text-muted-foreground">Mint</dt>
            <dd className="truncate font-mono text-[11.5px] text-foreground/85">{v.mint ? `${v.mint.slice(0, 4)}…${v.mint.slice(-4)}` : "At launch"}</dd>
          </div>
        </dl>
      </Panel>
  )
  if (preview) return body
  return (
    <Link href={`/launchpad/${encodeURIComponent(v.id)}`} className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      {body}
    </Link>
  )
}

/* ── Browser ──────────────────────────────────────────────────────────── */

const TABS: { key: LaunchpadFeedFilter; label: string }[] = [
  { key: "all", label: "On the curve" },
  { key: "near", label: "Near graduation" },
  { key: "new", label: "New" },
  { key: "graduated", label: "Graduated" },
]

const EMPTY_COPY: Record<LaunchpadFeedFilter, string> = {
  all: "Nothing is on the curve here yet. Be the first to launch.",
  new: "No new launches yet.",
  near: "No launch is past 75% of its target yet.",
  graduated: "Nothing has graduated here yet.",
}

function LaunchBrowser({ networkId, networkError }: { networkId: LaunchpadNetworkId | null; networkError: unknown }) {
  const [filter, setFilter] = React.useState<LaunchpadFeedFilter>("all")
  const [sort, setSort] = React.useState<LaunchSort>("progress")
  const [query, setQuery] = React.useState("")
  const now = useNow()
  const feed = useFeed(networkId, filter)
  // Counts for lists already read; never a fetch just to count.
  const counts = {
    all: useFeed(networkId, "all", false).data?.length,
    near: useFeed(networkId, "near", false).data?.length,
    new: useFeed(networkId, "new", false).data?.length,
    graduated: useFeed(networkId, "graduated", false).data?.length,
  }
  const rows = sortAndSearch(feed.data ?? [], query, sort)

  return (
    <div className="flex flex-col gap-4">
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
        <div className="flex items-center gap-2.5 lg:pb-2">
          <label className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-foreground/[0.07] bg-foreground/[0.025] px-3.5 transition-colors focus-within:border-primary/40 lg:w-[240px] lg:flex-none">
            <Icon icon={Search01Icon} className="size-4 text-muted-foreground group-focus-within:text-primary" />
            <span className="sr-only">Search launches</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ticker" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/70" />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                <Icon icon={Cancel01Icon} className="size-4" />
              </button>
            )}
          </label>
          <PillTabs
            id="lp-sort"
            size="sm"
            options={[
              { key: "progress", label: "Progress" },
              { key: "newest", label: "Newest" },
            ]}
            value={sort}
            onChange={setSort}
          />
        </div>
      </div>

      {networkError ? (
        <Panel className="px-6 py-8 text-center text-[13px] text-debit">{formatWalletActionError(networkError, "solana")}</Panel>
      ) : feed.isLoading || !networkId ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Loading launches">
          {[0, 1, 2].map((i) => (
            <span key={i} className="skel h-[250px] rounded-[20px]" />
          ))}
        </div>
      ) : feed.error ? (
        <Panel className="px-6 py-8 text-center text-[13px] text-debit">{formatWalletActionError(feed.error, "solana")}</Panel>
      ) : rows.length === 0 ? (
        <Panel className="flex flex-col items-center gap-1 px-6 py-16 text-center">
          <p className="text-[14px] font-semibold text-foreground">{query.trim() ? `Nothing matches “${query.trim()}”` : "No launches"}</p>
          <p className="text-[13px] text-muted-foreground">{query.trim() ? "Try another name or ticker." : EMPTY_COPY[filter]}</p>
        </Panel>
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((v, i) => (
              <motion.div
                key={v.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
              >
                <LaunchCard v={v} now={now} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
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
  const availability = useLaunchAvailability()
  const paused = availability.data?.solana.state === "paused"
  const onCurve = useFeed(networkId, "all")
  const graduated = useFeed(networkId, "graduated")
  const stats = heroStats(onCurve.data, graduated.data)
  const target = [...(onCurve.data ?? []), ...(graduated.data ?? [])].find((v) => v.graduationSol !== null)?.graduationSol ?? null

  return (
    <DashScope className="ws-icon-mono [&_button:not(:disabled)]:cursor-pointer mx-auto flex w-full max-w-[1720px] flex-col gap-4 p-4 md:gap-5 md:p-6">
      <PausedNotice availability={availability.data} />
      {isDevnet(networkId) && (
        <p className="rounded-2xl border border-warning/25 bg-warning/[0.06] px-4 py-2.5 text-[12.5px] text-foreground/80">You&apos;re viewing devnet: test tokens with no value.</p>
      )}
      <Rise>
        <DiscoveryHero paused={paused} stats={stats} target={target} network={network} availability={availability.data} />
      </Rise>
      <Rise delay={60}>
        <Spotlight top={spotlightOf(onCurve.data)} />
      </Rise>
      <Rise delay={120}>
        <LaunchBrowser networkId={networkId} networkError={network.error} />
      </Rise>
      <Rise delay={160}>
        <HowItWorks target={target} />
      </Rise>
    </DashScope>
  )
}
