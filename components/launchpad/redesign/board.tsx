"use client"

/**
 * The launchpad board's pieces: a token card (grid) and a token row (list),
 * both showing the market for the chosen rolling window: mini chart, price,
 * change, market cap, volume, buys vs sells, holders, and the curve's
 * progress. Market figures are optional: without them (not served yet) the
 * card falls back to the launch's own curve data and shows "—", never a
 * guess. Devnet launches carry a TEST tag everywhere they appear.
 */

import * as React from "react"
import Link from "next/link"

import { Spark } from "@/components/dashboard/redesign/ui"
import type { LaunchCardView } from "@/lib/launchpad-view"
import { agoFrom, progressLabel } from "@/lib/launchpad-view"
import type { LaunchMarketStats, MarketWindow } from "@/lib/launchpad-market/types"
import { buyShare, compactCount, compactUsd, signedPct, tinyPrice } from "@/lib/launchpad-market/view"
import { cn } from "@/lib/utils"
import { LaunchAvatar, ProgressBar, StatusPill } from "./ui"

const NEAR_BPS = 7500

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

function Stat({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={title}>
      <dt className="text-[10.5px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-[12.5px] font-semibold tabular-nums text-foreground">{children}</dd>
    </div>
  )
}

function linkTo(v: LaunchCardView, href: string, children: React.ReactNode, className?: string) {
  return (
    <Link href={href} className={cn("group block rounded-[20px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50", className)} aria-label={`${v.name} (${v.symbol})`}>
      {children}
    </Link>
  )
}

/**
 * One launch as a card. `stats`/`window` add the market; `preview` draws it
 * without a link (the create flow's "how buyers will see it").
 */
export function LaunchCard({ v, now, preview = false, stats, window = "24h", devnet = false }: { v: LaunchCardView; now: number; preview?: boolean; stats?: LaunchMarketStats | null; window?: MarketWindow; devnet?: boolean }) {
  const live = v.status === "live"
  const pct = live ? v.progressBps / 100 : 100
  const spark = stats?.spark[window] ?? []
  const when = preview && !v.mint ? "Not launched" : agoFrom(v.createdAt, now)
  const body = (
    <article className={cn("ds-panel flex h-full flex-col overflow-hidden rounded-[20px]", !preview && "ds-lift transition-colors group-hover:border-foreground/[0.14]")}>
      <div className="flex items-start gap-3 p-4 pb-2">
        <LaunchAvatar symbol={v.symbol} iconUrl={v.iconUrl} mint={v.mint} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-display text-[15.5px] font-semibold leading-tight text-foreground">{v.name}</span>
            {devnet && <TestTag />}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground/80">${v.symbol}</span>
            {when && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{when}</span>
              </>
            )}
          </span>
          {!live && <StatusPill status={v.status} raw={v.rawStatus} className="mt-1 w-fit" />}
        </div>
        {/* Market cap and change only when there's market data: no placeholder dashes. */}
        {stats && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="font-display text-[16px] font-semibold tabular-nums text-foreground" title="Market cap">{compactUsd(stats.marketCapUsd)}</span>
            <ChangeText value={stats.changePct[window]} className="text-[12px] font-semibold" />
          </div>
        )}
      </div>

      {/* The window's price, as a mini chart. Without market data: the description. */}
      {spark.length > 1 ? (
        <div className="px-4 pt-1">
          <Spark points={spark} width={240} height={46} fluid />
        </div>
      ) : (
        <p className="line-clamp-2 min-h-[2.8em] px-4 pt-1 text-[12.5px] leading-[1.4] text-muted-foreground">{v.description ?? " "}</p>
      )}

      <div className="flex flex-col gap-1.5 px-4 pb-3 pt-3">
        <div className="flex items-end justify-between gap-2 text-[12px]">
          <span className={cn("font-display text-[15px] font-semibold leading-none tabular-nums", !live ? "text-credit" : pct >= NEAR_BPS / 100 ? "text-primary" : "text-foreground")}>
            {live ? progressLabel(v.progressBps, v.status) : v.status === "graduating" ? "Full" : v.status === "graduated" ? "Graduated" : "—"}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {live ? (
              <>
                <span className="font-semibold text-foreground/85">{v.solRaised === null ? "—" : v.solRaised.toFixed(1)}</span> / {v.graduationSol === null ? "—" : v.graduationSol.toLocaleString("en-US")} SOL
              </>
            ) : v.status === "graduated" ? (
              "Trading on the open market"
            ) : (
              " "
            )}
          </span>
        </div>
        <ProgressBar bps={v.progressBps} status={v.status} size="sm" />
      </div>

      {stats ? (
        <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-foreground/[0.06] bg-foreground/[0.015] px-4 py-2.5">
          <Stat label="Price" title={`${stats.priceSol} SOL`}>{tinyPrice(stats.priceSol)}</Stat>
          <Stat label={`Vol ${window}`}>{compactUsd(stats.volumeUsd[window])}</Stat>
          <Stat label="Holders">{compactCount(stats.holders)}</Stat>
        </dl>
      ) : (
        // Without market data: what the launch itself states.
        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-foreground/[0.06] bg-foreground/[0.015] px-4 py-2.5">
          <Stat label="Creator" title="Share of curve supply the creator bought at launch">{(v.creatorBps / 100).toFixed(1)}%</Stat>
          <Stat label="Mint" title={v.mint ?? "Assigned at launch"}>{v.mint ? `${v.mint.slice(0, 4)}…${v.mint.slice(-4)}` : "At launch"}</Stat>
        </dl>
      )}
    </article>
  )
  return preview ? body : linkTo(v, `/launchpad/${encodeURIComponent(v.id)}`, body, "h-full")
}

