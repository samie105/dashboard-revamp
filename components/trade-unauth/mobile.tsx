"use client"

/**
 * The phone trading terminal — isolated.
 *
 * Below lg the terminal is its own screen: the shared top bar steps aside
 * (see DashboardFrame), and this brings a compact header instead — menu,
 * market picker, Spot | Futures — so the chart gets the height a phone can
 * spare. The desktop grid stacked five panels into one long scroll; this
 * reorganises them around what a phone is for:
 *
 *   · price and the day's numbers, up top and always visible
 *   · Chart | Book | Trades as tabs over ONE content area, not three stacked
 *   · orders and positions underneath
 *   · a sticky Buy | Sell (Long | Short) bar that opens the order form as a
 *     bottom sheet — the form appears when you mean to trade, and the chart
 *     isn't pushed off-screen by it the rest of the time
 */

import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { TIMEFRAMES, formatCompact, formatPrice, type Book, type Candle, type Fill, type Market, type Order, type Timeframe } from "@/components/trade-unauth/trade-data"
import type { Perp, Position } from "@/components/trade-unauth/futures-data"
import { MarketPicker, type Venue } from "@/components/trade-unauth/pair-header"
import { CandleChart, type ChartKind } from "@/components/trade-unauth/candle-chart"
import { BookPanel } from "@/components/trade-unauth/book"
import { PerpForm, SpotForm, type Picked } from "@/components/trade-unauth/order-form"
import { ActivityPanel } from "@/components/trade-unauth/activity"
import { useFrame } from "@/components/redesign/shell"
import { Icon, Panel, SLIDE } from "@/components/redesign/ui"

type Side = "buy" | "sell" | "long" | "short"
type View = "chart" | "book"

