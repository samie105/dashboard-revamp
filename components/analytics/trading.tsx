"use client"

/**
 * The Trading tab: futures results from the account's own fills, and the
 * stop-loss / take-profit orders resting against what's open.
 *
 * Every figure is lib/trading-analytics.ts over what useAnalyticsData hands
 * in. "How positions closed" needs an exit reason per close, which no route
 * serves yet: live, it shows as coming soon; the dev sample data fills it in
 * so the design can be seen.
 */

import * as React from "react"
import { ArrowDataTransferHorizontalIcon, ChartLineData01Icon, CoinsDollarIcon, Target02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { EmptyPanel, ErrorPanel, NeutralLink, SkeletonBlock, UnavailableState } from "@/components/dash"
import { Figure, Panel } from "@/components/dashboard/redesign/ui"
import { Rise } from "@/components/ui/system"
import { RANGE_NOUN, SectionPanel, Tile, TilesSkeleton, plural } from "@/components/analytics/parts"
import { SegmentBar, compactUsd, usd } from "@/components/analytics/charts"
import { RANGE_DAYS, type AnalyticsRange } from "@/lib/analytics-view"
import {
  EXIT_LABELS,
  byMarket,
  bySide,
  exitCounts,
  fillsInRange,
  isClose,
  pnlCurve,
  protection,
  recentCloses,
  tradingTotals,
  type ExitReason,
} from "@/lib/trading-analytics"
import { FILLS_CAP, type useAnalyticsData } from "@/hooks/useAnalyticsData"
import type { HlFill } from "@/lib/crypto-api"

type Trading = ReturnType<typeof useAnalyticsData>["trading"]

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n))}`
const pct = (n: number) => `${Math.round(n * 100)}%`
const tone = (n: number) => (n > 0 ? "text-credit" : n < 0 ? "text-debit" : "text-foreground")
const fmtPrice = (n: number) => (n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : n.toPrecision(3))
const when = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

/* ── Cumulative P&L ───────────────────────────────────────────────────── */

function PnlCurve({ points }: { points: { t: number; pnl: number; fill: HlFill }[] }) {
  const [active, setActive] = React.useState<number | null>(null)
  const box = React.useRef<HTMLDivElement>(null)
  const series = [0, ...points.map((p) => p.pnl)]
  const min = Math.min(0, ...series)
  const max = Math.max(0, ...series)
  const span = max - min || 1
  const W = 1000
  const H = 200
  const x = (i: number) => (i / Math.max(1, series.length - 1)) * W
  const y = (v: number) => H - ((v - min) / span) * H
  const line = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")
  const area = `${line} L${W},${y(0)} L0,${y(0)} Z`
  const last = series[series.length - 1]
  const n = points.length
  const zeroPct = (y(0) / H) * 100
  const clip = React.useId().replace(/:/g, "")
  const axis = (v: number) => (v < 0 ? "−" : v > 0 ? "+" : "") + compactUsd(Math.abs(v))

  const fromPointer = (clientX: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r || n === 0) return
    const i = Math.round(((clientX - r.left) / r.width) * (series.length - 1))
    setActive(Math.min(n, Math.max(1, i)))
  }
  const a = active != null ? points[active - 1] : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div aria-hidden className="relative w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
          <span className="absolute right-0 top-0 -translate-y-1/2"><Figure mask="•••">{axis(max)}</Figure></span>
          {min < 0 && max > 0 && <span className="absolute right-0 -translate-y-1/2" style={{ top: `${zeroPct}%` }}>$0</span>}
          <span className="absolute bottom-0 right-0 translate-y-1/2"><Figure mask="•••">{axis(min)}</Figure></span>
        </div>
        <div
          ref={box}
          role="group"
          tabIndex={0}
          aria-label={`Realised profit and loss over ${plural(n, "closed trade")}, ending at ${signed(last)}. Use the arrow keys to read each trade.`}
          onMouseMove={(e) => fromPointer(e.clientX)}
          onMouseLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
            e.preventDefault()
            setActive((i) => Math.min(n, Math.max(1, (i ?? (e.key === "ArrowRight" ? 0 : n + 1)) + (e.key === "ArrowRight" ? 1 : -1))))
          }}
          className="relative h-[200px] flex-1 cursor-crosshair rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:h-[232px]"
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-foreground/[0.06]" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground/[0.06]" />
          <span aria-hidden className="absolute inset-x-0 h-px bg-foreground/[0.16]" style={{ top: `${zeroPct}%` }} />
          {/* The wash says which side of zero you're on: green above, red below. */}
          <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <defs>
              <clipPath id={`${clip}-up`}>
                <rect x={0} y={0} width={W} height={y(0)} />
              </clipPath>
              <clipPath id={`${clip}-down`}>
                <rect x={0} y={y(0)} width={W} height={H - y(0)} />
              </clipPath>
            </defs>
            <path d={area} className="fill-credit/[0.14]" clipPath={`url(#${clip}-up)`} />
            <path d={area} className="fill-debit/[0.14]" clipPath={`url(#${clip}-down)`} />
            <path d={line} fill="none" className="stroke-primary" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="sr-only" aria-live="polite">
            {a ? `${when(a.t)}, ${a.fill.symbol} ${a.fill.direction}: ${signed(a.fill.closedPnl)}, running total ${signed(a.pnl)}` : ""}
          </span>
          {/* End marker, ringed in the surface colour. */}
          <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: "100%", top: `${(y(last) / H) * 100}%` }} />
          {a && active != null && (
            <>
              <span aria-hidden className="absolute inset-y-0 w-px bg-foreground/25" style={{ left: `${(x(active) / W) * 100}%` }} />
              <span aria-hidden className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-card" style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(a.pnl) / H) * 100}%` }} />
              <div
                aria-hidden
                className="pointer-events-none absolute top-2 z-10 flex min-w-[188px] flex-col gap-2 rounded-xl border border-foreground/[0.08] bg-popover px-3 py-2.5 text-[12px] shadow-lg"
                style={active < series.length / 2 ? { left: `calc(${(x(active) / W) * 100}% + 12px)` } : { right: `calc(${100 - (x(active) / W) * 100}% + 12px)` }}
              >
                <span className="font-semibold text-foreground">{when(a.t)}</span>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
                  <dt className="text-muted-foreground">Trade</dt>
                  <dd className="text-right text-foreground">{a.fill.symbol} · {a.fill.direction}</dd>
                  <dt className="text-muted-foreground">Result</dt>
                  <dd className={cn("text-right font-semibold", tone(a.fill.closedPnl))}><Figure>{signed(a.fill.closedPnl)}</Figure></dd>
                  <dt className="text-muted-foreground">Running total</dt>
                  <dd className="text-right font-semibold text-foreground"><Figure>{signed(a.pnl)}</Figure></dd>
                </dl>
              </div>
            </>
          )}
        </div>
      </div>
      <div aria-hidden className="ml-[60px] flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0] ? new Date(points[0].t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
        <span>{points[n - 1] ? new Date(points[n - 1].t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
      </div>
    </div>
  )
}

