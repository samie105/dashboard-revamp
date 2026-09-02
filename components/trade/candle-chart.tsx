"use client"

/**
 * The trade chart — TradingView's `lightweight-charts` over whichever source
 * actually knows the market.
 *
 * It used to take a Hyperliquid coin name and nothing else, which is why spot
 * had no chart: Hyperliquid is a perps venue that knows a few dozen majors by
 * ticker, and the spot registry is 9,000+ long-tail tokens identified by
 * contract address. Rather than reach for the TradingView *widget* — which
 * needs a symbol TradingView carries, and does not carry these — the chart
 * keeps TradingView's library and takes its data from a source keyed the way
 * the market actually is: by address, per chain (see /api/charts/ohlcv).
 *
 * `source` is a discriminated union so a caller cannot hand a mint to the
 * perps loader, or a perp ticker to the DEX one.
 */

import * as React from "react"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { fetchHlCandles, type HlCandleInterval } from "@/lib/hl-public"

const INTERVALS: HlCandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"]
const POLL_MS = 15_000

export type ChartSource =
  /** A perpetual contract — Hyperliquid is authoritative for its own venue. */
  | { kind: "hyperliquid"; coin: string }
  /** A spot market: its contract on its chain, plus the registry's CoinGecko
   *  id, which is the only source for the many tokens with no pool. */
  | { kind: "dex"; networkId: string; token: string; coingeckoId?: string | null }

export type ChartStats = {
  price: number | null
  changePct24h: number | null
  volume24h: number | null
}

type ChartPayload = {
  candles: Candle[]
  stats: ChartStats | null
  source: "birdeye" | "geckoterminal" | "coingecko" | null
  intervals?: string[]
}

type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Decimals the axis should carry for a price of this size.
 *
 * One fixed precision cannot serve this chart: the registry spans BTC at
 * ~$77,000 and memecoins at 1e-9. Two decimals draws every long-tail token as
 * a flat line at $0.00; six decimals writes BTC as "77437.000000".
 */
function priceFormatFor(price: number): { precision: number; minMove: number } {
  if (!Number.isFinite(price) || price <= 0) return { precision: 4, minMove: 0.0001 }
  if (price >= 1000) return { precision: 2, minMove: 0.01 }
  if (price >= 1) return { precision: 4, minMove: 0.0001 }
  if (price >= 0.01) return { precision: 6, minMove: 0.000001 }
  return { precision: 9, minMove: 0.000000001 }
}

