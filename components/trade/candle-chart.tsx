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
 *
 * Chrome: the interval switch is the house `Segmented` (one tab system, no
 * exceptions), and an O/H/L/C readout follows the crosshair — the bar under
 * the cursor, or the latest bar when the cursor is elsewhere — so the chart
 * states its numbers instead of asking the eye to read them off an axis.
 * Colours come from the design tokens at mount, not from hard-coded hexes,
 * so the candles are the same emerald and red as every other money figure.
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
import { cn } from "@/lib/utils"
import { Segmented, type SegmentedOption } from "@/components/ui/system"
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
  /** The day's traded range, from the bars themselves. */
  high24h?: number | null
  low24h?: number | null
  /** Other windows the same series can answer for. */
  changePct1h?: number | null
  changePct7d?: number | null
}

const HOUR = 60 * 60
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * The move across a window, or `null` when the loaded series does not span it.
 *
 * The gate is the whole point. A 1m chart holds about sixteen hours, so asking
 * it for a 24h change would return the sixteen-hour move under a "24h" label —
 * the quiet wrongness this codebase refuses. Mirrors `stats24hFrom` on the
 * server, which does the same thing for the one window it reports.
 */
function windowChange(candles: readonly Candle[], seconds: number): number | null {
  if (candles.length === 0) return null
  const last = candles[candles.length - 1]
  const cutoff = last.time - seconds
  if (candles[0].time > cutoff) return null
  let reference = candles[0]
  for (const candle of candles) {
    if (candle.time >= cutoff) {
      reference = candle
      break
    }
  }
  const base = reference.open || reference.close
  if (!base) return null
  return ((last.close - base) / base) * 100
}

/** High and low across a window, on the same "must actually span it" rule. */
function windowRange(
  candles: readonly Candle[],
  seconds: number,
): { high: number; low: number } | null {
  if (candles.length === 0) return null
  const last = candles[candles.length - 1]
  const cutoff = last.time - seconds
  if (candles[0].time > cutoff) return null
  let high = -Infinity
  let low = Infinity
  for (const candle of candles) {
    if (candle.time < cutoff) continue
    if (candle.high > high) high = candle.high
    if (candle.low < low) low = candle.low
  }
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= 0) return null
  return { high, low }
}

/**
 * The figures the market header shows, derived from the series that is already
 * on screen — no second request, and nothing reported that the bars can't back.
 *
 * The upstream's own `stats` stays authoritative where it exists: it is
 * computed from the full history rather than from whatever window this chart
 * happens to be showing.
 */