/* ── Per-trade results ────────────────────────────────────────────────── */

function TradeBars({ closes, exits }: { closes: HlFill[]; exits: Map<string, ExitReason> | null }) {
  const [active, setActive] = React.useState<number | null>(null)
  const maxUp = Math.max(0, ...closes.map((c) => c.closedPnl))
  const maxDown = Math.max(0, ...closes.map((c) => -c.closedPnl))
  const total = maxUp + maxDown || 1
  const split = maxUp / total
  const a = active != null ? closes[active] : null
  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-[168px] md:h-[188px]" onMouseLeave={() => setActive(null)}>
        <span aria-hidden className="absolute inset-x-0 h-px bg-foreground/[0.16]" style={{ top: `${split * 100}%` }} />
        <div className="absolute inset-0 flex">
          {closes.map((c, i) => (
            <div
              key={c.tid}
              role="img"
              aria-label={`${c.symbol} ${c.direction}, ${signed(c.closedPnl)}`}
              onMouseEnter={() => setActive(i)}
              className={cn("relative flex h-full flex-1 justify-center px-px", active === i && "bg-foreground/[0.035]")}
            >
              <span
                aria-hidden
                className={cn("absolute w-[min(14px,calc(100%-2px))]", c.closedPnl >= 0 ? "rounded-t-[4px] bg-credit" : "rounded-b-[4px] bg-debit")}
                style={c.closedPnl >= 0 ? { bottom: `${(1 - split) * 100}%`, height: `max(2px, ${(c.closedPnl / total) * 100}%)` } : { top: `${split * 100}%`, height: `max(2px, ${(-c.closedPnl / total) * 100}%)` }}
              />
            </div>
          ))}
        </div>
      </div>
      <p className="min-h-5 text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
        {a ? (
          <>
            <span className="font-semibold text-foreground">{a.symbol}</span> · {a.direction} at {fmtPrice(a.price)} ·{" "}
            <span className={cn("font-semibold", tone(a.closedPnl))}><Figure>{signed(a.closedPnl)}</Figure></span>
            {exits?.get(a.tid) && <> · {EXIT_LABELS[exits.get(a.tid)!]}</>} · {when(a.timestamp)}
          </>
        ) : (
          `Your last ${plural(closes.length, "close")}, oldest first. Hover one for details.`
        )}
      </p>
    </div>
  )
}

