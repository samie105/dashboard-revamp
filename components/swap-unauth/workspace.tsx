"use client"

/**
 * The swap page body: the form, and beside it the three things worth
 * knowing before you press it — where the rate has been, how the swap will
 * actually travel, and how your recent swaps went.
 *
 * Tokens, amount and slippage live HERE rather than in the form, because the
 * rate chart and the route card read the same quote the form shows. Change
 * the pair in the form and the chart and the route follow.
 */

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowDown01Icon, ArrowLeftRightIcon, ArrowRight01Icon, Route01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { PREVIEW_ROUTES } from "@/components/preview/routes"
import { PriceChart } from "@/components/dashboard-unauth/price-chart"
import {
  DEFAULT_FROM,
  DEFAULT_TO,
  RANGES,
  SWAPS,
  SWAP_STATS,
  formatAmount,
  formatRate,
  formatUSD,
  quoteFor,
  rateSeries,
  tokenByKey,
  type Quote,
  type RangeKey,
  type SwapRecord,
  type Token,
} from "@/components/swap-unauth/swap-data"
import { SwapTicket } from "@/components/swap-unauth/ticket"
import { Figure, Icon, MoreLink, Panel, PanelTitle, PillTabs } from "@/components/redesign/ui"

/* ── Rate chart ───────────────────────────────────────────────────────── */

function RateCard({ from, to }: { from: Token; to: Token }) {
  const [range, setRange] = React.useState<RangeKey>("1w")
  const points = React.useMemo(() => rateSeries(from, to, range), [from, to, range])
  const spec = RANGES.find((r) => r.key === range)!
  const change = ((points[points.length - 1] - points[0]) / points[0]) * 100
  const ticks = React.useMemo(() => {
    // Relative ticks ("6d ago … now") — no clock read, so SSR matches.
    const hours = range === "1d" ? 24 : range === "1w" ? 168 : 720
    return Array.from({ length: 7 }, (_, k) => {
      const h = Math.round(hours * (1 - k / 6))
      if (h === 0) return "Now"
      return h >= 48 ? `${Math.round(h / 24)}d` : `${h}h`
    })
  }, [range])

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex -space-x-2">
            <CoinAvatar symbol={from.symbol} size="lg" className="size-10 ring-2 ring-[#0f0f0f]" />
            <CoinAvatar symbol={to.symbol} size="lg" className="size-10 ring-2 ring-[#0f0f0f]" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[17px] font-semibold text-foreground">
              {from.symbol} / {to.symbol}
            </span>
            <span className="text-[12.5px] text-muted-foreground">
              {from.chain === to.chain ? from.chain : `${from.chain} → ${to.chain}`} · {spec.window}
            </span>
          </div>
        </div>
        <PillTabs id="swap-rate-range" size="sm" options={RANGES.map((r) => ({ key: r.key, label: r.label }))} value={range} onChange={setRange} />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <motion.span
          key={`${from.symbol}${to.symbol}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-[26px] font-semibold tracking-[-0.03em] tabular-nums text-foreground"
        >
          {formatRate(from.price / to.price)}
          <span className="ml-2 text-[14px] font-medium text-muted-foreground">
            {to.symbol} per {from.symbol}
          </span>
        </motion.span>
        <span className={cn("text-[13px] font-semibold tabular-nums", change >= 0 ? "text-credit" : "text-debit")}>
          {change >= 0 ? "+" : "−"}
          {Math.abs(change).toFixed(2)}%
        </span>
      </div>

      <PriceChart points={points} ticks={ticks} format={(v) => `${formatRate(v)} ${to.symbol}`} formatAxis={(v) => (v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toPrecision(4))} height={210} />
    </Panel>
  )
}

/* ── Route ────────────────────────────────────────────────────────────── */

function RouteCard({ from, to, quote, amount }: { from: Token; to: Token; quote: Quote; amount: number }) {
  const same = from.symbol === to.symbol && from.chain === to.chain
  const nodes = [
    { kind: "token" as const, symbol: from.symbol, chain: from.chain, label: amount > 0 ? `${formatAmount(amount, from.decimals)} ${from.symbol}` : from.symbol },
    ...quote.hops.map((h) => ({ kind: h.kind, venue: h.venue, detail: h.detail })),
    { kind: "token" as const, symbol: to.symbol, chain: to.chain, label: amount > 0 ? `${formatAmount(quote.toAmount, to.decimals)} ${to.symbol}` : to.symbol },
  ]

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-[16px]">Route</PanelTitle>
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Icon icon={Route01Icon} className="size-3.5" />
          {quote.hops.length === 0 ? "Direct" : `${quote.hops.length} step${quote.hops.length > 1 ? "s" : ""}`} · {from.chain === to.chain ? "same chain" : "cross-chain"}
        </span>
      </div>

      {same ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">Pick two different tokens to see the route.</p>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.ol
            key={`${from.symbol}${from.chain}${to.symbol}${to.chain}`}
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
                    <CoinAvatar symbol={node.symbol} size="lg" className="size-9 ring-1 ring-white/10" />
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13.5px] font-semibold tabular-nums text-foreground">{node.label}</span>
                      <span className="text-[12px] text-muted-foreground">{i === 0 ? "You pay" : "You receive"} · {node.chain}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl border",
                        node.kind === "bridge" ? "border-primary/30 bg-primary/[0.1] text-primary" : "border-white/[0.08] bg-white/[0.03] text-foreground/80",
                      )}
                    >
                      <Icon icon={node.kind === "bridge" ? ArrowLeftRightIcon : ArrowDown01Icon} className="size-4" strokeWidth={2} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <span className="text-[13px] font-semibold text-foreground">
                        {node.kind === "bridge" ? "Bridge" : "Swap"} <span className="font-medium text-muted-foreground">via {node.venue}</span>
                      </span>
                      <span className="truncate text-[12px] text-muted-foreground">{node.detail}</span>
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

const STATUS_STYLE: Record<SwapRecord["status"], string> = {
  completed: "bg-credit/[0.1] text-credit",
  pending: "bg-warning/[0.12] text-warning",
  failed: "bg-debit/[0.12] text-debit",
}

function History() {
  const [filter, setFilter] = React.useState<"all" | SwapRecord["status"]>("all")
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => setReady(true), [])
  const ago = (m: number) => (!ready ? " " : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`)
  const rows = SWAPS.filter((s) => filter === "all" || s.status === filter)

  return (
    <Panel className="flex flex-col gap-3 px-3 pb-3 pt-5 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-baseline gap-2.5">
          <PanelTitle className="text-[16px]">Recent swaps</PanelTitle>
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            <Figure mask="••••">{formatUSD(SWAP_STATS.volumeUsd, { compact: true })}</Figure> swapped
          </span>
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
            <MoreLink icon={ArrowRight01Icon} href={PREVIEW_ROUTES.transactions}>
              All
            </MoreLink>
          </span>
        </div>
      </div>
      <ul className="flex flex-col">
        {rows.map((s, i) => (
          <motion.li
            key={s.id}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.025]"
          >
            <span className="flex shrink-0 -space-x-2.5">
              <CoinAvatar symbol={s.fromSymbol} size="lg" className="size-8 ring-2 ring-[#0f0f0f]" />
              <CoinAvatar symbol={s.toSymbol} size="lg" className="size-8 ring-2 ring-[#0f0f0f]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                <span className="truncate">
                  {s.fromSymbol} → {s.toSymbol}
                </span>
                <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] tabular-nums", STATUS_STYLE[s.status])}>
                  {s.status === "pending" && s.confirmations ? `${s.confirmations[0]}/${s.confirmations[1]}` : s.status}
                </span>
              </span>
              <span className="truncate text-[12px] text-muted-foreground">
                {s.fromChain === s.toChain ? s.fromChain : `${s.fromChain} → ${s.toChain}`} · {s.route} · {ago(s.minutesAgo)}
              </span>
            </span>
            <span className="flex flex-col items-end tabular-nums">
              <span className={cn("text-[13px] font-semibold", s.status === "failed" ? "text-muted-foreground line-through decoration-debit/60" : "text-credit")}>
                <Figure mask="••••">{`+${formatAmount(s.toAmount, 4)} ${s.toSymbol}`}</Figure>
              </span>
              <span className="text-[12px] text-muted-foreground">
                <Figure mask="••••">{`−${formatAmount(s.fromAmount, 4)} ${s.fromSymbol}`}</Figure>
              </span>
            </span>
          </motion.li>
        ))}
      </ul>
    </Panel>
  )
}