async function loadCandles(
  source: ChartSource,
  interval: HlCandleInterval,
  signal: AbortSignal,
): Promise<ChartPayload> {
  if (source.kind === "hyperliquid") {
    const candles = await fetchHlCandles(source.coin, interval)
    return { candles, stats: null, source: null }
  }
  const url = new URL("/api/charts/ohlcv", window.location.origin)
  url.searchParams.set("network", source.networkId)
  url.searchParams.set("token", source.token)
  url.searchParams.set("interval", interval)
  if (source.coingeckoId) url.searchParams.set("cg", source.coingeckoId)
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Chart source returned ${response.status}`)
  return (await response.json()) as ChartPayload
}

export function CandleChart({
  source,
  onStats,
  className,
}: {
  source: ChartSource | null
  /** 24h figures from the chart's own source, for the market strip. */
  onStats?: (stats: ChartStats | null) => void
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null)
  /* A price series is not trade data and must not be drawn as candles.
     CoinGecko samples hourly, so bucketing to a 1h bar gives ONE sample per
     bar — open, high, low and close all the same number, which candlestick
     rendering turns into a field of one-pixel dashes. It is a line; it gets
     drawn as a line. */
  const areaRef = React.useRef<ISeriesApi<"Area"> | null>(null)
  const [interval, setIntervalKey] = React.useState<HlCandleInterval>("1h")
  const [state, setState] = React.useState<"loading" | "ready" | "empty">("loading")
  /* Which intervals THIS token can be drawn at, and by whom. A token with no
     pool is charted from a price series whose finest sample is five minutes,
     so a 1m button there would be a control that returns nothing. */
  const [available, setAvailable] = React.useState<string[]>(INTERVALS)
  const [origin, setOrigin] = React.useState<ChartPayload["source"]>(null)
  /* A fit that is owed but cannot be performed yet.
     The first candles routinely arrive while the pane still measures zero
     wide — `fitContent` against that computes a bar spacing for a chart of no
     width, and since bars anchor to the right edge the whole series ends up
     crushed into the right-hand corner with dead space beside it. So the fit
     is a debt: taken on when new data lands, paid the moment the container
     has a width, and never paid twice — a user who has zoomed in is not
     yanked back by a later layout shift. */
  const fitOwedRef = React.useRef(false)
  /* When the data landed. The pane can be laid out in stages — a grid column
     settling, a sibling rail appearing — and a fit performed at the first
     non-zero width can still be a fit to the wrong width. Re-fitting on any
     resize for a moment afterwards rides that out; the window closes, so a
     user who has zoomed in is never yanked back later. */
  const settledAtRef = React.useRef(0)

  const settleFit = React.useCallback(() => {
    if (!containerRef.current?.clientWidth) return
    const owed = fitOwedRef.current
    const settling = Date.now() - settledAtRef.current < 2500
    if (!owed && !settling) return
    chartRef.current?.timeScale().fitContent()
    if (owed) {
      fitOwedRef.current = false
      settledAtRef.current = Date.now()
    }
  }, [])

  // The effect must not re-run because the parent rebuilt an equal object.
  const sourceKey = source
    ? source.kind === "hyperliquid"
      ? `hl:${source.coin}`
      : `dex:${source.networkId}:${source.token}`
    : ""

  // `onStats` is usually an inline arrow; holding it in a ref keeps it out of
  // the effect's deps so a parent re-render can't restart the poll.
  const onStatsRef = React.useRef(onStats)
  React.useEffect(() => {
    onStatsRef.current = onStats
  })

  // Create the chart once; theme-neutral colours so light and dark both work.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 0 },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    })
    const area = chart.addSeries(AreaSeries, {
      lineColor: "#10b981",
      lineWidth: 2,
      topColor: "rgba(16, 185, 129, 0.22)",
      bottomColor: "rgba(16, 185, 129, 0)",
      priceLineVisible: true,
      visible: false,
    })
    // Volume rides an overlay scale pinned to the bottom fifth — the standard
    // exchange chart footprint.
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      visible: false,
    })
    chartRef.current = chart
    seriesRef.current = series
    areaRef.current = area
    volumeRef.current = volume

    // The chart's own `autoSize` handles resizing; this observer exists only
    // to notice the moment the pane first HAS a width.
    const observer = new ResizeObserver(() => settleFit())
    observer.observe(el)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      areaRef.current = null
      volumeRef.current = null
    }
  }, [settleFit])

  /* If the source cannot serve the selected interval, move to the nearest one
     it can rather than leaving the pane empty under a highlighted button. */
  React.useEffect(() => {
    if (available.length > 0 && !available.includes(interval)) {
      setIntervalKey(available.includes("1h") ? "1h" : (available[0] as HlCandleInterval))
    }
  }, [available, interval])

  // Load + poll candles for the active source/interval.
  React.useEffect(() => {
    if (!source || !seriesRef.current) return
    const controller = new AbortController()
    let cancelled = false
    let first = true
    setState("loading")
    setAvailable(INTERVALS)

    const load = async () => {
      try {
        const payload = await loadCandles(source, interval, controller.signal)
        const { candles, stats } = payload
        if (cancelled || !seriesRef.current) return
        onStatsRef.current?.(stats)
        setOrigin(payload.source)
        if (payload.intervals?.length) setAvailable(payload.intervals)
        if (candles.length === 0) {
          // Only claim "no data" on the FIRST answer. A later empty response
          // is an upstream wobble, and blanking a chart the user is reading
          // is worse than leaving the last bars up.
          if (first) {
            seriesRef.current.setData([])
            areaRef.current?.setData([])
            volumeRef.current?.setData([])
            setState("empty")
          }
          return
        }
        // Sized from the data, not the source: the same series can be BTC or a
        // token nine decimals below a cent.
        const priceFormat = {
          type: "price" as const,
          ...priceFormatFor(candles[candles.length - 1].close),
        }
        // A sampled price line gets a line. Only a source that reports real
        // per-bar OHLC earns candlesticks.
        const asLine = payload.source === "coingecko"
        seriesRef.current.applyOptions({ priceFormat, visible: !asLine })
        areaRef.current?.applyOptions({ priceFormat, visible: asLine })

        if (asLine) {
          areaRef.current?.setData(
            candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })),
          )
          seriesRef.current.setData([])
        } else {
          seriesRef.current.setData(
            candles.map((c) => ({
              time: c.time as UTCTimestamp,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            })),
          )
          areaRef.current?.setData([])
        }
        volumeRef.current?.setData(
          // A price series carries no volume, so the histogram stays empty
          // rather than drawing a flat row of nothing.
          asLine
            ? []
            : candles.map((c) => ({
                time: c.time as UTCTimestamp,
                value: c.volume,
                color:
                  c.close >= c.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
              })),
        )
        setState("ready")
        if (first) {
          first = false
          fitOwedRef.current = true
          settleFit()
        }
      } catch {
        // Transient — keep whatever is already drawn.
        if (first) setState("empty")
      }
    }

    void load()
    const id = setInterval(() => void load(), POLL_MS)
    return () => {
      cancelled = true
      controller.abort()
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, interval, settleFit])

  return (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${className ?? ""}`}>
      <div className="flex items-center gap-0.5 px-2 pt-2">
        {INTERVALS.map((i) => {
          const usable = available.includes(i)
          return (
            <button
              key={i}
              onClick={() => setIntervalKey(i)}
              disabled={!usable}
              title={usable ? undefined : "Not available for this token's price source"}
              data-vivid-target={`chart-interval-${i}`}
              data-vivid-label={`Show the ${i} candle interval`}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                interval === i
                  ? "bg-accent text-foreground"
                  : usable
                    ? "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    : "cursor-not-allowed text-subtle/40"
              }`}
            >
              {i}
            </button>
          )
        })}
        {/* Say where the bars came from. A price series is not trade data, and
            a chart that looks identical either way should admit which it is. */}
        {origin === "coingecko" && (
          <span className="ml-auto pr-2 text-[10px] font-medium text-subtle">
            CoinGecko · price history
          </span>
        )}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />

      {state !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {state === "loading" ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <p className="max-w-xs px-6 text-center text-xs leading-relaxed text-muted-foreground">
              No price history for this token yet — it isn&apos;t in an indexed
              pool. You can still trade it.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
