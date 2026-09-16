"use client"

/**
 * The trading workspace — Simple and Pro.
 *
 * The rule the live screen does not follow: **Simple and Pro differ in what
 * you can DO, not only in what you can see.** Its Pro mode adds a market
 * list, timeframes, OHLC and a price-sources card, but the ticket is
 * identical in both — a market buy either way. So "Pro" is a reading mode.
 *
 * Here:
 *   Simple — one market, an area chart, a market order, and the summary.
 *   Pro    — market rail, candles + timeframes, the ORDER BOOK and trades
 *            tape, limit and stop orders priced off the book, and working
 *            orders you can cancel.
 *
 * And the header states the 24h change instead of apologising for it: the
 * live one prints "24h change unavailable" in the second-most-important slot
 * on the screen.
 */

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { CardShell, Eyebrow, Segmented } from "@/components/ui/system"
import { CoinAvatar } from "@/components/ui/coin-avatar"
import { CARD_HUE, HERO_HUE } from "@/components/preview/surface"
import { AreaPrice, Candles, OhlcReadout } from "@/components/trade-unauth/chart"
import { MarketList } from "@/components/trade-unauth/market-list"
import { OrderBook } from "@/components/trade-unauth/order-book"
import { OrdersPanel } from "@/components/trade-unauth/orders-panel"
import { Ticket } from "@/components/trade-unauth/ticket"
import {
  DEFAULT_PAIR,
  SIMPLE_RANGES,
  TIMEFRAMES,
  candlesFor,
  changeOver,
  simpleRange,
  timeframe,
  formatCompact,
  formatPrice,
  pairById,
  venueOf,
  type Candle,
  type Timeframe,
} from "@/components/trade-unauth/trade-data"

type Mode = "simple" | "pro"