/** The list view: one dense row per launch, for scanning many tokens. */
export function BoardTable({ rows, now, window, devnet }: { rows: { card: LaunchCardView; stats: LaunchMarketStats | null }[]; now: number; window: MarketWindow; devnet: boolean }) {
  return (
    <div className="ds-panel overflow-hidden rounded-[20px]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px] tabular-nums">
          <thead className="text-[11.5px] text-muted-foreground">
            <tr className="border-b border-foreground/[0.06]">
              <th scope="col" className="px-4 py-3 text-left font-medium">Token</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Price</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">{window}</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Chart</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Mkt cap</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Vol {window}</th>
              <th scope="col" className="w-[140px] px-3 py-3 text-left font-medium">Buys / sells</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Holders</th>
              <th scope="col" className="w-[150px] px-4 py-3 text-left font-medium">Curve</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ card: v, stats }) => (
              <tr key={v.id} className="relative border-b border-foreground/[0.04] transition-colors last:border-0 hover:bg-foreground/[0.025]">
                <td className="px-4 py-2.5">
                  <Link href={`/launchpad/${encodeURIComponent(v.id)}`} className="flex min-w-0 items-center gap-2.5 outline-none after:absolute after:inset-0 focus-visible:underline">
                    <LaunchAvatar symbol={v.symbol} iconUrl={v.iconUrl} mint={v.mint} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-semibold text-foreground">{v.name}</span>
                        {devnet && <TestTag />}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">${v.symbol} · {agoFrom(v.createdAt, now) || "—"}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-foreground">{tinyPrice(stats?.priceSol)}</td>
                <td className="px-3 py-2.5 text-right font-semibold"><ChangeText value={stats?.changePct[window]} /></td>
                <td className="px-3 py-2.5">{stats && stats.spark[window].length > 1 ? <Spark points={stats.spark[window]} width={84} height={26} /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{compactUsd(stats?.marketCapUsd)}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{compactUsd(stats?.volumeUsd[window])}</td>
                <td className="px-3 py-2.5">{stats ? <BuySellBar txns={stats.txns[window]} /> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{compactCount(stats?.holders)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11.5px] font-semibold text-foreground">{v.status === "live" ? progressLabel(v.progressBps, v.status) : v.status === "graduated" ? "Graduated" : v.status === "graduating" ? "Full" : "—"}</span>
                    <ProgressBar bps={v.progressBps} status={v.status} size="sm" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
