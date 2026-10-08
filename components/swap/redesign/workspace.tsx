"use client"

/**
 * The preview's swap page body (components/swap-unauth/workspace.tsx) on the
 * real swap: the form, and beside it where the rate has been, how the swap
 * will travel, and how recent swaps went.
 *
 * The ticket's state lives here (useSwapTicket, in the full view — there is
 * no Simple/Pro switch on this page) because the rate card and the route card
 * read the same pair and the same quote the form shows.
 *
 * Swapped for real data:
 *  · Rate — the old rate chart's series (each side's dollar candles on one
 *    interval, divided bar for bar), drawn in the preview's chart; "no
 *    history" when either side has none;
 *  · Route — the quote's own legs, only once a quote has landed;
 *  · Recent swaps — the ledger's swaps, read exactly as the old history card
 *    read them (swap-history-rows.ts). The ledger carries the amount received
 *    and no dollar value, so the header counts swaps rather than volume.
 * Added: loading skeletons and the empty states.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, ArrowLeftRightIcon, ArrowRight01Icon, Route01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { qty } from "@/lib/num"
import type { CoinData } from "@/lib/actions"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PriceChart } from "@/components/dash/price-chart"
import { Figure, Icon, MoreLink, Panel, PanelTitle, PillTabs } from "@/components/dashboard/redesign/ui"
import { useLedgerRecords } from "@/hooks/useLedgerRecords"
import { useSpotRegistry } from "@/hooks/useSpotRegistry"
import { networkLabel, routeSteps, swapBucket, type RouteStep, type SwapBucket } from "@/lib/swap-redesign"
import { chainMeta } from "@/components/swap/swap-model"
import { RANGES, useSwapRateSeries, type RangeKey } from "@/components/swap/rate-chart"
import { swapRowsFrom } from "@/components/swap/swap-history-rows"
import { useSwapTicket } from "@/components/swap/use-swap-ticket"
import { SwapTicket } from "@/components/swap/redesign/ticket"

const WINDOW: Record<RangeKey, string> = { "1D": "24 hours", "1W": "7 days", "1M": "30 days" }

/* ── Rate chart ───────────────────────────────────────────────────────── */