function deriveStats(candles: readonly Candle[], upstream: ChartStats | null): ChartStats {
  const range = windowRange(candles, DAY)
  const last = candles.length > 0 ? candles[candles.length - 1].close : null
  return {
    price: upstream?.price ?? last,
    changePct24h: upstream?.changePct24h ?? windowChange(candles, DAY),
    volume24h: upstream?.volume24h ?? null,
    high24h: range?.high ?? null,
    low24h: range?.low ?? null,
    changePct1h: windowChange(candles, HOUR),
    changePct7d: windowChange(candles, WEEK),
  }
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

/** What the readout shows: a full bar, or a single sampled price. */
type Readout =
  | { kind: "bar"; open: number; high: number; low: number; close: number; volume: number | null }
  | { kind: "point"; value: number }

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

function fmtReadout(p: number) {
  const { precision } = priceFormatFor(p)
  return p.toLocaleString(undefined, { minimumFractionDigits: Math.min(precision, 2), maximumFractionDigits: precision })
}

function fmtVolume(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

/**
 * The tokens the chart paints with, read off the document so the series are
 * literally the same colour as `text-credit` / `text-debit` beside them.
 *
 * Only a plain hex or rgb() value is accepted: lightweight-charts parses the
 * colours it is given with its own parser (to derive axis-label contrast and
 * gradient stops) and THROWS on anything else — a `color-mix()` or `oklch()`
 * token doesn't degrade to a wrong shade, it blanks the whole canvas. So a
 * token in any other notation falls back to the dark-theme value.
 */
function readPalette() {
  const fallback = {
    credit: "#10B981",
    debit: "#EF4444",
    text: "#71717A",
    font: "system-ui, sans-serif",
  }
  if (typeof window === "undefined") return fallback
  const css = getComputedStyle(document.documentElement)
  const pick = (name: string, dflt: string) => {
    const v = css.getPropertyValue(name).trim()
    return /^#[0-9a-f]{6}$/i.test(v) || /^rgba?\(/i.test(v) ? v : dflt
  }
  // The body's resolved stack (next/font's generated family name), not the
  // `var(--font-sans)` reference — a canvas font string cannot resolve one.
  const bodyFont = getComputedStyle(document.body).fontFamily.trim()
  return {
    credit: pick("--credit", fallback.credit),
    debit: pick("--debit", fallback.debit),
    text: pick("--subtle", fallback.text),
    font: bodyFont || fallback.font,
  }
}

/** A colour with an alpha applied, in the rgba() form the chart can parse. */
function withAlpha(color: string, alpha: number) {
  const hex = color.match(/^#([0-9a-f]{6})$/i)?.[1]
  if (hex) {
    const n = parseInt(hex, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`
  return `rgba(113, 113, 122, ${alpha})`
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
  /* The readout. `hover` is the bar under the crosshair; `latest` is the last
     bar loaded, shown whenever the cursor is off the chart. */
  const [hover, setHover] = React.useState<Readout | null>(null)
  const [latest, setLatest] = React.useState<Readout | null>(null)
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

  // Create the chart once, painted with the document's own tokens.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const palette = readPalette()

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: palette.text,
        fontFamily: palette.font,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: withAlpha(palette.text, 0.1) },
        horzLines: { color: withAlpha(palette.text, 0.1) },
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      crosshair: {
        mode: 0,
        vertLine: { color: withAlpha(palette.text, 0.5), width: 1, style: 3, labelBackgroundColor: "#27272A" },
        horzLine: { color: withAlpha(palette.text, 0.5), width: 1, style: 3, labelBackgroundColor: "#27272A" },
      },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: palette.credit,
      downColor: palette.debit,
      borderVisible: false,
      wickUpColor: palette.credit,
      wickDownColor: palette.debit,
    })
    const area = chart.addSeries(AreaSeries, {
      lineColor: palette.credit,
      lineWidth: 2,
      topColor: withAlpha(palette.credit, 0.22),
      bottomColor: withAlpha(palette.credit, 0),
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
      scaleMargins: { top: 0.84, bottom: 0 },
      visible: false,
    })
    chartRef.current = chart
    seriesRef.current = series
    areaRef.current = area
    volumeRef.current = volume

    // The readout follows the crosshair. Off the chart → back to the latest
    // bar, which the load effect keeps current.
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHover(null)
        return
      }
      const bar = param.seriesData.get(series) as
        | { open?: number; high?: number; low?: number; close?: number }
        | undefined
      const vol = param.seriesData.get(volume) as { value?: number } | undefined
      if (bar && typeof bar.open === "number" && typeof bar.close === "number") {
        setHover({
          kind: "bar",
          open: bar.open,
          high: bar.high ?? bar.open,
          low: bar.low ?? bar.close,
          close: bar.close,
          volume: typeof vol?.value === "number" ? vol.value : null,
        })
        return
      }
      const point = param.seriesData.get(area) as { value?: number } | undefined
      if (point && typeof point.value === "number") {
        setHover({ kind: "point", value: point.value })
        return
      }
      setHover(null)
    })

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
    setHover(null)
    setLatest(null)
    const palette = readPalette()

    const load = async () => {
      try {
        const payload = await loadCandles(source, interval, controller.signal)
        const { candles, stats } = payload
        if (cancelled || !seriesRef.current) return
        onStatsRef.current?.(deriveStats(candles, stats))
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
        const last = candles[candles.length - 1]
        const priceFormat = {
          type: "price" as const,
          ...priceFormatFor(last.close),
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
          setLatest({ kind: "point", value: last.close })
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
          setLatest({
            kind: "bar",
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume,
          })
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
                  c.close >= c.open
                    ? withAlpha(palette.credit, 0.35)
                    : withAlpha(palette.debit, 0.35),
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

  const intervalOptions = React.useMemo<SegmentedOption<HlCandleInterval>[]>(
    () =>
      INTERVALS.map((i) => ({
        key: i,
        label: i,
        disabled: !available.includes(i),
        disabledReason: "Not available for this token's price source",
      })),
    [available],
  )

  const readout = hover ?? latest

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col overflow-hidden", className)}>
      {/* Toolbar: intervals on the left, the readout beside them, source note
          on the right. Wraps on narrow panes rather than clipping. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 px-3 pt-3 pb-1">
        <Segmented
          size="sm"
          value={interval}
          onChange={setIntervalKey}
          options={intervalOptions}
          vividPrefix="chart-interval"
        />

        {readout && state === "ready" && (
          <span
            aria-live="off"
            className="flex min-w-0 items-center gap-x-3 text-[11px] tabular-nums text-muted-foreground"
          >
            {readout.kind === "bar" ? (
              <>
                <Figure label="O" value={fmtReadout(readout.open)} />
                <Figure label="H" value={fmtReadout(readout.high)} />
                <Figure label="L" value={fmtReadout(readout.low)} />
                <Figure
                  label="C"
                  value={fmtReadout(readout.close)}
                  tone={readout.close >= readout.open ? "credit" : "debit"}
                />
                {readout.volume !== null && (
                  <Figure label="Vol" value={fmtVolume(readout.volume)} className="hidden sm:inline-flex" />
                )}
              </>
            ) : (
              <Figure label="Price" value={fmtReadout(readout.value)} />
            )}
          </span>
        )}

        {/* Say where the bars came from. A price series is not trade data, and
            a chart that looks identical either way should admit which it is. */}
        {origin === "coingecko" && (
          <span className="ml-auto hidden shrink-0 text-[10.5px] font-medium text-subtle sm:inline">
            Price history from CoinGecko
          </span>
        )}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />

      {state !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {state === "loading" ? (
            // Neutral, never gold: a spinner is not a brand moment.
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
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

/** One letter + one figure in the readout. */
function Figure({
  label,
  value,
  tone,
  className,
}: {
  label: string
  value: string
  tone?: "credit" | "debit"
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-[10px] font-semibold text-subtle">{label}</span>
      <span
        className={cn(
          "font-medium text-foreground/80",
          tone === "credit" && "text-credit",
          tone === "debit" && "text-debit",
        )}
      >
        {value}
      </span>
    </span>
  )
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