export function TradeWorkspace() {
  const [mode, setMode] = React.useState<Mode>("simple")
  const [pairId, setPairId] = React.useState(DEFAULT_PAIR.id)
  const [tf, setTf] = React.useState<Timeframe>("15m")
  const [limitPrice, setLimitPrice] = React.useState<number | null>(null)
  const [hovered, setHovered] = React.useState<Candle | null>(null)
  const [listOpen, setListOpen] = React.useState(false)

  const market = pairById(pairId)
  const pro = mode === "pro"
  // Simple and Pro read the same generator at different densities.
  const view = pro ? timeframe(tf) : simpleRange(tf)
  const candles = React.useMemo(() => candlesFor(market, tf, view.count), [market, tf, view.count])
  const shown = hovered ?? candles[candles.length - 1]

  // Derived from the candles ON SCREEN, and labelled with their window.
  const windowLabel = view.window
  const changePct = changeOver(candles)
  const up = changePct >= 0
  const dayHigh = Math.max(...candles.map((c) => c.h))
  const dayLow = Math.min(...candles.map((c) => c.l))

  // Simple offers three ranges; Pro offers six. Moving between them has to
  // land on a timeframe the destination actually shows, or the segmented
  // control renders with nothing selected.
  React.useEffect(() => {
    if (!pro && !SIMPLE_RANGES.some((r) => r.key === tf)) setTf("15m")
  }, [pro, tf])

  const selectPair = (id: string) => {
    setPairId(id)
    setLimitPrice(null)
    setListOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Mode bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { key: "simple", label: "Simple" },
            { key: "pro", label: "Pro" },
          ]}
          value={mode}
          onChange={(k) => setMode(k as Mode)}
        />
        <span className="text-[12.5px] text-muted-foreground">
          {pro
            ? "Order book, limit and stop orders, working orders you can cancel."
            : "One market, one price, a market order."}
        </span>
      </div>

      {/* ── Pair header ───────────────────────────────────────────────── */}
      <CardShell className={HERO_HUE}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4 lg:p-5">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="flex shrink-0 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-accent/40"
          >
            <CoinAvatar symbol={market.base} size="lg" />
            <span className="flex flex-col">
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[20px] font-semibold leading-tight">{market.base}</span>
                <span className="text-[13px] text-muted-foreground">/{market.quote}</span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={cn(
                    "ws-icon-mono h-4 w-4 text-muted-foreground transition-transform",
                    listOpen && "rotate-180",
                  )}
                />
              </span>
              <span className="text-[11.5px] leading-tight text-muted-foreground">
                Spot on {venueOf(market)}
              </span>
            </span>
          </button>

          <span className="flex flex-col">
            <span className="font-display text-[30px] font-light leading-none tabular-nums">
              {formatPrice(market.price)}
            </span>
            {/* Stated, not apologised for. */}
            <span className="mt-1 flex items-center gap-2">
              <span
                className={cn("text-[13px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}
              >
                {up ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
              <span className="text-[12px] text-muted-foreground">{windowLabel}</span>
            </span>
          </span>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Figure label={`${windowLabel} high`} value={formatPrice(dayHigh)} />
            <Figure label={`${windowLabel} low`} value={formatPrice(dayLow)} />
            <Figure label="24h volume" value={`$${formatCompact(market.volumeUsd)}`} />
            <Figure label="Market cap" value={`$${formatCompact(market.marketCapUsd)}`} />
          </div>

          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-credit-chip px-2.5 py-1 text-[11.5px] font-semibold text-credit">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-credit opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-credit" />
            </span>
            Live
          </span>
        </div>

        {/* The pair switcher, as a drawer off the header — Simple has no rail
            but still has to be able to change market. */}
        {listOpen && (
          <div className="h-[22rem] border-t border-border/40">
            <MarketList activeId={pairId} onSelect={selectPair} />
          </div>
        )}
      </CardShell>

      {/* ── Workspace ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "grid gap-4",
          pro
            ? "grid-cols-1 xl:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)_minmax(0,16.5rem)_minmax(0,19.5rem)]"
            : "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]",
        )}
      >
        {pro && (
          <CardShell className={cn(CARD_HUE, "hidden h-[34rem] xl:flex")}>
            <MarketList activeId={pairId} onSelect={selectPair} />
          </CardShell>
        )}

        <CardShell className={cn(CARD_HUE, "min-h-[30rem]")}>
          {pro ? (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-2.5">
                <Segmented
                  size="sm"
                  options={TIMEFRAMES.map((t) => ({ key: t.key, label: t.label }))}
                  value={tf}
                  onChange={(k) => setTf(k as Timeframe)}
                />
                <OhlcReadout candle={shown} />
                <span className="ml-auto text-[11.5px] tabular-nums text-muted-foreground">
                  Vol {formatCompact(shown.v)}
                </span>
              </div>
              <div className="min-h-0 flex-1 p-3">
                <Candles candles={candles} onHover={setHovered} />
              </div>
            </>
          ) : (
            <>
              {/* Simple gets a range control too. The live Simple mode shows
                  candlesticks with NO timeframe control at all. */}
              <div className="flex items-center justify-between gap-3 border-b border-border/40 px-4 py-2.5">
                <Eyebrow className="text-[11px]">Last {windowLabel}</Eyebrow>
                <Segmented
                  size="sm"
                  options={SIMPLE_RANGES.map((r) => ({ key: r.key, label: r.label }))}
                  value={tf}
                  onChange={(k) => setTf(k as Timeframe)}
                />
              </div>
              {/* flex-1: in Simple the ticket column is tall, so a fixed-height
                  chart left a screen's worth of empty card beneath it. */}
              <div className="min-h-0 flex-1 p-3">
                <AreaPrice candles={candles} />
              </div>
            </>
          )}
        </CardShell>

        {pro && (
          <CardShell className={cn(CARD_HUE, "h-[34rem]")}>
            <OrderBook market={market} onPickPrice={(p) => setLimitPrice(Number(p.toFixed(6)))} />
          </CardShell>
        )}

        <CardShell className={CARD_HUE}>
          <Ticket market={market} pro={pro} limitPrice={limitPrice} onLimitPrice={setLimitPrice} />
        </CardShell>
      </div>

      {/* ── Orders ────────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        <OrdersPanel pairId={pairId} />
      </CardShell>
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      <span className="text-[13.5px] font-medium tabular-nums">{value}</span>
    </span>
  )
}
