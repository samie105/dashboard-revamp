"use client"

/**
 * The launchpad board's pieces, pump.fun style:
 *  · TradeTicker: the network's latest trades scrolling across the top;
 *  · KingOfTheHill: the live launch closest to graduating, big;
 *  · LaunchCard: one launch, art first: market cap, change over the chosen
 *    window, the curve's progress, the description.
 * Market figures are optional: without them (not served yet) the card falls
 * back to the launch's own curve data and leaves the figure out rather than
 * guessing. Devnet launches carry a TEST tag everywhere they appear.
 */

import * as React from "react"
import Link from "next/link"
import { ArrowRight02Icon, Crown02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/dashboard/redesign/ui"
import type { LaunchCardView } from "@/lib/launchpad-view"
import { agoFrom, progressLabel } from "@/lib/launchpad-view"
import type { LaunchActivity, LaunchMarketStats, MarketWindow } from "@/lib/launchpad-market/types"
import { buyShare, compactCount, compactUsd, signedPct } from "@/lib/launchpad-market/view"
import { cn } from "@/lib/utils"
import { LaunchArt, LaunchAvatar, ProgressBar, StatusPill } from "./ui"

/** The devnet marker: test tokens with no value must never pass for real ones. */
export function TestTag({ className }: { className?: string }) {
  return (
    <span title="Devnet test token. It has no value." className={cn("inline-flex shrink-0 items-center rounded-md border border-warning/35 bg-warning/[0.1] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.08em] text-warning", className)}>
      Test
    </span>
  )
}

export function ChangeText({ value, className }: { value: number | null | undefined; className?: string }) {
  const up = (value ?? 0) > 0
  const down = (value ?? 0) < 0
  return <span className={cn("tabular-nums", up ? "text-credit" : down ? "text-debit" : "text-muted-foreground", className)}>{signedPct(value)}</span>
}

/** Buys vs sells as one split bar, with counts. */
export function BuySellBar({ txns, className }: { txns: { buys: number; sells: number }; className?: string }) {
  const share = buyShare(txns)
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-debit/60" role="img" aria-label={`${txns.buys} buys, ${txns.sells} sells`}>
        <span className="h-full bg-credit" style={{ width: `${share}%` }} />
      </div>
      <div className="flex justify-between text-[10.5px] tabular-nums">
        <span className="text-credit">{compactCount(txns.buys)} buys</span>
        <span className="text-debit">{compactCount(txns.sells)} sells</span>
      </div>
    </div>
  )
}

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`
const tokenHref = (id: string) => `/launchpad/${encodeURIComponent(id)}`

/* ── Live trades ticker ───────────────────────────────────────────────── */

function TickerItem({ t }: { t: LaunchActivity }) {
  const buy = t.side === "buy"
  return (
    <Link href={tokenHref(t.launchId)} className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-primary/50">
      <LaunchAvatar symbol={t.symbol} iconUrl={t.iconUrl} mint={t.mint} size="xs" />
      <span className={cn("font-mono text-[11.5px]", t.traderLabel === "You" ? "font-sans font-semibold text-primary" : "text-muted-foreground")}>{t.traderLabel}</span>
      <span className={cn("font-semibold", buy ? "text-credit" : "text-debit")}>{buy ? "bought" : "sold"}</span>
      <span className="font-semibold tabular-nums text-foreground">{t.solAmount.toFixed(2)} SOL</span>
      <span className="text-muted-foreground">of</span>
      <span className="font-semibold text-foreground">${t.symbol}</span>
    </Link>
  )
}

/**
 * The network's latest trades, scrolling. Uses the markets ticker's CSS loop
 * (globals.css .ws-ticker): the row is rendered twice and the track slides
 * one copy's width; it pauses on hover/focus and stops under reduced motion.
 */
export function TradeTicker({ trades, loading }: { trades: LaunchActivity[] | undefined; loading: boolean }) {
  if (loading) return <span className="skel block h-[42px] rounded-full" role="status" aria-label="Loading live trades" />
  if (!trades || trades.length === 0) return null
  const row = trades.map((t) => <TickerItem key={t.id} t={t} />)
  return (
    <section aria-label="Live trades" className="ws-ticker scrollbar-none relative flex items-center overflow-hidden rounded-full border border-foreground/[0.06] bg-foreground/[0.02]">
      <span className="relative z-10 flex shrink-0 items-center gap-1.5 self-stretch border-r border-foreground/[0.06] bg-card pl-3.5 pr-3 text-[11px] font-bold uppercase tracking-[0.1em] text-credit dark:bg-[color-mix(in_oklab,var(--card)_55%,var(--background))]">
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-credit/60" />
          <span className="relative size-2 rounded-full bg-credit" />
        </span>
        Live
      </span>
      <div className="ws-ticker-track flex w-max py-0.5" style={{ "--ticker-duration": `${Math.max(30, trades.length * 3.5)}s` } as React.CSSProperties}>
        <div className="flex">{row}</div>
        <div className="flex" aria-hidden>{trades.map((t) => <TickerItem key={`dup-${t.id}`} t={t} />)}</div>
      </div>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </section>
  )
}

/* ── King of the hill ─────────────────────────────────────────────────── */

export function KingOfTheHill({ v, stats, devnet, now }: { v: LaunchCardView; stats: LaunchMarketStats | null; devnet: boolean; now: number }) {
  return (
    <Link href={tokenHref(v.id)} className="group block rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`King of the hill: ${v.name} (${v.symbol})`}>
      <article className="ds-panel ds-lift relative overflow-hidden rounded-[24px] transition-colors group-hover:border-primary/30">
        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
          <LaunchArt v={v} className="aspect-square w-24 shrink-0 self-start rounded-[16px] sm:w-[176px] sm:rounded-[18px]" />
          {/* Three groups, 16 apart: who it is · what it is · how far it's got. */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-primary">
                  <Icon icon={Crown02Icon} className="size-4" strokeWidth={2} />
                  King of the hill
                </span>
                <span className="hidden items-center gap-1.5 text-[13px] font-semibold text-primary sm:flex">
                  Trade ${v.symbol}
                  <Icon icon={ArrowRight02Icon} className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </span>
              </div>
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="truncate font-display text-[26px] font-semibold leading-none tracking-[-0.03em] text-foreground md:text-[30px]">{v.name}</h2>
                <span className="font-display text-[18px] font-semibold leading-none text-muted-foreground">${v.symbol}</span>
                {devnet && <TestTag className="self-center" />}
              </div>
              <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
                {v.creator && (
                  <span>
                    by <span className="font-mono text-[11.5px] text-foreground/80">{short(v.creator)}</span>
                  </span>
                )}
                {v.creator && agoFrom(v.createdAt, now) && <span aria-hidden>·</span>}
                {agoFrom(v.createdAt, now) && <span>{agoFrom(v.createdAt, now)}</span>}
              </p>
            </div>
            {v.description && <p className="line-clamp-2 max-w-[68ch] text-[13.5px] leading-relaxed text-foreground/75">{v.description}</p>}
            <div className="mt-auto flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                {stats ? (
                  <span className="flex items-baseline gap-2">
                    <span className="text-[12.5px] text-muted-foreground">Market cap</span>
                    <span className="font-display text-[22px] font-semibold leading-none tabular-nums text-foreground">{compactUsd(stats.marketCapUsd)}</span>
                    <ChangeText value={stats.changePct["24h"]} className="text-[13px] font-semibold" />
                  </span>
                ) : (
                  <span className="text-[12.5px] text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{v.solRaised === null ? "—" : v.solRaised.toFixed(1)}</span> of {v.graduationSol === null ? "—" : v.graduationSol.toLocaleString("en-US")} SOL raised
                  </span>
                )}
                <span className="flex items-baseline gap-1.5 text-[12.5px] text-muted-foreground">
                  <span className="font-display text-[17px] font-semibold leading-none tabular-nums text-primary">{progressLabel(v.progressBps, v.status)}</span>
                  to graduation
                </span>
              </div>
              <ProgressBar bps={v.progressBps} status={v.status} size="lg" />
            </div>
          </div>
        </div>
      </article>
    </Link>
  )
}

/* ── The card ─────────────────────────────────────────────────────────── */

/**
 * One launch, art first. `stats`/`window` add the market; `preview` draws it
 * without a link (the create flow's "how buyers will see it").
 */
export function LaunchCard({ v, now, preview = false, stats, window = "24h", devnet = false }: { v: LaunchCardView; now: number; preview?: boolean; stats?: LaunchMarketStats | null; window?: MarketWindow; devnet?: boolean }) {
  const live = v.status === "live"
  const when = preview && !v.mint ? "Not launched" : agoFrom(v.createdAt, now)
  const change = stats?.changePct[window]
  const body = (
    <article className={cn("ds-panel flex h-full flex-col overflow-hidden rounded-[20px]", !preview && "transition-[border-color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/[0.16]")}>
      <div className="relative">
        <LaunchArt v={v} className="aspect-[5/4] w-full" zoom={!preview} />
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          <span className="flex gap-1">
            {devnet && <TestTag className="border-warning/50 bg-black/60 backdrop-blur" />}
            {!live && <StatusPill status={v.status} raw={v.rawStatus} className="bg-black/60 text-white backdrop-blur" />}
          </span>
          {when && <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white/90 backdrop-blur">{when}</span>}
        </div>
        {change !== undefined && change !== null && (
          <span className={cn("absolute bottom-2.5 right-2.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums text-white backdrop-blur", change >= 0 ? "bg-credit/85" : "bg-debit/85")}>
            {signedPct(change)} <span className="font-semibold opacity-80">{window}</span>
          </span>
        )}
      </div>

      {/* Three groups, 12 apart: who it is · its market · what it is. */}
      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-display text-[15px] font-semibold leading-tight text-foreground">{v.name}</span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-none text-muted-foreground">
            <span className="font-semibold text-foreground/75">${v.symbol}</span>
            {v.creator && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate font-mono text-[11px]">{short(v.creator)}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            {stats ? (
              <span className="text-[11.5px] text-muted-foreground">
                MC <span className="font-display text-[15px] font-semibold tabular-nums text-foreground">{compactUsd(stats.marketCapUsd)}</span>
              </span>
            ) : live ? (
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground/85">{v.solRaised === null ? "—" : v.solRaised.toFixed(1)}</span> / {v.graduationSol === null ? "—" : v.graduationSol.toLocaleString("en-US")} SOL
              </span>
            ) : (
              <span className="text-[11.5px] text-muted-foreground">{v.status === "graduated" ? "On the open market" : "Curve full"}</span>
            )}
            {stats && <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">{compactCount(stats.holders)} holders</span>}
          </div>
          <div className="flex items-center gap-2">
            <ProgressBar bps={v.progressBps} status={v.status} size="sm" className="flex-1" />
            <span className={cn("min-w-[2.8em] text-right text-[11px] font-semibold tabular-nums", !live ? "text-credit" : v.progressBps >= 7500 ? "text-primary" : "text-muted-foreground")}>{progressLabel(v.progressBps, v.status)}</span>
          </div>
        </div>

        {/* Two lines reserved, so cards in a row end on the same line. */}
        <p className="line-clamp-2 min-h-[calc(2.9em+0.75rem+1px)] border-t border-foreground/[0.06] pt-3 text-[12px] leading-[1.45] text-muted-foreground">{v.description ?? ""}</p>
      </div>
    </article>
  )
  return preview ? (
    body
  ) : (
    <Link href={tokenHref(v.id)} className="group block h-full rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label={`${v.name} (${v.symbol})`}>
      {body}
    </Link>
  )
}
