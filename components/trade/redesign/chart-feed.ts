"use client"

/**
 * The trade chart's data, without the drawing: the same requests, polling and
 * stats as the real chart (components/trade/candle-chart.tsx), so the
 * preview's SVG chart (./candle-chart.tsx) can draw real candles.
 *
 *  · loadCandles: Hyperliquid for a perp, /api/charts/ohlcv for a spot token
 *  · polled every POLL_MS (15s), aborted when the source or interval changes
 *  · stats derived with the same deriveStats, handed to the header as before
 *  · an interval the source can't serve falls back to 1h, as before
 *  · a CoinGecko price series is a line, never candles
 */

import * as React from "react"

import { INTERVALS, POLL_MS, deriveStats, loadCandles, type Candle, type ChartOrigin, type ChartSource, type ChartStats } from "@/components/trade/candle-chart"
import type { HlCandleInterval } from "@/lib/hl-public"

export type FeedState = "loading" | "ready" | "empty"

export function useChartFeed(
  source: ChartSource | null,
  interval: HlCandleInterval,
  onInterval: (i: HlCandleInterval) => void,
  callbacks: { onStats?: (s: ChartStats | null) => void; onSource?: (o: ChartOrigin) => void },
) {
  const [candles, setCandles] = React.useState<Candle[]>([])
  const [state, setState] = React.useState<FeedState>("loading")
  const [available, setAvailable] = React.useState<string[]>(INTERVALS)
  const [origin, setOrigin] = React.useState<ChartOrigin>(null)
  const cb = React.useRef(callbacks)
  cb.current = callbacks
  const sourceKey = source ? JSON.stringify(source) : ""

  // An interval the source cannot serve moves to the nearest one it can.
  React.useEffect(() => {
    if (available.length > 0 && !available.includes(interval)) {
      onInterval(available.includes("1h") ? "1h" : (available[0] as HlCandleInterval))
    }
  }, [available, interval, onInterval])

  React.useEffect(() => {
    if (!source) return
    const controller = new AbortController()
    let cancelled = false
    let had = false
    setState("loading")
    setAvailable(INTERVALS)
    // Never leave the previous market's bars on screen while the next loads.
    setCandles([])

    const load = async () => {
      try {
        const payload = await loadCandles(source, interval, controller.signal)
        if (cancelled) return
        cb.current.onStats?.(deriveStats(payload.candles, payload.stats))
        setOrigin(payload.source)
        cb.current.onSource?.(payload.source)
        if (payload.intervals?.length) setAvailable(payload.intervals)
        if (payload.candles.length === 0) {
          if (!had) setState("empty")
          return
        }
        had = true
        setCandles(payload.candles)
        setState("ready")
      } catch {
        // Transient: keep whatever is drawn.
        if (!had && !cancelled) setState("empty")
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
  }, [sourceKey, interval])

  return { candles, state, available, origin, asLine: origin === "coingecko" }
}