function RateCard({ from, to, fromChain, toChain }: { from: CoinData | null; to: CoinData | null; fromChain: string; toChain: string }) {
  const [range, setRange] = React.useState<RangeKey>("1W")
  const { points, latest, changePct, loading } = useSwapRateSeries(from, to, range)
  const ticks = React.useMemo(() => {
    const hours = range === "1D" ? 24 : range === "1W" ? 168 : 720
    return Array.from({ length: 7 }, (_, k) => {
      const h = Math.round(hours * (1 - k / 6))
      if (h === 0) return "Now"
      return h >= 48 ? `${Math.round(h / 24)}d` : `${h}h`
    })
  }, [range])
  const pending = Boolean(from && to) && loading
  const fmt = (v: number) => (v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toPrecision(4))

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex -space-x-2">
            <CoinAvatar symbol={from?.symbol ?? "?"} src={from?.image || undefined} size="lg" className="size-10 ring-2 ring-card" />
            <CoinAvatar symbol={to?.symbol ?? "?"} src={to?.image || undefined} size="lg" className="size-10 ring-2 ring-card" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[17px] font-semibold text-foreground">
              {from && to ? `${from.symbol} / ${to.symbol}` : "Pick a pair"}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {fromChain === toChain ? chainMeta(fromChain).label : `${chainMeta(fromChain).label} → ${chainMeta(toChain).label}`} · {WINDOW[range]}
            </span>
          </div>
        </div>
        <PillTabs id="swap-rate-range" size="sm" options={RANGES.map((r) => ({ key: r.key, label: r.label }))} value={range} onChange={setRange} />
      </div>

      <div className="flex min-h-[34px] flex-wrap items-baseline gap-x-3 gap-y-1">
        {pending ? (
          <span className="skel h-8 w-48 rounded-lg" />
        ) : latest !== null && from && to ? (
          <>
            <motion.span
              key={`${from.symbol}${to.symbol}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-[26px] font-semibold tracking-[-0.03em] tabular-nums text-foreground"
            >
              {qty(latest)}
              <span className="ml-2 text-[14px] font-medium text-muted-foreground">
                {to.symbol} per {from.symbol}
              </span>
            </motion.span>
            {changePct !== null && (
              <span className={cn("text-[13px] font-semibold tabular-nums", changePct >= 0 ? "text-credit" : "text-debit")}>
                {changePct >= 0 ? "+" : "−"}
                {Math.abs(changePct).toFixed(2)}%
              </span>
            )}
          </>
        ) : null}
      </div>

      {pending ? (
        <span className="skel h-[210px] w-full rounded-xl" />
      ) : points.length > 1 && to ? (
        <PriceChart points={points} ticks={ticks} format={(v) => `${qty(v)} ${to.symbol}`} formatAxis={fmt} height={210} />
      ) : (
        <div className="flex h-[210px] flex-col items-center justify-center gap-1 text-center">
          <span className="text-[13.5px] font-semibold text-foreground">No rate history for this pair yet</span>
          <span className="text-[12.5px] text-muted-foreground">The chart appears once both sides have a price series.</span>
        </div>
      )}
    </Panel>
  )
}

/* ── Route ────────────────────────────────────────────────────────────── */

function RouteCard({
  from,
  to,
  fromChain,
  toChain,
  steps,
  amount,
  receive,
  quoting,
}: {
  from: CoinData | null
  to: CoinData | null
  fromChain: string
  toChain: string
  steps: RouteStep[]
  amount: number
  receive: number
  quoting: boolean
}) {
  const nodes = [
    { kind: "token" as const, symbol: from?.symbol ?? "", chain: chainMeta(fromChain).label, label: amount > 0 && from ? `${qty(amount)} ${from.symbol}` : (from?.symbol ?? "") },
    ...steps.map((s) => ({ kind: s.kind, venue: s.venue, detail: s.detail })),
    { kind: "token" as const, symbol: to?.symbol ?? "", chain: chainMeta(toChain).label, label: receive > 0 && to ? `${qty(receive)} ${to.symbol}` : (to?.symbol ?? "") },
  ]

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[16px]">Route</PanelTitle>
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Icon icon={Route01Icon} className="size-3.5" />
          {steps.length > 0 && `${steps.length} step${steps.length > 1 ? "s" : ""} · `}
          {fromChain === toChain ? "same chain" : "cross-chain"}
        </span>
      </div>

      {!from || !to ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">Pick two tokens to see the route.</p>
      ) : steps.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">{quoting ? "Finding a route…" : "Enter an amount — the route comes with the quote."}</p>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={steps.map((s) => s.venue).join("|")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col"
          >
            {nodes.map((node, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex items-center gap-3 pb-4 last:pb-0"
              >
                {i < nodes.length - 1 && <span aria-hidden className="absolute bottom-0 left-[17px] top-9 w-px border-l border-dashed border-primary/30" />}
                {node.kind === "token" ? (
                  <>
                    <CoinAvatar symbol={node.symbol} size="lg" className="size-9 ring-1 ring-foreground/10" />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13.5px] font-semibold tabular-nums text-foreground">{node.label}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {i === 0 ? "You pay" : "You receive"} · {node.chain}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                        node.kind === "bridge" ? "border-primary/30 bg-primary/[0.1] text-primary" : "border-foreground/[0.08] bg-foreground/[0.03] text-foreground/80",
                      )}
                    >
                      <Icon icon={node.kind === "bridge" ? ArrowLeftRightIcon : ArrowDown01Icon} className="size-4" strokeWidth={2} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13px] font-semibold text-foreground">
                        {node.kind === "bridge" ? "Bridge" : "Swap"} <span className="font-medium text-muted-foreground">via {node.venue}</span>
                      </span>
                      {node.detail && <span className="truncate text-[12px] text-muted-foreground">{node.detail}</span>}
                    </span>
                  </>
                )}
              </motion.li>
            ))}
          </motion.ol>
        </AnimatePresence>
      )}
    </Panel>
  )
}

/* ── History ──────────────────────────────────────────────────────────── */

const STATUS_STYLE: Record<SwapBucket, string> = {
  completed: "bg-credit/[0.1] text-credit",
  pending: "bg-warning/[0.12] text-warning",
  failed: "bg-debit/[0.12] text-debit",
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

function ago(iso: string, now: number) {
  if (!now) return ""
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (!Number.isFinite(m)) return ""
  return m < 1 ? "Just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}

function History() {
  const { records, loading } = useLedgerRecords(50)
  const registry = useSpotRegistry()
  const swaps = React.useMemo(() => swapRowsFrom(records, registry), [records, registry])
  const [filter, setFilter] = React.useState<"all" | "pending" | "failed">("all")
  const now = useNow()
  const rows = swaps.filter((s) => filter === "all" || swapBucket(s.status) === filter).slice(0, 10)

  return (
    <Panel className="flex flex-col gap-3 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-baseline gap-2.5">
          <PanelTitle className="text-[16px]">Recent swaps</PanelTitle>
          {swaps.length > 0 && <span className="text-[12.5px] tabular-nums text-muted-foreground">{swaps.length} {swaps.length === 1 ? "swap" : "swaps"}</span>}
        </div>
        <div className="flex items-center gap-3">
          <PillTabs
            id="swap-history"
            size="sm"
            options={[
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "failed", label: "Failed" },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <span className="hidden sm:block">
            <MoreLink icon={ArrowRight01Icon} href="/transactions">
              All
            </MoreLink>
          </span>
        </div>
      </div>

      {loading && swaps.length === 0 ? (
        <ul className="flex flex-col gap-1" aria-label="Loading swap history">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-2 py-2.5">
              <span className="skel size-8 shrink-0 rounded-full" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="skel h-3.5 w-32 rounded" />
                <span className="skel h-3 w-24 rounded" />
              </span>
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
          <p className="text-[13.5px] font-semibold text-foreground">{swaps.length === 0 ? "No swaps yet" : "Nothing under this filter"}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {swaps.length === 0 ? "Conversions you make here will be listed with their status." : "Switch back to All to see every swap."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((s, i) => {
            const bucket = swapBucket(s.status)
            const from = s.fromToken ?? s.token
            const to = s.toToken
            const chain = networkLabel(s.fromChain)
            return (
              <motion.li
                key={s.id}
                layout="position"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-foreground/[0.025]"
              >
                <span className="flex shrink-0 -space-x-2.5">
                  <CoinAvatar symbol={from ?? "?"} size="lg" className="size-8 ring-2 ring-card" />
                  {to && <CoinAvatar symbol={to} size="lg" className="size-8 ring-2 ring-card" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                    <span className="truncate">{from && to ? `${from} → ${to}` : from ? `${from} swap` : "Swap"}</span>
                    <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]", STATUS_STYLE[bucket])}>
                      {bucket === "pending" ? "Pending" : bucket === "failed" ? (s.status === "failed" ? "Failed" : s.status) : "Completed"}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-muted-foreground">{[chain, ago(s.createdAt, now)].filter(Boolean).join(" · ") || " "}</span>
                </span>
                <span className="flex flex-col items-end tabular-nums">
                  <span className={cn("text-[13px] font-semibold", bucket === "failed" ? "text-muted-foreground line-through decoration-debit/60" : "text-credit")}>
                    <Figure mask="••••">{s.amountText ? `+${s.amountText}` : "—"}</Figure>
                  </span>
                </span>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export function SwapWorkspace({ coins, prices, error }: { coins: CoinData[]; prices: Record<string, number>; error?: string }) {
  // The full view: the page has no Simple/Pro switch.
  const t = useSwapTicket({ coins, prices, mode: "pro" })
  const steps = React.useMemo(
    () => (t.fromCoin && t.toCoin && t.numericFrom > 0 ? routeSteps(t.quoteData, t.fromCoin.symbol, t.toCoin.symbol) : []),
    [t.quoteData, t.fromCoin, t.toCoin, t.numericFrom],
  )

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="rise min-w-0" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <SwapTicket t={t} error={error} steps={steps} />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <div className="rise" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
          <RateCard from={t.fromCoin} to={t.toCoin} fromChain={t.fromChain} toChain={t.toChain} />
        </div>
        <div className="rise grid grid-cols-1 items-start gap-4 md:gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" style={{ "--rise-delay": "180ms" } as React.CSSProperties}>
          <RouteCard
            from={t.fromCoin}
            to={t.toCoin}
            fromChain={t.fromChain}
            toChain={t.toChain}
            steps={steps}
            amount={t.numericFrom}
            receive={t.estimatedTo}
            quoting={t.quoteLoading}
          />
          <History />
        </div>
      </div>
    </div>
  )
}
