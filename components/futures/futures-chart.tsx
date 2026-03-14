"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { getFuturesKlines, type Kline } from "@/lib/actions"
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type Time,
  ColorType,
  CrosshairMode,
} from "lightweight-charts"

// ── Constants ────────────────────────────────────────────────────────────

const INTERVALS = ["1min", "5min", "15min", "1h", "4h", "1d"]

type ChartType = "candles" | "line" | "area"
type IndicatorKey =
  | "ma20" | "ma50" | "ma200"
  | "ema9" | "ema21" | "ema50"
  | "bb" | "vwap"
  | "rsi" | "macd" | "stochastic" | "atr" | "obv" | "williamsR" | "cci"

interface IndicatorDef { key: IndicatorKey; label: string; color: string; group: string }

const INDICATORS: IndicatorDef[] = [
  { key: "ma20", label: "MA 20", color: "#f59e0b", group: "Moving Averages" },
  { key: "ma50", label: "MA 50", color: "#3b82f6", group: "Moving Averages" },
  { key: "ma200", label: "MA 200", color: "#8b5cf6", group: "Moving Averages" },
  { key: "ema9", label: "EMA 9", color: "#ec4899", group: "Moving Averages" },
  { key: "ema21", label: "EMA 21", color: "#06b6d4", group: "Moving Averages" },
  { key: "ema50", label: "EMA 50", color: "#14b8a6", group: "Moving Averages" },
  { key: "bb", label: "Bollinger Bands", color: "#6366f1", group: "Overlays" },
  { key: "vwap", label: "VWAP", color: "#f97316", group: "Overlays" },
  { key: "rsi", label: "RSI (14)", color: "#a855f7", group: "Oscillators" },
  { key: "macd", label: "MACD", color: "#22c55e", group: "Oscillators" },
  { key: "stochastic", label: "Stochastic (14,3,3)", color: "#eab308", group: "Oscillators" },
  { key: "williamsR", label: "Williams %R (14)", color: "#ef4444", group: "Oscillators" },
  { key: "cci", label: "CCI (20)", color: "#0ea5e9", group: "Oscillators" },
  { key: "atr", label: "ATR (14)", color: "#f43f5e", group: "Volatility" },
  { key: "obv", label: "OBV", color: "#84cc16", group: "Volume" },
]

// ── Indicator Math ───────────────────────────────────────────────────────

function computeSMA(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    let s = 0
    for (let j = 0; j < period; j++) s += data[i - j]
    r.push(s / period)
  }
  return r
}

function computeEMA(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  const k = 2 / (period + 1)
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    if (i === period - 1) {
      let s = 0
      for (let j = 0; j < period; j++) s += data[i - j]
      r.push(s / period)
      continue
    }
    const prev = r[i - 1]
    if (prev === null) { r.push(null); continue }
    r.push(data[i] * k + prev * (1 - k))
  }
  return r
}

function computeBB(data: number[], period: number, mult: number) {
  const sma = computeSMA(data, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (sma[i] === null) { upper.push(null); lower.push(null); continue }
    let v = 0
    for (let j = 0; j < period; j++) v += (data[i - j] - sma[i]!) ** 2
    const std = Math.sqrt(v / period)
    upper.push(sma[i]! + mult * std)
    lower.push(sma[i]! - mult * std)
  }
  return { upper, middle: sma, lower }
}

function computeVWAP(klines: Kline[]): (number | null)[] {
  const r: (number | null)[] = []
  let cumPV = 0, cumVol = 0
  for (const k of klines) {
    const tp = (k.high + k.low + k.close) / 3
    cumPV += tp * k.volume
    cumVol += k.volume
    r.push(cumVol > 0 ? cumPV / cumVol : null)
  }
  return r
}

function computeRSI(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  if (data.length < period + 1) return data.map(() => null)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff)
  }
  avgGain /= period; avgLoss /= period
  for (let i = 0; i < period; i++) r.push(null)
  r.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
    r.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return r
}

