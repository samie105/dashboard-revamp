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
import { FuturesTicket } from "@/components/trade-unauth/futures-ticket"
import { PositionsPanel } from "@/components/trade-unauth/positions-panel"
import { TransferModal, type FlowKind } from "@/components/trade-unauth/transfer-modal"
import { DEFAULT_PERP, PERPS, perpById } from "@/components/trade-unauth/futures-data"
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
type Venue = "spot" | "futures"

export function TradeWorkspace({
  flow,
  onFlow,
}: {
  flow: FlowKind | null
  onFlow: (f: FlowKind | null) => void
}) {
  const [mode, setMode] = React.useState<Mode>("simple")
  const [venue, setVenue] = React.useState<Venue>("spot")
  const [pairId, setPairId] = React.useState(DEFAULT_PAIR.id)
  const [perpId, setPerpId] = React.useState(DEFAULT_PERP.id)
  const [tf, setTf] = React.useState<Timeframe>("15m")
  const [limitPrice, setLimitPrice] = React.useState<number | null>(null)
  const [hovered, setHovered] = React.useState<Candle | null>(null)
  const [listOpen, setListOpen] = React.useState(false)

  const futures = venue === "futures"
  const perp = perpById(perpId)
  // One `market` drives the chart, the header and the book in both venues —
  // a perp IS its spot pair plus funding, leverage and a mark price.
  const market = futures ? perp : pairById(pairId)
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
    if (futures) setPerpId(id)
    else setPairId(id)
    setLimitPrice(null)
    setListOpen(false)
  }

  // Futures is a Pro instrument: leverage, margin and liquidation have no
  // Simple presentation that is not a lie by omission.
  React.useEffect(() => {
    if (futures) setMode("pro")
  }, [futures])

  return (
    <div className="flex flex-col gap-4">
      {/* ── Venue + mode ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={[
            { key: "spot", label: "Spot" },
            { key: "futures", label: "Futures" },
          ]}
          value={venue}
          onChange={(k) => setVenue(k as Venue)}
        />
        <Segmented
          options={[
            {
              key: "simple",
              label: "Simple",
              disabled: futures,
              disabledReason: "Futures is Pro only — leverage needs the book and the margin figures",
            },
            { key: "pro", label: "Pro" },
          ]}
          value={mode}
          onChange={(k) => setMode(k as Mode)}
        />
        <span className="text-[12.5px] text-muted-foreground">
          {futures
            ? "Perpetuals: leverage, margin, liquidation price and funding."
            : pro
              ? "Order book, limit and stop orders, working orders you can cancel."
              : "One market, one price, a market order."}
        </span>
      </div>

      {/* ── Pair header ───────────────────────────────────────────────── */}
      <CardShell className={cn(HERO_HUE, "relative")}>
        {/* On a phone this is three stacked bands — identity, price, figures —
            rather than one flex-wrap row, which broke into a 4-then-2 ragged
            grid and stranded the Live badge on its own line. */}
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6 lg:p-5">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            className="flex shrink-0 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-accent/40"
          >
            <CoinAvatar symbol={market.base} size="lg" />
            <span className="flex flex-col">
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[20px] font-semibold leading-tight">{market.base}</span>
                {/* A perpetual is not a spot pair and should not be labelled
                    like one — the live futures header still reads "/USDC". */}
                <span className="text-[13px] text-muted-foreground">
                  {futures ? "PERP" : `/${market.quote}`}
                </span>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={cn(
                    "ws-icon-mono h-4 w-4 text-muted-foreground transition-transform",
                    listOpen && "rotate-180",
                  )}
                />
              </span>
              <span className="text-[11.5px] leading-tight text-muted-foreground">
                {futures ? `Perpetual · up to ${perp.maxLeverage}×` : `Spot on ${venueOf(market)}`}
              </span>
            </span>
          </button>

          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:flex-col lg:items-start lg:gap-0">
            <span className="font-display text-[30px] font-light leading-none tabular-nums">
              {formatPrice(market.price)}
            </span>
            {/* Stated, not apologised for. */}
            <span className="flex items-center gap-2 lg:mt-1">
              <span
                className={cn("text-[13px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}
              >
                {up ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
              <span className="text-[12px] text-muted-foreground">{windowLabel}</span>
            </span>
          </span>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/40 pt-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-2 lg:border-t-0 lg:pt-0">
            <Figure label={`${windowLabel} high`} value={formatPrice(dayHigh)} />
            <Figure label={`${windowLabel} low`} value={formatPrice(dayLow)} />
            <Figure label="24h volume" value={`$${formatCompact(market.volumeUsd)}`} />
            {futures ? (
              <>
                {/* Mark, not last: liquidations are measured against it, and
                    the live futures header shows only one price. */}
                <Figure label="Mark price" value={formatPrice(perp.markPrice)} />
                <Figure label="Open interest" value={`$${formatCompact(perp.openInterestUsd)}`} />
                <Figure
                  label={`Funding · ${Math.floor(perp.fundingInMinutes / 60)}h ${perp.fundingInMinutes % 60}m`}
                  value={`${perp.fundingPct >= 0 ? "+" : ""}${perp.fundingPct.toFixed(4)}%`}
                  tone={perp.fundingPct >= 0 ? "credit" : "debit"}
                />
              </>
            ) : (
              <Figure label="Market cap" value={`$${formatCompact(market.marketCapUsd)}`} />
            )}
          </div>

          <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-credit-chip px-2.5 py-1 text-[11.5px] font-semibold text-credit lg:static lg:ml-auto">
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
            <MarketList activeId={market.id} onSelect={selectPair} markets={futures ? PERPS : undefined} />
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
            <MarketList activeId={market.id} onSelect={selectPair} markets={futures ? PERPS : undefined} />
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
          {futures ? (
            <FuturesTicket perp={perp} limitPrice={limitPrice} onLimitPrice={setLimitPrice} />
          ) : (
            <Ticket market={market} pro={pro} limitPrice={limitPrice} onLimitPrice={setLimitPrice} />
          )}
        </CardShell>
      </div>

      {/* ── Orders ────────────────────────────────────────────────────── */}
      <CardShell className={CARD_HUE}>
        {futures ? <PositionsPanel perpId={perpId} /> : <OrdersPanel pairId={pairId} />}
      </CardShell>

      {flow && <TransferModal kind={flow} open onOpenChange={(v) => !v && onFlow(null)} />}
    </div>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "credit" | "debit" }) {
  return (
    <span className="flex flex-col">
      <span className="whitespace-nowrap text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-[13.5px] font-medium tabular-nums",
          tone === "credit" && "text-credit",
          tone === "debit" && "text-debit",
        )}
      >
        {value}
      </span>
    </span>
  )
}
