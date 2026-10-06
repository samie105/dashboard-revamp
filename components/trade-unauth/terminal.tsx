"use client"

/**
 * The trading terminal.
 *
 * Five panels on one grid (see .trade-grid in globals.css): the pair header,
 * the chart, the book, the order form and the activity panel. They share one
 * state, held here, because they are one instrument:
 *
 *   · switching pair or venue re-seeds the chart, the book and the form
 *   · clicking a price in the book fills the form's limit price
 *   · placing an order or opening a position lands in the activity panel,
 *     where it can be cancelled or closed
 *
 * The venue (spot / futures) and the pair live in the URL, so the markets
 * page can deep-link a row straight into the right market.
 */

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import {
  DEFAULT_PAIR,
  ORDERS,
  TIMEFRAMES,
  bookFor,
  formatPrice,
  candlesFor,
  pairById,
  tapeFor,
  type Order,
  type Timeframe,
} from "@/components/trade-unauth/trade-data"
import {
  DEFAULT_PERP,
  POSITIONS,
  perpById,
  type Position,
} from "@/components/trade-unauth/futures-data"
import { PairHeader, type Venue } from "@/components/trade-unauth/pair-header"
import {
  CandleChart,
  type ChartKind,
} from "@/components/trade-unauth/candle-chart"
import { BookPanel } from "@/components/trade-unauth/book"
import {
  OrderPanel,
  PerpForm,
  SpotForm,
  type Picked,
} from "@/components/trade-unauth/order-form"
import { ActivityPanel } from "@/components/trade-unauth/activity"
import { MobileTerminal } from "@/components/trade-unauth/mobile"
import { Panel, SLIDE } from "@/components/redesign/ui"

/** A clicked book price, rounded to exactly what the row displayed — the
 *  form should fill "182.59", not the float behind it (182.58669761). */
const asShown = (price: number) => Number(formatPrice(price).replace(/,/g, ""))

const MINUTES: Record<Timeframe, number> = {
  "1m": 1,
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
}

/** Chart height by breakpoint — measured once on mount, server default in between. */
function useChartHeight() {
  const [h, setH] = React.useState(440)
  React.useEffect(() => {
    const pick = () =>
      setH(
        window.innerWidth >= 1280 ? 470 : window.innerWidth >= 768 ? 420 : 300
      )
    pick()
    window.addEventListener("resize", pick)
    return () => window.removeEventListener("resize", pick)
  }, [])
  return h
}