/* ── Markets: diverging horizontal bars ───────────────────────────────── */

function MarketBars({ rows }: { rows: ReturnType<typeof byMarket> }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)))
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((r) => (
        <li key={r.symbol} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium text-foreground">{r.symbol}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.wins}/{r.closed} won · <span className={cn("font-semibold", tone(r.pnl))}><Figure mask="•••">{signed(r.pnl)}</Figure></span>
            </span>
          </div>
          {/* Losses grow left from the centre, gains right. */}
          <span aria-hidden className="relative h-2 rounded-full bg-foreground/[0.06]">
            <span className="absolute inset-y-[-3px] left-1/2 w-px bg-foreground/20" />
            <span
              className={cn("absolute inset-y-0", r.pnl >= 0 ? "left-1/2 rounded-r-full bg-credit" : "right-1/2 rounded-l-full bg-debit")}
              style={{ width: `${Math.max(1, (Math.abs(r.pnl) / max) * 50)}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ── Exits ────────────────────────────────────────────────────────────── */

const EXIT_ORDER: { key: ExitReason; className: string }[] = [
  { key: "take-profit", className: "bg-credit" },
  { key: "stop-loss", className: "bg-warning" },
  { key: "manual", className: "bg-foreground/35" },
  { key: "liquidation", className: "bg-debit" },
]

function Exits({ closes, exits }: { closes: HlFill[]; exits: Map<string, ExitReason> }) {
  const counts = exitCounts(closes.flatMap((c) => (exits.get(c.tid) ? [{ reason: exits.get(c.tid)!, pnl: c.closedPnl }] : [])))
  const total = Object.values(counts).reduce((n, c) => n + c.count, 0)
  return (
    <div className="flex flex-col gap-5">
      <SegmentBar label="Closes by how they happened" segments={EXIT_ORDER.map((e) => ({ key: e.key, label: EXIT_LABELS[e.key], value: counts[e.key].count, className: e.className }))} />
      <ul className="grid grid-cols-2 gap-x-4 gap-y-4">
        {EXIT_ORDER.map((e) => {
          const c = counts[e.key]
          return (
            <li key={e.key} className="flex min-w-0 flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", e.className)} />
                {EXIT_LABELS[e.key]}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-[18px] font-semibold leading-none tabular-nums text-foreground">{c.count}</span>
                <span className="text-[11.5px] tabular-nums text-muted-foreground">{total ? pct(c.count / total) : "—"}</span>
              </span>
              <span className={cn("text-[11.5px] tabular-nums", tone(c.pnl))}><Figure mask="•••">{c.count ? signed(c.pnl) : "—"}</Figure></span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Protection table ─────────────────────────────────────────────────── */

function Protection({ rows }: { rows: ReturnType<typeof protection> }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <table className="w-full min-w-[640px] text-[13px] tabular-nums">
        <thead className="text-left text-[11.5px] text-muted-foreground">
          <tr>
            <th className="pb-2 pr-3 font-medium">Market</th>
            <th className="pb-2 pr-3 text-right font-medium">Size</th>
            <th className="pb-2 pr-3 text-right font-medium">Entry → mark</th>
            <th className="pb-2 pr-3 text-right font-medium">Unrealised</th>
            <th className="pb-2 pr-3 text-right font-medium">Stop loss</th>
            <th className="pb-2 text-right font-medium">Take profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ position: p, stopLoss, takeProfit, stopDistance }) => (
            <tr key={p.symbol} className="border-t border-foreground/[0.06]">
              <td className="py-3 pr-3">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{p.symbol}</span>
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", p.side === "long" ? "bg-credit/[0.1] text-credit" : "bg-debit/[0.1] text-debit")}>
                    {p.side === "long" ? "Long" : "Short"} {p.leverage.value}×
                  </span>
                </span>
              </td>
              <td className="py-3 pr-3 text-right text-muted-foreground"><Figure mask="•••">{p.absSize.toLocaleString("en-US", { maximumFractionDigits: 4 })}</Figure></td>
              <td className="py-3 pr-3 text-right text-muted-foreground">{fmtPrice(p.entryPrice)} → <span className="text-foreground">{fmtPrice(p.markPrice)}</span></td>
              <td className={cn("py-3 pr-3 text-right font-semibold", tone(p.unrealizedPnl))}><Figure mask="•••">{signed(p.unrealizedPnl)}</Figure></td>
              <td className="py-3 pr-3 text-right">
                {stopLoss != null ? (
                  <span className="flex flex-col items-end">
                    <span className="text-foreground">{fmtPrice(stopLoss)}</span>
                    {stopDistance != null && <span className="text-[11px] text-muted-foreground">{(stopDistance * 100).toFixed(1)}% away</span>}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/[0.1] px-1.5 py-0.5 text-[11.5px] font-semibold text-warning">No stop</span>
                )}
              </td>
              <td className="py-3 text-right">{takeProfit != null ? <span className="text-foreground">{fmtPrice(takeProfit)}</span> : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Tab ──────────────────────────────────────────────────────────────── */

export function TradingAnalytics({ trading, range, now }: { trading: Trading; range: AnalyticsRange; now: Date | null }) {
  const d = React.useMemo(() => {
    if (!now) return null
    const fills = fillsInRange(trading.fills, RANGE_DAYS[range], now.getTime())
    return {
      fills,
      totals: tradingTotals(fills),
      curve: pnlCurve(fills),
      closes: recentCloses(fills, 40),
      allCloses: fills.filter(isClose),
      markets: byMarket(fills),
      sides: bySide(fills),
    }
  }, [trading.fills, range, now])
  const guarded = React.useMemo(() => protection(trading.positions, trading.openOrders), [trading.positions, trading.openOrders])

  if (!d || trading.fillsLoading) {
    return (
      <div className="flex flex-col gap-4 md:gap-5" role="status" aria-busy="true" aria-label="Loading trading analytics">
        <TilesSkeleton />
        <SkeletonBlock className="h-[330px] rounded-[20px]" />
      </div>
    )
  }
  if (trading.fillsError && trading.fills.length === 0) {
    return (
      <Panel>
        <ErrorPanel title="Couldn't load your trades" message="Your futures fills didn't load, so there's nothing to add up yet." onRetry={trading.refetchFills} />
      </Panel>
    )
  }
  if (trading.fills.length === 0 && trading.positions.length === 0) {
    return (
      <Panel>
        <EmptyPanel
          title="No futures trades yet"
          description="Once you open and close positions, your profit and loss, win rate and fees will build up here."
          action={<NeutralLink href="/trade?market=futures">Open futures</NeutralLink>}
        />
      </Panel>
    )
  }

  const t = d.totals
  const withStop = guarded.filter((g) => g.stopLoss != null).length
  const capped = trading.fills.length >= FILLS_CAP

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <Rise delay={60}>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <Tile
            label="Realised P&L"
            icon={ChartLineData01Icon}
            tone="border-primary/25 bg-primary/[0.08] text-primary"
            value={<span className={tone(t.realisedPnl)}><Figure>{signed(t.realisedPnl)}</Figure></span>}
            sub={<>After fees <Figure mask="•••">{signed(t.netPnl)}</Figure></>}
          />
          <Tile
            label="Win rate"
            icon={Target02Icon}
            tone="border-foreground/[0.08] bg-foreground/[0.04] text-foreground/80"
            value={t.winRate == null ? "—" : pct(t.winRate)}
            sub={t.closed ? `${t.wins} of ${plural(t.wins + t.losses, "closed trade")}` : "No closed trades yet"}
          />
          <Tile
            label="Fees paid"
            icon={CoinsDollarIcon}
            tone="border-foreground/[0.08] bg-foreground/[0.04] text-foreground/80"
            value={<Figure>{usd(t.feesUsdc)}</Figure>}
            sub={t.otherFeeFills ? `${plural(t.fills, "fill")} · ${t.otherFeeFills} paid in another token` : plural(t.fills, "fill")}
          />
          <Tile
            label="Volume"
            icon={ArrowDataTransferHorizontalIcon}
            tone="border-foreground/[0.08] bg-foreground/[0.04] text-foreground/80"
            value={<Figure>{usd(t.volumeUsd)}</Figure>}
            sub={capped ? "Latest 200 fills" : "Price × size, every fill"}
          />
        </div>
      </Rise>

      {d.allCloses.length === 0 ? (
        <Panel>
          <EmptyPanel compact title={`No closed trades in ${RANGE_NOUN[range]}`} description="Results appear once a position is closed or reduced." />
        </Panel>
      ) : (
        <>
          <Rise delay={120}>
            <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
              <SectionPanel className="xl:col-span-2" title="Realised profit and loss" subtitle={`Running total over ${plural(d.allCloses.length, "closed trade")}, before fees`}>
                <PnlCurve points={d.curve} />
              </SectionPanel>
              <SectionPanel title="Trade quality" subtitle="Across closed trades">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
                  {[
                    ["Average win", t.avgWin == null ? "—" : signed(t.avgWin), tone(t.avgWin ?? 0)],
                    ["Average loss", t.avgLoss == null ? "—" : signed(t.avgLoss), tone(t.avgLoss ?? 0)],
                    ["Profit factor", t.profitFactor == null ? "—" : `${t.profitFactor.toFixed(2)}×`, "text-foreground"],
                    ["Closed trades", String(t.closed), "text-foreground"],
                  ].map(([label, value, cls]) => (
                    <div key={label} className="flex flex-col gap-1">
                      <dt className="text-[12px] text-muted-foreground">{label}</dt>
                      <dd className={cn("font-display text-[18px] font-semibold leading-none tabular-nums", cls)}><Figure mask="•••">{value}</Figure></dd>
                    </div>
                  ))}
                </dl>
                {t.wins + t.losses > 0 && (
                  <div className="flex flex-col gap-2">
                    <SegmentBar
                      label="Wins and losses"
                      segments={[
                        { key: "w", label: "Wins", value: t.wins, className: "bg-credit" },
                        { key: "l", label: "Losses", value: t.losses, className: "bg-debit" },
                      ]}
                    />
                    <div className="flex justify-between text-[11.5px] tabular-nums text-muted-foreground">
                      <span>{plural(t.wins, "win")}</span>
                      <span>{plural(t.losses, "loss", "losses")}</span>
                    </div>
                  </div>
                )}
                <div className="mt-auto flex flex-col gap-3 border-t border-foreground/[0.06] pt-4 text-[12.5px]">
                  {t.best && (
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">Best · {t.best.symbol} {t.best.direction.toLowerCase()}</span>
                      <span className="font-semibold tabular-nums text-credit"><Figure mask="•••">{signed(t.best.closedPnl)}</Figure></span>
                    </p>
                  )}
                  {t.worst && (
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">Worst · {t.worst.symbol} {t.worst.direction.toLowerCase()}</span>
                      <span className="font-semibold tabular-nums text-debit"><Figure mask="•••">{signed(t.worst.closedPnl)}</Figure></span>
                    </p>
                  )}
                </div>
              </SectionPanel>
            </div>
          </Rise>

          <Rise delay={180}>
            <div className="grid gap-4 md:gap-5 xl:grid-cols-3">
              <SectionPanel className="xl:col-span-2" title="Trade by trade" subtitle="Each close's result: gains above the line, losses below">
                <TradeBars closes={d.closes} exits={trading.exits} />
              </SectionPanel>
              <SectionPanel title="How positions closed" subtitle={trading.exits ? "Take profit, stop loss, by hand or liquidated" : undefined}>
                {trading.exits ? (
                  <Exits closes={d.allCloses} exits={trading.exits} />
                ) : (
                  <UnavailableState
                    compact
                    title="Coming soon"
                    description="Whether a trade closed at your take profit, your stop loss, by hand or by liquidation needs your order history, which isn't available yet."
                  />
                )}
              </SectionPanel>
            </div>
          </Rise>

          <Rise delay={240}>
            <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
              <SectionPanel title="By market" subtitle="Realised P&L and trades won">
                <MarketBars rows={d.markets} />
              </SectionPanel>
              <SectionPanel title="Longs and shorts" subtitle="Which way you trade better">
                <div className="grid grid-cols-2 gap-4">
                  {(["long", "short"] as const).map((k) => {
                    const s = d.sides[k]
                    return (
                      <div key={k} className="flex flex-col gap-3 rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-4">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                          <span aria-hidden className={cn("size-2 rounded-full", k === "long" ? "bg-credit" : "bg-debit")} />
                          {k === "long" ? "Longs" : "Shorts"}
                        </span>
                        <span className={cn("font-display text-[22px] font-semibold leading-none tabular-nums", tone(s.pnl))}><Figure>{s.closed ? signed(s.pnl) : "—"}</Figure></span>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between text-[12px]">
                            <span className="text-muted-foreground">Win rate</span>
                            <span className="font-semibold tabular-nums text-foreground">{s.closed ? pct(s.winRate ?? 0) : "—"}</span>
                          </div>
                          <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${(s.winRate ?? 0) * 100}%` }} />
                          </span>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 border-t border-foreground/[0.06] pt-3 text-[12px]">
                          <dt className="text-muted-foreground">Closes</dt>
                          <dd className="text-right tabular-nums text-foreground">{s.closed}</dd>
                          <dt className="text-muted-foreground">Per close</dt>
                          <dd className={cn("text-right tabular-nums", tone(s.pnl))}><Figure mask="•••">{s.closed ? signed(s.pnl / s.closed) : "—"}</Figure></dd>
                        </dl>
                      </div>
                    )
                  })}
                </div>
              </SectionPanel>
            </div>
          </Rise>
        </>
      )}

      <Rise delay={300}>
        <SectionPanel
          title="Stops and targets on open positions"
          subtitle={
            trading.accountLoading
              ? "Loading positions"
              : guarded.length
                ? `${withStop} of ${plural(guarded.length, "open position")} ${withStop === 1 ? "has" : "have"} a stop loss`
                : "Nothing open right now"
          }
        >
          {trading.accountLoading ? (
            <SkeletonBlock className="h-32" />
          ) : guarded.length ? (
            <Protection rows={guarded} />
          ) : (
            <p className="text-[13px] text-muted-foreground">When you hold a position, its stop loss and take profit show here, with how far the price is from the stop.</p>
          )}
        </SectionPanel>
      </Rise>
      <p className="px-1 text-[12px] text-muted-foreground">
        From {capped ? `your latest ${FILLS_CAP} futures fills` : "your futures fills"}. P&amp;L is realised on close and shown before fees unless it says
        otherwise; fees paid in a token other than USDC aren&apos;t added in.
      </p>
    </div>
  )
}