/* ── Workspace ────────────────────────────────────────────────────────── */

export function SwapWorkspace() {
  const [fromKey, setFromKey] = React.useState(DEFAULT_FROM)
  const [toKey, setToKey] = React.useState(DEFAULT_TO)
  const [amount, setAmount] = React.useState("")
  const [slippage, setSlippage] = React.useState(0.5)

  const from = tokenByKey(fromKey)
  const to = tokenByKey(toKey)
  const n = Number(amount) || 0
  const quote = quoteFor({ from, to, fromAmount: n, slippagePct: slippage })

  // Picking the token that's already on the other side flips the pair rather
  // than leaving the same token on both sides.
  const pickFrom = (key: string) => (key === toKey ? flip() : setFromKey(key))
  const pickTo = (key: string) => (key === fromKey ? flip() : setToKey(key))
  function flip() {
    setFromKey(toKey)
    setToKey(fromKey)
    // Carry the value across: 1,000 USDC → SOL flipped becomes ~5.4 SOL → USDC.
    if (n > 0) setAmount(String(Number(quote.toAmount.toFixed(to.decimals))))
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      <div className="rise min-w-0" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
        <SwapTicket
          from={from}
          to={to}
          amount={amount}
          slippage={slippage}
          quote={quote}
          onFrom={pickFrom}
          onTo={pickTo}
          onFlip={flip}
          onAmount={setAmount}
          onSlippage={setSlippage}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <div className="rise" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
          <RateCard from={from} to={to} />
        </div>
        <div className="rise grid grid-cols-1 items-start gap-4 md:gap-5 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" style={{ "--rise-delay": "180ms" } as React.CSSProperties}>
          <RouteCard from={from} to={to} quote={quote} amount={n} />
          <History />
        </div>
      </div>
    </div>
  )
}