function computeMACD(data: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = computeEMA(data, 12)
  const ema26 = computeEMA(data, 26)
  const macdLine: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (ema12[i] !== null && ema26[i] !== null) macdLine.push(ema12[i]! - ema26[i]!)
    else macdLine.push(null)
  }
  const validMacd = macdLine.filter((v) => v !== null) as number[]
  const signalRaw = computeEMA(validMacd, 9)
  const signal: (number | null)[] = []
  const histogram: (number | null)[] = []
  let si = 0
  for (let i = 0; i < data.length; i++) {
    if (macdLine[i] === null) { signal.push(null); histogram.push(null) }
    else {
      const sv = signalRaw[si] ?? null
      signal.push(sv)
      histogram.push(sv !== null ? macdLine[i]! - sv : null)
      si++
    }
  }
  return { macd: macdLine, signal, histogram }
}

function computeStochastic(klines: Kline[], kPeriod: number, dPeriod: number): { k: (number | null)[]; d: (number | null)[] } {
  const kLine: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i < kPeriod - 1) { kLine.push(null); continue }
    let hi = -Infinity, lo = Infinity
    for (let j = 0; j < kPeriod; j++) {
      hi = Math.max(hi, klines[i - j].high)
      lo = Math.min(lo, klines[i - j].low)
    }
    const range = hi - lo
    kLine.push(range === 0 ? 50 : ((klines[i].close - lo) / range) * 100)
  }
  const dLine = computeSMA(kLine.filter((v) => v !== null) as number[], dPeriod)
  const d: (number | null)[] = []
  let di = 0
  for (let i = 0; i < klines.length; i++) {
    if (kLine[i] === null) d.push(null)
    else { d.push(dLine[di] ?? null); di++ }
  }
  return { k: kLine, d }
}

function computeATR(klines: Kline[], period: number): (number | null)[] {
  const tr: number[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i === 0) { tr.push(klines[i].high - klines[i].low); continue }
    const hl = klines[i].high - klines[i].low
    const hpc = Math.abs(klines[i].high - klines[i - 1].close)
    const lpc = Math.abs(klines[i].low - klines[i - 1].close)
    tr.push(Math.max(hl, hpc, lpc))
  }
  return computeSMA(tr, period)
}

function computeOBV(klines: Kline[]): (number | null)[] {
  const r: (number | null)[] = []
  let obv = 0
  for (let i = 0; i < klines.length; i++) {
    if (i === 0) { r.push(0); continue }
    if (klines[i].close > klines[i - 1].close) obv += klines[i].volume
    else if (klines[i].close < klines[i - 1].close) obv -= klines[i].volume
    r.push(obv)
  }
  return r
}

function computeWilliamsR(klines: Kline[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    let hi = -Infinity, lo = Infinity
    for (let j = 0; j < period; j++) {
      hi = Math.max(hi, klines[i - j].high)
      lo = Math.min(lo, klines[i - j].low)
    }
    const range = hi - lo
    r.push(range === 0 ? -50 : ((hi - klines[i].close) / range) * -100)
  }
  return r
}

function computeCCI(klines: Kline[], period: number): (number | null)[] {
  const tp = klines.map((k) => (k.high + k.low + k.close) / 3)
  const tpSma = computeSMA(tp, period)
  const r: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (tpSma[i] === null) { r.push(null); continue }
    let meanDev = 0
    for (let j = 0; j < period; j++) meanDev += Math.abs(tp[i - j] - tpSma[i]!)
    meanDev /= period
    r.push(meanDev === 0 ? 0 : (tp[i] - tpSma[i]!) / (0.015 * meanDev))
  }
  return r
}

function getCSSColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!v) return fallback
  if (v.startsWith("oklch")) return v
  return v
}

// ── Component ────────────────────────────────────────────────────────────

interface FuturesChartProps {
  symbol: string
  markPrice: number
  change24h: number
}

