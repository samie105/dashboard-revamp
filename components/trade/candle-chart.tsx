"use client"

/**
 * Candlestick chart for /trade — lightweight-charts v5 over Hyperliquid's
 * public candleSnapshot (lib/hl-public), the same data source mobile's trade
 * screen charts. Re-fetches on coin/interval change and polls to keep the
 * last bar fresh.
 */

import * as React from "react"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { fetchHlCandles, type HlCandleInterval } from "@/lib/hl-public"

const INTERVALS: HlCandleInterval[] = ["1m", "5m", "15m", "1h", "4h", "1d"]
const POLL_MS = 10_000

export function CandleChart({ coin, className }: { coin: string | null; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const seriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeRef = React.useRef<ISeriesApi<"Histogram"> | null>(null)
  const [interval, setIntervalKey] = React.useState<HlCandleInterval>("1h")
  const [empty, setEmpty] = React.useState(false)

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
    volumeRef.current = volume
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeRef.current = null
    }
  }, [])

  // Load + poll candles for the active coin/interval.
  React.useEffect(() => {
    if (!coin || !seriesRef.current) return
    let cancelled = false
    let first = true

    const load = async () => {
      try {
        const candles = await fetchHlCandles(coin, interval)
        if (cancelled || !seriesRef.current) return
        setEmpty(candles.length === 0)
        seriesRef.current.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })),
        )
        volumeRef.current?.setData(
          candles.map((c) => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
          })),
        )
        if (first) {
          chartRef.current?.timeScale().fitContent()
          first = false
        }
      } catch {
        // transient HL hiccup — keep the last data on screen
      }
    }

    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [coin, interval])

  return (
    <div className={`flex h-full min-h-0 flex-col ${className ?? ""}`}>
      <div className="flex items-center gap-0.5 px-2 pt-2">
        {INTERVALS.map((i) => (
          <button
            key={i}
            onClick={() => setIntervalKey(i)}
            className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              interval === i ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            {i}
          </button>
        ))}
        {empty && <span className="ml-2 text-xs text-muted-foreground">No candle data for this market.</span>}
      </div>
      <div ref={containerRef} className="min-h-[260px] flex-1" />
    </div>
  )
}