export function Terminal({
  initialVenue,
  initialPair,
  bareUrl,
}: {
  initialVenue: Venue
  initialPair?: string
  bareUrl?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [venue, setVenue] = React.useState<Venue>(initialVenue)
  const [pairId, setPairId] = React.useState(
    initialVenue === "spot" && initialPair
      ? pairById(initialPair).id
      : DEFAULT_PAIR.id
  )
  const [perpId, setPerpId] = React.useState(
    initialVenue === "futures" && initialPair
      ? perpById(initialPair).id
      : DEFAULT_PERP.id
  )
  const [tf, setTf] = React.useState<Timeframe>("1h")
  const [kind, setKind] = React.useState<ChartKind>("candles")
  const [showMA, setShowMA] = React.useState(true)
  const [picked, setPicked] = React.useState<Picked>(null)
  const [orders, setOrders] = React.useState<Order[]>(ORDERS)
  const [positions, setPositions] = React.useState<Position[]>(POSITIONS)
  const chartH = useChartHeight()

  const market = pairById(pairId)
  const perp = perpById(perpId)
  const current = venue === "spot" ? market : perp
  const candles = React.useMemo(() => candlesFor(current, tf), [current, tf])
  const book = React.useMemo(() => bookFor(current, 18), [current])
  const tape = React.useMemo(() => tapeFor(current, 30), [current])

  // Keep the URL describing the screen (replace, not push: flicking between
  // pairs shouldn't fill the back button).
  const sync = (v: Venue, id: string) =>
    router.replace(`${pathname}?market=${v}&pair=${encodeURIComponent(id)}`, {
      scroll: false,
    })
  // Arriving on a bare /trade-unauth: write the default market into the URL
  // so the rail's Trade row lights up and a refresh lands in the same place.
  React.useEffect(() => {
    if (bareUrl)
      router.replace(
        `${pathname}?market=${venue}&pair=${encodeURIComponent(venue === "spot" ? pairId : perpId)}`,
        { scroll: false }
      )
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickVenue = (v: Venue) => {
    setVenue(v)
    setPicked(null)
    sync(v, v === "spot" ? pairId : perpId)
  }
  const pickPair = (id: string) => {
    setPicked(null)
    if (venue === "spot") setPairId(id)
    else setPerpId(id)
    sync(venue, id)
  }

  const placeOrder = (o: Order) => setOrders((list) => [o, ...list])
  const openPosition = (p: Position) => setPositions((list) => [p, ...list])
  const cancelOrder = (id: string) =>
    setOrders((list) =>
      list.map((o) =>
        o.id === id ? { ...o, status: "cancelled" as const } : o
      )
    )
  const closePosition = (id: string) =>
    setPositions((list) => list.filter((p) => p.id !== id))
  const pickPrice = (price: number) =>
    setPicked({ price: asShown(price), nonce: Date.now() })

  return (
    <>
      {/* Phone: an isolated terminal of its own (see mobile.tsx). */}
      <div className="lg:hidden">
        <MobileTerminal
          venue={venue}
          onVenue={pickVenue}
          market={market}
          perp={perp}
          onPick={pickPair}
          candles={candles}
          book={book}
          tape={tape}
          tf={tf}
          onTf={setTf}
          kind={kind}
          onKind={setKind}
          showMA={showMA}
          onShowMA={setShowMA}
          minutesPerCandle={MINUTES[tf]}
          picked={picked}
          onPickPrice={pickPrice}
          orders={orders}
          positions={positions}
          onPlace={placeOrder}
          onOpen={openPosition}
          onCancel={cancelOrder}
          onClose={closePosition}
        />
      </div>

      {/* lg and up: the five-panel grid. Wrapped, because .trade-grid sets
        display itself and would override a `hidden` utility on the grid. */}
      <div className="hidden lg:block">
        <div className="trade-grid">
          <div data-area="head" className="min-w-0">
            <PairHeader
              venue={venue}
              onVenue={pickVenue}
              market={market}
              perp={perp}
              onPick={pickPair}
            />
          </div>

          <div data-area="chart" className="min-w-0">
            <Panel className="flex flex-col gap-2 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div
                  role="tablist"
                  aria-label="Timeframe"
                  className="scrollbar-none flex gap-0.5 overflow-x-auto"
                >
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      type="button"
                      aria-selected={tf === t.key}
                      onClick={() => setTf(t.key)}
                      className={cn(
                        "relative h-8 rounded-lg px-2.5 text-[12.5px] font-semibold tabular-nums transition-colors",
                        tf === t.key
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tf === t.key && (
                        <motion.span
                          layoutId="tf-pill"
                          transition={SLIDE}
                          className="absolute inset-0 rounded-lg bg-primary/[0.1]"
                        />
                      )}
                      <span className="relative">{t.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowMA((v) => !v)}
                    aria-pressed={showMA}
                    className={cn(
                      "h-8 rounded-lg border px-2.5 text-[12px] font-semibold transition-colors",
                      showMA
                        ? "border-primary/40 text-primary"
                        : "border-white/[0.07] text-muted-foreground hover:text-foreground"
                    )}
                  >
                    MA
                  </button>
                  <div className="grid grid-cols-2 gap-0.5 rounded-lg border border-white/[0.07] p-0.5">
                    {(["candles", "line"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        aria-pressed={kind === k}
                        className={cn(
                          "h-7 rounded-md px-2.5 text-[12px] font-semibold capitalize transition-colors",
                          kind === k
                            ? "bg-white/[0.08] text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <CandleChart
                candles={candles}
                kind={kind}
                showMA={showMA}
                minutesPerCandle={MINUTES[tf]}
                height={chartH}
                className="pt-6"
              />
            </Panel>
          </div>

          <div data-area="book" className="min-w-0">
            <BookPanel
              market={current}
              book={book}
              tape={tape}
              onPick={pickPrice}
              className="h-full"
            />
          </div>

          <div data-area="ticket" className="min-w-0">
            {/* Sticky on wide screens: the form stays in reach while the
            activity panel scrolls under it. */}
            <div className="xl:sticky xl:top-4">
              <OrderPanel
                title={venue === "spot" ? "Spot order" : "Perpetual order"}
              >
                {venue === "spot" ? (
                  <SpotForm
                    market={market}
                    book={book}
                    picked={picked}
                    onPlace={placeOrder}
                  />
                ) : (
                  <PerpForm perp={perp} picked={picked} onOpen={openPosition} />
                )}
              </OrderPanel>
            </div>
          </div>

          <div data-area="orders" className="min-w-0">
            <ActivityPanel
              orders={orders}
              positions={positions}
              defaultTab={venue === "spot" ? "open" : "positions"}
              onCancel={cancelOrder}
              onClose={closePosition}
            />
          </div>
        </div>
      </div>
    </>
  )
}