export function FuturesChart({ symbol, markPrice, change24h }: FuturesChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const mainSeriesRef = React.useRef<ISeriesApi<any> | null>(null)
  const volumeSeriesRef = React.useRef<ISeriesApi<"Histogram"> | null>(null)
  const indicatorSeriesRef = React.useRef<Map<string, ISeriesApi<"Line">>>(new Map())
  const klinesRef = React.useRef<Kline[]>([])
  const chartTypeRef = React.useRef<ChartType>("candles")

  const [interval, setInterval] = React.useState("1h")
  const [loading, setLoading] = React.useState(true)
  const [intervalLoading, setIntervalLoading] = React.useState(false)
  const [hasData, setHasData] = React.useState(false)
  const [chartType, setChartType] = React.useState<ChartType>("candles")
  const [activeIndicators, setActiveIndicators] = React.useState<Set<IndicatorKey>>(new Set())
  const [showIndicatorMenu, setShowIndicatorMenu] = React.useState(false)
  const [crosshairMode, setCrosshairMode] = React.useState<"normal" | "magnet">("normal")
  const indicatorBtnRef = React.useRef<HTMLButtonElement>(null)

  chartTypeRef.current = chartType

  // Reactive dark mode detection
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === "undefined") return true
    return document.documentElement.classList.contains("dark")
  })

  React.useEffect(() => {
    const ob = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    )
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => ob.disconnect()
  }, [])

  React.useEffect(() => {
    if (!showIndicatorMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("[data-indicator-menu]")) return
      setShowIndicatorMenu(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showIndicatorMenu])

  // ── Chart instance ──
  React.useEffect(() => {
    if (!containerRef.current) return

    const el = document.documentElement
    const cs = getComputedStyle(el)
    const bg = cs.getPropertyValue("--card").trim() || (isDark ? "#09090b" : "#ffffff")
    const chartBg = bg.startsWith("oklch") ? bg : bg
    const text = isDark ? "#71717a" : "#a1a1aa"
    const grid = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"
    const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
    const labelBg = isDark ? "#27272a" : "#e4e4e7"

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: chartBg },
        textColor: text,
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 10,
      },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: border, width: 1, style: 3, labelBackgroundColor: labelBg },
        horzLine: { color: border, width: 1, style: 3, labelBackgroundColor: labelBg },
      },
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: border, timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 6 },
      handleScroll: { vertTouchDrag: false },
    })
    chartRef.current = chart

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    volumeSeriesRef.current = vol

    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width > 0 && height > 0) chart.resize(width, height)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      indicatorSeriesRef.current.clear()
      mainSeriesRef.current = null
      volumeSeriesRef.current = null
      chart.remove()
      chartRef.current = null
    }
  }, [isDark])

  // ── Main series ──
  React.useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current) } catch {}
      mainSeriesRef.current = null
    }

    if (chartType === "candles") {
      mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981", downColor: "#ef4444",
        borderDownColor: "#ef4444", borderUpColor: "#10b981",
        wickDownColor: "#ef4444", wickUpColor: "#10b981",
      })
    } else if (chartType === "line") {
      const primary = getCSSColor("--primary", isDark ? "#eab308" : "#ca8a04")
      mainSeriesRef.current = chart.addSeries(LineSeries, {
        color: primary, lineWidth: 2,
      })
    } else {
      const primary = getCSSColor("--primary", isDark ? "#eab308" : "#ca8a04")
      mainSeriesRef.current = chart.addSeries(AreaSeries, {
        lineColor: primary, lineWidth: 2,
        topColor: isDark ? "rgba(234,179,8,0.28)" : "rgba(202,138,4,0.18)",
        bottomColor: isDark ? "rgba(234,179,8,0.02)" : "rgba(202,138,4,0.01)",
      })
    }

    if (klinesRef.current.length) applyMainData(klinesRef.current)
  }, [chartType, isDark])

  // ── Indicator overlays ──
  React.useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    indicatorSeriesRef.current.forEach((s) => { try { chart.removeSeries(s) } catch {} })
    indicatorSeriesRef.current.clear()

    const klines = klinesRef.current
    if (!klines.length) return

    const closes = klines.map((k) => k.close)
    const times = klines.map((k) => (k.time / 1000) as Time)

    function addLine(key: string, values: (number | null)[], color: string, w: 1 | 2 | 3 | 4 = 1) {
      const d: LineData<Time>[] = []
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== null) d.push({ time: times[i], value: values[i]! })
      }
      const s = chart!.addSeries(LineSeries, { color, lineWidth: w, crosshairMarkerVisible: false })
      s.setData(d)
      indicatorSeriesRef.current.set(key, s)
    }

    if (activeIndicators.has("ma20")) addLine("ma20", computeSMA(closes, 20), "#f59e0b")
    if (activeIndicators.has("ma50")) addLine("ma50", computeSMA(closes, 50), "#3b82f6")
    if (activeIndicators.has("ma200")) addLine("ma200", computeSMA(closes, 200), "#8b5cf6")
    if (activeIndicators.has("ema9")) addLine("ema9", computeEMA(closes, 9), "#ec4899")
    if (activeIndicators.has("ema21")) addLine("ema21", computeEMA(closes, 21), "#06b6d4")
    if (activeIndicators.has("ema50")) addLine("ema50", computeEMA(closes, 50), "#14b8a6")
    if (activeIndicators.has("bb")) {
      const bb = computeBB(closes, 20, 2)
      addLine("bb-u", bb.upper, "#6366f1")
      addLine("bb-m", bb.middle, "#6366f1")
      addLine("bb-l", bb.lower, "#6366f1")
    }
    if (activeIndicators.has("vwap")) addLine("vwap", computeVWAP(klines), "#f97316")
    function addOscillator(key: string, values: (number | null)[], color: string, scaleId: string) {
      const d: LineData<Time>[] = []
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== null) d.push({ time: times[i], value: values[i]! })
      }
      const s = chart!.addSeries(LineSeries, {
        color, lineWidth: 1, crosshairMarkerVisible: false, priceScaleId: scaleId,
        lastValueVisible: false, priceLineVisible: false,
      })
      s.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      s.setData(d)
      indicatorSeriesRef.current.set(key, s)
    }
    if (activeIndicators.has("rsi")) addOscillator("rsi", computeRSI(closes, 14), "#a855f7", "rsi")
    if (activeIndicators.has("macd")) {
      const m = computeMACD(closes)
      addOscillator("macd-line", m.macd, "#22c55e", "macd")
      addOscillator("macd-signal", m.signal, "#ef4444", "macd")
    }
    if (activeIndicators.has("stochastic")) {
      const st = computeStochastic(klines, 14, 3)
      addOscillator("stoch-k", st.k, "#eab308", "stoch")
      addOscillator("stoch-d", st.d, "#a855f7", "stoch")
    }
    if (activeIndicators.has("williamsR")) addOscillator("williamsR", computeWilliamsR(klines, 14), "#ef4444", "wr")
    if (activeIndicators.has("cci")) addOscillator("cci", computeCCI(klines, 20), "#0ea5e9", "cci")
    if (activeIndicators.has("atr")) addOscillator("atr", computeATR(klines, 14), "#f43f5e", "atr")
    if (activeIndicators.has("obv")) addOscillator("obv", computeOBV(klines), "#84cc16", "obv")
  }, [activeIndicators, isDark])

  // ── Data fetching ──
  React.useEffect(() => {
    let cancelled = false

    async function fetchKlines() {
      if (hasData) setIntervalLoading(true)
      else setLoading(true)
      try {
        const res = await getFuturesKlines(symbol, interval)
        if (cancelled) return
        if (res.success && res.data.length > 0) {
          klinesRef.current = res.data
          applyAllData(res.data)
          setHasData(true)
        }
      } catch {
        // keep previous data
      } finally {
        if (!cancelled) { setLoading(false); setIntervalLoading(false) }
      }
    }

    async function poll() {
      try {
        const res = await getFuturesKlines(symbol, interval)
        if (cancelled) return
        if (res.success && res.data.length > 0) {
          klinesRef.current = res.data
          applyAllData(res.data)
        }
      } catch {}
    }

    fetchKlines()
    const id = window.setInterval(poll, 5_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [symbol, interval])

  // ── Data helpers ──
  function applyMainData(klines: Kline[]) {
    if (!mainSeriesRef.current) return
    if (chartTypeRef.current === "candles") {
      const d: CandlestickData<Time>[] = klines.map((k) => ({
        time: (k.time / 1000) as Time, open: k.open, high: k.high, low: k.low, close: k.close,
      }))
      mainSeriesRef.current.setData(d)
    } else {
      const d: LineData<Time>[] = klines.map((k) => ({
        time: (k.time / 1000) as Time, value: k.close,
      }))
      mainSeriesRef.current.setData(d)
    }
  }

  function applyVolumeData(klines: Kline[]) {
    if (!volumeSeriesRef.current) return
    const d: HistogramData<Time>[] = klines.map((k) => ({
      time: (k.time / 1000) as Time,
      value: k.volume,
      color: k.close >= k.open ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
    }))
    volumeSeriesRef.current.setData(d)
  }

  function applyAllData(klines: Kline[]) {
    applyMainData(klines)
    applyVolumeData(klines)
    if (chartRef.current && klines.length > 80) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: klines.length - 80,
        to: klines.length + 5,
      })
    }
  }

  // ── Handlers ──
  const isPositive = change24h >= 0

  function handleFit() { chartRef.current?.timeScale().fitContent() }

  function handleCrosshair() {
    const next = crosshairMode === "normal" ? "magnet" : "normal"
    setCrosshairMode(next)
    chartRef.current?.applyOptions({
      crosshair: { mode: next === "magnet" ? CrosshairMode.Magnet : CrosshairMode.Normal },
    })
  }

  function handleScreenshot() {
    const canvas = containerRef.current?.querySelector("canvas")
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = `${symbol}-${interval}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function toggleIndicator(key: IndicatorKey) {
    setActiveIndicators((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Indicator menu position for portal
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null)
  React.useEffect(() => {
    if (!showIndicatorMenu || !indicatorBtnRef.current) { setMenuPos(null); return }
    const r = indicatorBtnRef.current.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 4, left: r.left })
  }, [showIndicatorMenu])

  const indicatorGroups = React.useMemo(() => {
    const groups: Record<string, IndicatorDef[]> = {}
    for (const ind of INDICATORS) {
      if (!groups[ind.group]) groups[ind.group] = []
      groups[ind.group].push(ind)
    }
    return groups
  }, [])

  return (
    <div data-onboarding="futures-chart" className="flex h-full flex-col rounded-xl bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border/20 px-2 py-1 shrink-0 overflow-x-auto">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              interval === iv ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {iv}
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-border/30 shrink-0" />

        {(["candles", "line", "area"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setChartType(t)}
            title={t[0].toUpperCase() + t.slice(1)}
            className={`rounded-md px-1.5 py-1 transition-colors ${
              chartType === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "candles" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4v4m0 8v4m6-16v6m0 4v6M7 8h4v8H7zM13 10h4v4h-4z"/></svg>
            ) : t === "line" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8v14H3z" fill="currentColor" opacity=".15"/><path d="M3 17l6-6 4 4 8-8"/></svg>
            )}
          </button>
        ))}

        <div className="mx-1 h-4 w-px bg-border/30 shrink-0" />

        <button
          ref={indicatorBtnRef}
          onClick={() => setShowIndicatorMenu((p) => !p)}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            activeIndicators.size > 0 || showIndicatorMenu
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Indicators{activeIndicators.size > 0 && ` (${activeIndicators.size})`}
        </button>

        <div className="mx-1 h-4 w-px bg-border/30 shrink-0" />

        <button
          onClick={handleCrosshair}
          title={crosshairMode === "normal" ? "Magnet crosshair" : "Normal crosshair"}
          className={`rounded-md px-1.5 py-1 transition-colors ${
            crosshairMode === "magnet" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M2 12h20"/></svg>
        </button>
        <button onClick={handleFit} title="Fit to view" className="rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
        <button onClick={handleScreenshot} title="Screenshot" className="rounded-md px-1.5 py-1 text-muted-foreground hover:text-foreground transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-[9px] tabular-nums">
            <span className="text-xl font-bold text-foreground">
              ${markPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
          {(loading || intervalLoading) && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
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
        {intervalLoading && hasData && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-card/90 border border-border/20 px-3 py-1 shadow-lg backdrop-blur-sm">
            <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-primary" />
            <span className="text-[10px] text-muted-foreground">Loading {interval}...</span>
          </div>
        )}
      </div>

      {/* Indicator menu portal */}
      {showIndicatorMenu && menuPos && ReactDOM.createPortal(
        <div
          data-indicator-menu
          className="fixed z-[9999] w-56 max-h-[70vh] overflow-y-auto rounded-xl border border-border/20 bg-popover shadow-2xl p-1.5 slim-scroll"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {Object.entries(indicatorGroups).map(([group, items]) => (
            <div key={group}>
              <div className="px-2 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {group}
              </div>
              {items.map((ind) => (
                <button
                  key={ind.key}
                  onClick={() => toggleIndicator(ind.key)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                    activeIndicators.has(ind.key)
                      ? "bg-accent/60 text-foreground"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                  }`}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ind.color }} />
                  {ind.label}
                  {activeIndicators.has(ind.key) && (
                    <svg className="ml-auto h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                </button>
              ))}
            </div>
          ))}
          {activeIndicators.size > 0 && (
            <>
              <div className="my-1 h-px bg-border/20" />
              <button
                onClick={() => setActiveIndicators(new Set())}
                className="flex w-full items-center rounded-md px-2 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10"
              >
                Clear all
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
