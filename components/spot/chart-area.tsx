"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { getSpotKlines, type Kline } from "@/lib/actions"
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
  ColorType,
  CrosshairMode,
} from "lightweight-charts"

const INTERVALS = ["1M", "5M", "15M", "1H", "4H", "1D"]

/** Read a CSS custom property from :root and convert oklch → hex via a hidden element */
function getCSSColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  try {
    const el = document.createElement("div")
    el.style.color = `var(${varName})`
    el.style.position = "absolute"
    el.style.visibility = "hidden"
    document.body.appendChild(el)
    const computed = getComputedStyle(el).color
    document.body.removeChild(el)
    if (computed && computed !== "") return computed
  } catch {
    // fallback
  }
  return fallback
}

export function ChartArea({
  symbol,
  price,
  change24h,
}: {
  symbol: string
  price: number
  change24h: number
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const candleSeriesRef = React.useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = React.useRef<ISeriesApi<"Histogram"> | null>(null)
  const [interval, setInterval] = React.useState("1H")
  const [loading, setLoading] = React.useState(true)
  const [hasData, setHasData] = React.useState(false)
  const klinesRef = React.useRef<Kline[]>([])

  // Detect dark mode
  const isDark = React.useMemo(() => {
    if (typeof window === "undefined") return true
    return document.documentElement.classList.contains("dark")
  }, [])

  // Create chart instance
  React.useEffect(() => {
    if (!containerRef.current) return

    // Read bg-card color from CSS custom property so chart matches card backgrounds
    const bgColor = getCSSColor("--card", isDark ? "#1c1917" : "#ffffff")
    const textColor = isDark ? "#71717a" : "#a1a1aa"
    const gridColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"
    const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
    const labelBg = getCSSColor("--muted", isDark ? "#27272a" : "#e4e4e7")

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: borderColor, width: 1, style: 3, labelBackgroundColor: labelBg },
        horzLine: { color: borderColor, width: 1, style: 3, labelBackgroundColor: labelBg },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
      },
      handleScroll: { vertTouchDrag: false },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      borderUpColor: "#10b981",
      wickDownColor: "#ef4444",
      wickUpColor: "#10b981",
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    // Auto-resize
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) chart.resize(width, height)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [isDark])

  // Fetch + update data
  React.useEffect(() => {
    let cancelled = false

    async function fetchKlines() {
      setLoading(true)
      try {
        const res = await getSpotKlines(symbol, interval)
        if (cancelled) return

        if (res.success && res.data.length > 0) {
          klinesRef.current = res.data
          updateChartData(res.data)
          setHasData(true)
        }
      } catch {
        // keep previous data
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function poll() {
      try {
        const res = await getSpotKlines(symbol, interval)
        if (cancelled) return
        if (res.success && res.data.length > 0) {
          klinesRef.current = res.data
          updateChartData(res.data)
        }
      } catch {
        // ignore
      }
    }

    fetchKlines()
    const id = window.setInterval(poll, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol, interval])

  function updateChartData(klines: Kline[]) {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return

    const candles: CandlestickData<Time>[] = klines.map((k) => ({
      time: (k.time / 1000) as Time,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }))

    const volumes: HistogramData<Time>[] = klines.map((k) => ({
      time: (k.time / 1000) as Time,
      value: k.volume,
      color: k.close >= k.open ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
    }))

    candleSeriesRef.current.setData(candles)
    volumeSeriesRef.current.setData(volumes)

    // Fit visible range to last 80 candles
    if (chartRef.current && candles.length > 80) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: candles.length - 80,
        to: candles.length + 5,
      })
    }
  }

  const [crosshairMode, setCrosshairMode] = React.useState<"normal" | "magnet">("normal")
  const isPositive = change24h >= 0

  function handleFitView() {
    chartRef.current?.timeScale().fitContent()
  }

  function handleToggleCrosshair() {
    const next = crosshairMode === "normal" ? "magnet" : "normal"
    setCrosshairMode(next)
    chartRef.current?.applyOptions({
      crosshair: { mode: next === "magnet" ? CrosshairMode.Magnet : CrosshairMode.Normal },
    })
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border/20 px-3 py-1.5 shrink-0">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              interval === iv
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {iv}
          </button>
        ))}

        {/* Chart tools */}
        <div className="mx-1 h-4 w-px bg-border/30" />
        <button
          onClick={handleToggleCrosshair}
          title={crosshairMode === "normal" ? "Switch to magnet crosshair" : "Switch to normal crosshair"}
          className={`rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors ${
            crosshairMode === "magnet"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </button>
        <button
          onClick={handleFitView}
          title="Fit chart to view"
          className="rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[9px] tabular-nums">
            <span className="text-xl font-bold text-foreground">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
          {loading && (
            <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-card">
            {loading ? (
              <HugeiconsIcon icon={Loading03Icon} className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-xs text-muted-foreground">No chart data available</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