export function MobileTerminal({
  venue,
  onVenue,
  market,
  perp,
  onPick,
  candles,
  book,
  tape,
  tf,
  onTf,
  kind,
  onKind,
  showMA,
  onShowMA,
  minutesPerCandle,
  picked,
  onPickPrice,
  orders,
  positions,
  onPlace,
  onOpen,
  onCancel,
  onClose,
}: {
  venue: Venue
  onVenue: (v: Venue) => void
  market: Market
  perp: Perp
  onPick: (id: string) => void
  candles: Candle[]
  book: Book
  tape: Fill[]
  tf: Timeframe
  onTf: (t: Timeframe) => void
  kind: ChartKind
  onKind: (k: ChartKind) => void
  showMA: boolean
  onShowMA: (v: boolean) => void
  minutesPerCandle: number
  picked: Picked
  onPickPrice: (price: number) => void
  orders: Order[]
  positions: Position[]
  onPlace: (o: Order) => void
  onOpen: (p: Position) => void
  onCancel: (id: string) => void
  onClose: (id: string) => void
}) {
  const { openNav } = useFrame()
  // About half the screen, within sane bounds — 340px was squashed on a tall
  // phone and the chart is the reason to be on this page.
  const [chartH, setChartH] = React.useState(420)
  React.useEffect(() => {
    const fit = () => setChartH(Math.round(Math.min(560, Math.max(380, window.innerHeight * 0.52))))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])
  const [view, setView] = React.useState<View>("chart")
  const [sheet, setSheet] = React.useState<Side | null>(null)
  const [toast, setToast] = React.useState<string | null>(null)
  const current = venue === "spot" ? market : perp
  const up = current.changePct >= 0

  React.useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(t)
  }, [toast])

  // A price tapped in the book opens the form on the matching side: a tap
  // below the spread is a buy price, above it a sell price.
  const pickFromBook = (price: number) => {
    onPickPrice(price)
    const buySide = price <= current.price
    setSheet(venue === "spot" ? (buySide ? "buy" : "sell") : buySide ? "long" : "short")
  }

  const sides: { key: Side; label: string; tone: "credit" | "debit" }[] =
    venue === "spot"
      ? [
          { key: "buy", label: "Buy", tone: "credit" },
          { key: "sell", label: "Sell", tone: "debit" },
        ]
      : [
          { key: "long", label: "Long", tone: "credit" },
          { key: "short", label: "Short", tone: "debit" },
        ]

  return (
    <div className="flex flex-col pb-28">
      {/* ── Compact header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex flex-col gap-2.5 border-b border-white/[0.06] bg-[#080808]/90 px-3 pb-3 pt-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={openNav} aria-label="Open navigation" className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground/80 active:bg-white/[0.06]">
            <Icon icon={Menu01Icon} className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <MarketPicker venue={venue} current={current} onPick={onPick} compact />
          </div>
          <div role="tablist" className="grid shrink-0 grid-cols-2 gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-0.5">
            {(["spot", "futures"] as const).map((v) => (
              <button key={v} role="tab" type="button" aria-selected={venue === v} onClick={() => onVenue(v)} className={cn("relative h-8 rounded-lg px-2.5 text-[12px] font-semibold capitalize", venue === v ? "text-primary-foreground" : "text-muted-foreground")}>
                {venue === v && <motion.span layoutId="venue-mobile" transition={SLIDE} className="dash-gold-btn absolute inset-0 rounded-lg" />}
                <span className="relative">{v === "futures" ? "Perps" : "Spot"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-1">
          <div className="flex items-baseline gap-2.5">
            <motion.span key={current.id} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className={cn("font-display text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums", up ? "text-credit" : "text-debit")}>
              {formatPrice(venue === "futures" ? perp.markPrice : market.price)}
            </motion.span>
            <span className={cn("text-[13px] font-semibold tabular-nums", up ? "text-credit" : "text-debit")}>
              {up ? "+" : "−"}
              {Math.abs(current.changePct).toFixed(2)}% <span className="font-medium text-muted-foreground">24h</span>
            </span>
          </div>
          {/* Own row, four equal cells, label over value — beside the price
              they overlapped it on a 360px screen. */}
          <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] text-[11px]">
            {(venue === "futures"
              ? [
                  ["Funding", `${perp.fundingPct >= 0 ? "+" : ""}${perp.fundingPct.toFixed(4)}%`],
                  ["OI", `$${formatCompact(perp.openInterestUsd)}`],
                  ["Index", formatPrice(perp.price)],
                  ["Vol", `$${formatCompact(perp.volumeUsd)}`],
                ]
              : [
                  ["High", formatPrice(market.high)],
                  ["Low", formatPrice(market.low)],
                  ["Vol", `$${formatCompact(market.volumeUsd)}`],
                  ["Cap", `$${formatCompact(market.marketCapUsd)}`],
                ]
            ).map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5 bg-[#0d0d0d] px-2.5 py-2">
                <dt className="text-[10.5px] text-muted-foreground">{k}</dt>
                <dd className="truncate text-[12px] font-semibold tabular-nums text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      {/* ── Chart | Book ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.025] p-1">
          {(["chart", "book"] as const).map((v) => (
            <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)} className={cn("relative h-8 rounded-lg px-4 text-[12.5px] font-semibold capitalize", view === v ? "text-foreground" : "text-muted-foreground")}>
              {view === v && <motion.span layoutId="mobile-view" transition={SLIDE} className="absolute inset-0 rounded-lg bg-white/[0.08]" />}
              <span className="relative">{v === "book" ? "Book" : "Chart"}</span>
            </button>
          ))}
        </div>
        {view === "chart" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onShowMA(!showMA)} aria-pressed={showMA} className={cn("h-8 rounded-lg border px-2 text-[11.5px] font-semibold", showMA ? "border-primary/40 text-primary" : "border-white/[0.07] text-muted-foreground")}>
              MA
            </button>
            <button type="button" onClick={() => onKind(kind === "candles" ? "line" : "candles")} className="h-8 rounded-lg border border-white/[0.07] px-2 text-[11.5px] font-semibold capitalize text-muted-foreground">
              {kind === "candles" ? "Line" : "Candles"}
            </button>
          </div>
        )}
      </div>

      <div className="px-3 pt-2.5">
        {view === "chart" ? (
          <Panel className="flex flex-col gap-1 p-2.5">
            <div role="tablist" aria-label="Timeframe" className="scrollbar-none flex gap-0.5 overflow-x-auto">
              {TIMEFRAMES.map((t) => (
                <button key={t.key} role="tab" type="button" aria-selected={tf === t.key} onClick={() => onTf(t.key)} className={cn("relative h-7 flex-1 rounded-md text-[12px] font-semibold tabular-nums", tf === t.key ? "text-primary" : "text-muted-foreground")}>
                  {tf === t.key && <motion.span layoutId="tf-mobile" transition={SLIDE} className="absolute inset-0 rounded-md bg-primary/[0.1]" />}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
            <CandleChart candles={candles} kind={kind} showMA={showMA} minutesPerCandle={minutesPerCandle} height={chartH} className="pt-6" />
          </Panel>
        ) : (
          <BookPanel market={current} book={book} tape={tape} onPick={pickFromBook} />
        )}
      </div>

      <div className="px-3 pt-3">
        <ActivityPanel orders={orders} positions={positions} defaultTab={venue === "spot" ? "open" : "positions"} onCancel={onCancel} onClose={onClose} />
      </div>

      {/* ── Sticky action bar ──────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#080808]/92 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <AnimatePresence>
          {toast && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              className="absolute inset-x-3 -top-12 rounded-xl border border-credit/25 bg-[#0d1a14] px-3.5 py-2.5 text-center text-[12.5px] font-medium text-credit shadow-lg"
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
        <div className="grid grid-cols-2 gap-2.5">
          {sides.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSheet(s.key)}
              className={cn("h-12 rounded-xl text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] active:brightness-95", s.tone === "credit" ? "bg-credit" : "bg-debit")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <OrderSheet open={sheet !== null} onClose={() => setSheet(null)} title={venue === "spot" ? `Trade ${market.base}/${market.quote}` : `${perp.base} perpetual`}>
        {sheet !== null &&
          (venue === "spot" ? (
            <SpotForm
              key={`${sheet}-${market.id}`}
              market={market}
              book={book}
              picked={picked}
              initialSide={sheet === "sell" ? "sell" : "buy"}
              onPlace={(o) => {
                onPlace(o)
                setSheet(null)
                setToast(o.status === "open" ? `${o.type === "stop" ? "Stop" : "Limit"} order placed — see Open orders (demo)` : `${o.side === "buy" ? "Bought" : "Sold"} ${o.amount} ${market.base} (demo)`)
              }}
            />
          ) : (
            <PerpForm
              key={`${sheet}-${perp.id}`}
              perp={perp}
              picked={picked}
              initialSide={sheet === "short" ? "short" : "long"}
              onOpen={(p) => {
                onOpen(p)
                setSheet(null)
                setToast(`${p.side === "long" ? "Long" : "Short"} ${perp.base} ${p.leverage}× opened (demo)`)
              }}
            />
          ))}
      </OrderSheet>
    </div>
  )
}

/* ── Bottom sheet ─────────────────────────────────────────────────────── */

function OrderSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  // Portalled to the frame root: an ancestor with a transform would make the
  // fixed sheet stick to it instead of the screen (the bug the transactions
  // sheet had).
  const [host, setHost] = React.useState<Element | null>(null)
  React.useEffect(() => setHost(document.querySelector(".dash-root") ?? document.body), [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    const main = document.querySelector<HTMLElement>(".dash-root main")
    const prev = main?.style.overflowY
    if (main) main.style.overflowY = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (main) main.style.overflowY = prev ?? ""
    }
  }, [open, onClose])

  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm lg:hidden" />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="slim-scroll fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[24px] border-t border-white/[0.08] bg-[#0f0f0f] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-20px_60px_-10px_rgb(0_0_0/0.8)] lg:hidden"
          >
            <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-white/15" />
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[16px] font-semibold">{title}</span>
              <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-white/[0.06]">
                <Icon icon={Cancel01Icon} className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    host,
  )
}
