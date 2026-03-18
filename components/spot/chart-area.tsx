"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, Menu01Icon } from "@hugeicons/core-free-icons"
import { getSpotKlines, type Kline } from "@/lib/actions"
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

const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "3m", value: "3m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H", value: "1H" },
  { label: "2H", value: "2H" },
  { label: "4H", value: "4H" },
  { label: "12H", value: "12H" },
  { label: "1D", value: "1D" },
  { label: "1W", value: "1W" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
]

// Map chart interval labels → Hyperliquid WS candle subscription intervals
const HL_WS_INTERVAL: Record<string, string> = {
  "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1H": "1h", "2H": "2h", "4H": "4h", "12H": "12h",
  "1D": "1d", "1W": "1w", "3M": "1M", "6M": "1M", "1Y": "1M",
}

// Interval durations in seconds for countdown timer
const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
  "1H": 3600, "2H": 7200, "4H": 14400, "12H": 43200,
  "1D": 86400, "1W": 604800,
}

function CandleCountdown({ interval }: { interval: string }) {
  const [remaining, setRemaining] = React.useState("")

  React.useEffect(() => {
    const seconds = INTERVAL_SECONDS[interval]
    if (!seconds) { setRemaining(""); return }

    function update() {
      const now = Math.floor(Date.now() / 1000)
      const elapsed = now % seconds
      const left = seconds - elapsed
      const h = Math.floor(left / 3600)
      const m = Math.floor((left % 3600) / 60)
      const s = left % 60
      if (h > 0) setRemaining(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
      else if (m > 0) setRemaining(`${m}:${String(s).padStart(2, "0")}`)
      else setRemaining(`${s}s`)
    }

    update()
    const id = window.setInterval(update, 1000)
    return () => clearInterval(id)
  }, [interval])

  if (!remaining) return null

  return (
    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
      {remaining}
    </span>
  )
}

// ── Drawing Tools ────────────────────────────────────────────────────────

type DrawingType =
  | "line" | "hline" | "vline" | "ray"
  | "channel" | "fib" | "rect" | "text"
  | "longpos" | "shortpos" | "pitchfork" | "measure" | "arrow"
type DrawTool = "select" | DrawingType

interface DrawPoint { price: number; time: number }
interface Drawing {
  id: string
  type: DrawingType
  points: DrawPoint[]
  color: string
  text?: string
  selected?: boolean
}

const POINT_COUNT: Record<DrawingType, number> = {
  line: 2, hline: 1, vline: 1, ray: 2, channel: 3,
  fib: 2, rect: 2, text: 1, longpos: 3, shortpos: 3,
  pitchfork: 3, measure: 2, arrow: 2,
}

const DRAW_PALETTE = ["#f97316", "#3b82f6", "#22c55e", "#ef4444", "#a855f7", "#eab308", "#06b6d4", "#ec4899", "#ffffff", "#64748b"]

// ── Drawing tool groups for collapsible sidebar ──────────────────────────

interface ToolDef { tool: DrawTool; title: string; icon: React.ReactNode }
interface ToolGroup { label: string; tools: ToolDef[] }

const SZ = 18 // icon size for drawing tools

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Lines",
    tools: [
      { tool: "line",  title: "Trend Line",      icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4"/></svg> },
      { tool: "hline", title: "Horizontal Line",  icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg> },
      { tool: "vline", title: "Vertical Line",    icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="3" x2="12" y2="21"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg> },
      { tool: "ray",   title: "Ray",              icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="4" y1="20" x2="18" y2="6"/><path d="M16 6h4v4"/></svg> },
      { tool: "arrow", title: "Arrow",            icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19l14-14M19 5h-6M19 5v6"/></svg> },
    ],
  },
  {
    label: "Shapes",
    tools: [
      { tool: "rect",    title: "Rectangle",   icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="1.5"/></svg> },
      { tool: "channel", title: "Channel",      icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M3 21l6-6 4 4 8-8" opacity="0.4"/></svg> },
    ],
  },
  {
    label: "Analysis",
    tools: [
      { tool: "fib",       title: "Fibonacci",  icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="3" y1="4" x2="21" y2="4"/><line x1="3" y1="9" x2="21" y2="9" opacity="0.6"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="20" x2="21" y2="20" opacity="0.6"/></svg> },
      { tool: "pitchfork", title: "Pitchfork",  icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v16M12 10l-6 10M12 10l6 10"/></svg> },
      { tool: "measure",   title: "Measure",    icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20h16M4 20V8M20 20V8M8 20v-3M12 20V8M16 20v-3"/></svg> },
    ],
  },
  {
    label: "Positions",
    tools: [
      { tool: "longpos",  title: "Long Position",  icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4l-4 6h8z" fill="#10b981" stroke="#10b981"/><line x1="4" y1="12" x2="20" y2="12" stroke="#f97316"/><path d="M12 20l-4-6h8z" fill="#ef4444" stroke="#ef4444"/></svg> },
      { tool: "shortpos", title: "Short Position", icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4l-4 6h8z" fill="#ef4444" stroke="#ef4444"/><line x1="4" y1="12" x2="20" y2="12" stroke="#f97316"/><path d="M12 20l-4-6h8z" fill="#10b981" stroke="#10b981"/></svg> },
    ],
  },
  {
    label: "Annotate",
    tools: [
      { tool: "text", title: "Text Annotation", icon: <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M9 7v12M15 7v12"/></svg> },
    ],
  },
]
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const FIB_COLORS: Record<number, string> = {
  0: "#94a3b8", 0.236: "#3b82f6", 0.382: "#22c55e", 0.5: "#f97316",
  0.618: "#f59e0b", 0.786: "#a855f7", 1: "#64748b",
}

type ChartType = "candles" | "line" | "area"
type IndicatorKey =
  | "ma9" | "ma20" | "ma50" | "ma100" | "ma200"
  | "ema9" | "ema21" | "ema50" | "ema100" | "ema200"
  | "dema9" | "dema21" | "tema9" | "tema21"
  | "wma20" | "wma50" | "hma9" | "hma21"
  | "bb" | "vwap" | "ichimoku" | "sar" | "donchian" | "keltner" | "supertrend"
  | "rsi" | "macd" | "stochastic" | "atr" | "obv" | "williamsR" | "cci"
  | "adx" | "mfi" | "roc" | "momentum" | "cmf" | "trix"

interface IndicatorDef { key: IndicatorKey; label: string; color: string; group: string }

const INDICATORS: IndicatorDef[] = [
  // Moving Averages
  { key: "ma9", label: "SMA 9", color: "#f97316", group: "Moving Averages" },
  { key: "ma20", label: "SMA 20", color: "#f59e0b", group: "Moving Averages" },
  { key: "ma50", label: "SMA 50", color: "#3b82f6", group: "Moving Averages" },
  { key: "ma100", label: "SMA 100", color: "#06b6d4", group: "Moving Averages" },
  { key: "ma200", label: "SMA 200", color: "#8b5cf6", group: "Moving Averages" },
  { key: "ema9", label: "EMA 9", color: "#ec4899", group: "Moving Averages" },
  { key: "ema21", label: "EMA 21", color: "#06b6d4", group: "Moving Averages" },
  { key: "ema50", label: "EMA 50", color: "#14b8a6", group: "Moving Averages" },
  { key: "ema100", label: "EMA 100", color: "#84cc16", group: "Moving Averages" },
  { key: "ema200", label: "EMA 200", color: "#a855f7", group: "Moving Averages" },
  // Advanced MAs
  { key: "dema9", label: "DEMA 9", color: "#fb923c", group: "Advanced MAs" },
  { key: "dema21", label: "DEMA 21", color: "#38bdf8", group: "Advanced MAs" },
  { key: "tema9", label: "TEMA 9", color: "#f472b6", group: "Advanced MAs" },
  { key: "tema21", label: "TEMA 21", color: "#4ade80", group: "Advanced MAs" },
  { key: "wma20", label: "WMA 20", color: "#c084fc", group: "Advanced MAs" },
  { key: "wma50", label: "WMA 50", color: "#22d3ee", group: "Advanced MAs" },
  { key: "hma9", label: "HMA 9", color: "#fb7185", group: "Advanced MAs" },
  { key: "hma21", label: "HMA 21", color: "#34d399", group: "Advanced MAs" },
  // Overlays
  { key: "bb", label: "Bollinger Bands (20,2)", color: "#6366f1", group: "Overlays" },
  { key: "vwap", label: "VWAP", color: "#f97316", group: "Overlays" },
  { key: "ichimoku", label: "Ichimoku Cloud", color: "#ef4444", group: "Overlays" },
  { key: "sar", label: "Parabolic SAR", color: "#fbbf24", group: "Overlays" },
  { key: "donchian", label: "Donchian Channels (20)", color: "#2dd4bf", group: "Overlays" },
  { key: "keltner", label: "Keltner Channels", color: "#a78bfa", group: "Overlays" },
  { key: "supertrend", label: "Supertrend (10,3)", color: "#22c55e", group: "Overlays" },
  // Oscillators
  { key: "rsi", label: "RSI (14)", color: "#a855f7", group: "Oscillators" },
  { key: "macd", label: "MACD (12,26,9)", color: "#22c55e", group: "Oscillators" },
  { key: "stochastic", label: "Stochastic (14,3,3)", color: "#eab308", group: "Oscillators" },
  { key: "williamsR", label: "Williams %R (14)", color: "#ef4444", group: "Oscillators" },
  { key: "cci", label: "CCI (20)", color: "#0ea5e9", group: "Oscillators" },
  { key: "adx", label: "ADX (14)", color: "#f97316", group: "Oscillators" },
  { key: "mfi", label: "MFI (14)", color: "#ec4899", group: "Oscillators" },
  { key: "roc", label: "ROC (12)", color: "#8b5cf6", group: "Oscillators" },
  { key: "momentum", label: "Momentum (10)", color: "#06b6d4", group: "Oscillators" },
  { key: "trix", label: "TRIX (15)", color: "#14b8a6", group: "Oscillators" },
  // Volume/Volatility
  { key: "atr", label: "ATR (14)", color: "#f43f5e", group: "Volatility" },
  { key: "obv", label: "OBV", color: "#84cc16", group: "Volume" },
  { key: "cmf", label: "CMF (20)", color: "#fb923c", group: "Volume" },
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

function computeDEMA(data: number[], period: number): (number | null)[] {
  const ema1 = computeEMA(data, period)
  const validEma = ema1.map(v => v ?? 0)
  const ema2 = computeEMA(validEma, period)
  return ema1.map((v, i) => v !== null && ema2[i] !== null ? 2 * v - ema2[i]! : null)
}

function computeTEMA(data: number[], period: number): (number | null)[] {
  const ema1 = computeEMA(data, period)
  const validEma1 = ema1.map(v => v ?? 0)
  const ema2 = computeEMA(validEma1, period)
  const validEma2 = ema2.map(v => v ?? 0)
  const ema3 = computeEMA(validEma2, period)
  return ema1.map((v, i) => v !== null && ema2[i] !== null && ema3[i] !== null ? 3 * v - 3 * ema2[i]! + ema3[i]! : null)
}

function computeWMA(data: number[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  const denom = (period * (period + 1)) / 2
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    let s = 0
    for (let j = 0; j < period; j++) s += data[i - j] * (period - j)
    r.push(s / denom)
  }
  return r
}

function computeHMA(data: number[], period: number): (number | null)[] {
  const half = Math.floor(period / 2)
  const wmaHalf = computeWMA(data, half)
  const wmaFull = computeWMA(data, period)
  const diff: number[] = []
  for (let i = 0; i < data.length; i++) {
    diff.push(wmaHalf[i] !== null && wmaFull[i] !== null ? 2 * wmaHalf[i]! - wmaFull[i]! : 0)
  }
  const sqrtP = Math.max(2, Math.floor(Math.sqrt(period)))
  return computeWMA(diff, sqrtP)
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

function computeIchimoku(klines: Kline[]) {
  const n = klines.length
  const tenkan: (number | null)[] = Array(n).fill(null)
  const kijun: (number | null)[] = Array(n).fill(null)
  const senkouA: (number | null)[] = Array(n).fill(null)
  const senkouB: (number | null)[] = Array(n).fill(null)
  const chikou: (number | null)[] = Array(n).fill(null)
  function hlAvg(end: number, period: number): number | null {
    if (end < period - 1) return null
    let hi = -Infinity, lo = Infinity
    for (let j = 0; j < period; j++) { hi = Math.max(hi, klines[end - j].high); lo = Math.min(lo, klines[end - j].low) }
    return (hi + lo) / 2
  }
  for (let i = 0; i < n; i++) {
    tenkan[i] = hlAvg(i, 9); kijun[i] = hlAvg(i, 26)
    if (tenkan[i] !== null && kijun[i] !== null) { const aIdx = i + 26; if (aIdx < n) senkouA[aIdx] = (tenkan[i]! + kijun[i]!) / 2 }
    const b = hlAvg(i, 52); if (b !== null) { const bIdx = i + 26; if (bIdx < n) senkouB[bIdx] = b }
    const cIdx = i - 26; if (cIdx >= 0) chikou[cIdx] = klines[i].close
  }
  return { tenkan, kijun, senkouA, senkouB, chikou }
}

function computeParabolicSAR(klines: Kline[]): (number | null)[] {
  if (klines.length < 2) return klines.map(() => null)
  const r: (number | null)[] = [null]
  let isLong = klines[1].close > klines[0].close, af = 0.02, ep = isLong ? klines[0].high : klines[0].low, sar = isLong ? klines[0].low : klines[0].high
  for (let i = 1; i < klines.length; i++) {
    sar = sar + af * (ep - sar)
    if (isLong) {
      if (klines[i].low < sar) { isLong = false; sar = ep; ep = klines[i].low; af = 0.02 }
      else if (klines[i].high > ep) { ep = klines[i].high; af = Math.min(af + 0.02, 0.2) }
    } else {
      if (klines[i].high > sar) { isLong = true; sar = ep; ep = klines[i].high; af = 0.02 }
      else if (klines[i].low < ep) { ep = klines[i].low; af = Math.min(af + 0.02, 0.2) }
    }
    r.push(sar)
  }
  return r
}

function computeDonchian(klines: Kline[], period: number) {
  const upper: (number | null)[] = [], lower: (number | null)[] = [], mid: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); mid.push(null); continue }
    let hi = -Infinity, lo = Infinity
    for (let j = 0; j < period; j++) { hi = Math.max(hi, klines[i - j].high); lo = Math.min(lo, klines[i - j].low) }
    upper.push(hi); lower.push(lo); mid.push((hi + lo) / 2)
  }
  return { upper, lower, middle: mid }
}

function computeKeltner(klines: Kline[], emaPeriod: number, atrPeriod: number, mult: number) {
  const ema = computeEMA(klines.map(k => k.close), emaPeriod)
  const atr = computeATR(klines, atrPeriod)
  const upper: (number | null)[] = [], lower: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (ema[i] === null || atr[i] === null) { upper.push(null); lower.push(null); continue }
    upper.push(ema[i]! + mult * atr[i]!); lower.push(ema[i]! - mult * atr[i]!)
  }
  return { upper, middle: ema, lower }
}

function computeSupertrend(klines: Kline[], period: number, mult: number) {
  const atr = computeATR(klines, period)
  const st: (number | null)[] = [], direction: number[] = []
  let prevUp = 0, prevDn = 0, prevDir = 1
  for (let i = 0; i < klines.length; i++) {
    if (atr[i] === null) { st.push(null); direction.push(1); continue }
    const hl2 = (klines[i].high + klines[i].low) / 2
    let ub = hl2 + mult * atr[i]!, lb = hl2 - mult * atr[i]!
    if (i > 0) { lb = lb > prevDn ? lb : prevDn; ub = ub < prevUp ? ub : prevUp }
    prevUp = ub; prevDn = lb
    let dir = prevDir
    if (i > 0) { if (prevDir === -1 && klines[i].close > prevUp) dir = 1; else if (prevDir === 1 && klines[i].close < prevDn) dir = -1 }
    prevDir = dir; direction.push(dir); st.push(dir === 1 ? lb : ub)
  }
  return { values: st, direction }
}

function computeADX(klines: Kline[], period: number): { adx: (number | null)[]; pdi: (number | null)[]; ndi: (number | null)[] } {
  const pDM: number[] = [], nDM: number[] = [], tr: number[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i === 0) { pDM.push(0); nDM.push(0); tr.push(klines[i].high - klines[i].low); continue }
    const up = klines[i].high - klines[i - 1].high, dn = klines[i - 1].low - klines[i].low
    pDM.push(up > dn && up > 0 ? up : 0); nDM.push(dn > up && dn > 0 ? dn : 0)
    tr.push(Math.max(klines[i].high - klines[i].low, Math.abs(klines[i].high - klines[i - 1].close), Math.abs(klines[i].low - klines[i - 1].close)))
  }
  const sTR = computeEMA(tr, period), sPDM = computeEMA(pDM, period), sNDM = computeEMA(nDM, period)
  const pdi: (number | null)[] = [], ndi: (number | null)[] = [], dx: number[] = []
  for (let i = 0; i < klines.length; i++) {
    if (!sTR[i] || !sPDM[i] || !sNDM[i] || sTR[i] === 0) { pdi.push(null); ndi.push(null); continue }
    const p = (sPDM[i]! / sTR[i]!) * 100, n = (sNDM[i]! / sTR[i]!) * 100
    pdi.push(p); ndi.push(n); dx.push(p + n === 0 ? 0 : (Math.abs(p - n) / (p + n)) * 100)
  }
  const adxRaw = computeEMA(dx, period)
  const adx: (number | null)[] = []; let di2 = 0
  for (let i = 0; i < klines.length; i++) { if (pdi[i] === null) adx.push(null); else { adx.push(adxRaw[di2] ?? null); di2++ } }
  return { adx, pdi, ndi }
}

function computeMFI(klines: Kline[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i < period) { r.push(null); continue }
    let pos = 0, neg = 0
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (klines[j].high + klines[j].low + klines[j].close) / 3
      const prevTp = j > 0 ? (klines[j - 1].high + klines[j - 1].low + klines[j - 1].close) / 3 : tp
      const mf = tp * klines[j].volume
      if (tp > prevTp) pos += mf; else neg += mf
    }
    r.push(neg === 0 ? 100 : 100 - 100 / (1 + pos / neg))
  }
  return r
}

function computeROC(data: number[], period: number): (number | null)[] {
  return data.map((v, i) => i < period || data[i - period] === 0 ? null : ((v - data[i - period]) / data[i - period]) * 100)
}

function computeMomentum(data: number[], period: number): (number | null)[] {
  return data.map((v, i) => i < period ? null : v - data[i - period])
}

function computeCMF(klines: Kline[], period: number): (number | null)[] {
  const r: (number | null)[] = []
  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) { r.push(null); continue }
    let sumMFV = 0, sumVol = 0
    for (let j = 0; j < period; j++) {
      const k = klines[i - j]; const range = k.high - k.low
      const clv = range === 0 ? 0 : ((k.close - k.low) - (k.high - k.close)) / range
      sumMFV += clv * k.volume; sumVol += k.volume
    }
    r.push(sumVol === 0 ? 0 : sumMFV / sumVol)
  }
  return r
}

function computeTRIX(data: number[], period: number): (number | null)[] {
  const ema1 = computeEMA(data, period)
  const ema2 = computeEMA(ema1.map(v => v ?? 0), period)
  const ema3 = computeEMA(ema2.map(v => v ?? 0), period)
  return ema3.map((v, i) => (v === null || i === 0 || ema3[i - 1] === null || ema3[i - 1] === 0) ? null : ((v - ema3[i - 1]!) / ema3[i - 1]!) * 10000)
}

// ── CSS variable reader ──
function getCSSColor(_varName: string, fallback: string): string {
  // Always use the hex fallback — oklch CSS vars aren't reliably parsed by canvas libs
  return fallback
}

// ── Popover tool group for drawing sidebar ──────────────────────────────

function PopoverToolGroup({
  group,
  activeTool,
  onSelect,
}: {
  group: ToolGroup
  activeTool: DrawTool
  onSelect: (tool: DrawTool) => void
}) {
  const hasActive = group.tools.some((t) => t.tool === activeTool)
  const [open, setOpen] = React.useState(false)
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ top: 0, left: 0 })

  // close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // compute position when opening
  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.right + 4 })
    }
    setOpen((v) => !v)
  }

  // show the active tool's icon if one from this group is active, else the first tool icon
  const displayTool = group.tools.find((t) => t.tool === activeTool) ?? group.tools[0]

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={`relative rounded-lg p-1.5 transition-all ${
          hasActive ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/30"
        }`}
        title={group.label}
      >
        {displayTool.icon}
        {/* Caret indicator */}
        <svg
          width="6" height="6" viewBox="0 0 24 24" fill="currentColor"
          className="absolute bottom-0.5 right-0.5 opacity-60"
        >
          <path d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && ReactDOM.createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] flex flex-col gap-0.5 rounded-lg border border-border/40 bg-card/95 backdrop-blur-md p-1 shadow-xl min-w-[140px]"
          style={{ top: pos.top, left: pos.left }}
        >
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60">{group.label}</span>
          {group.tools.map(({ tool, title, icon }) => (
            <button
              key={tool}
              title={title}
              onClick={() => { onSelect(tool); setOpen(false) }}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-all ${
                activeTool === tool
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              {icon}
              <span className="whitespace-nowrap">{title}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export interface OpenOrderForChart {
  coin: string
  side: "B" | "A"
  limitPx: string
  sz: string
  oid: number
  orderType?: string
  tif?: string | null
}

export function ChartArea({
  symbol,
  price,
  change24h,
  openOrders = [],
  bestBid = 0,
  bestAsk = 0,
  onSetTP,
  onSetSL,
}: {
  symbol: string
  price: number
  change24h: number
  openOrders?: OpenOrderForChart[]
  bestBid?: number
  bestAsk?: number
  onSetTP?: (price: number) => void
  onSetSL?: (price: number) => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<IChartApi | null>(null)
  const mainSeriesRef = React.useRef<ISeriesApi<any> | null>(null)
  const volumeSeriesRef = React.useRef<ISeriesApi<"Histogram"> | null>(null)
  const indicatorSeriesRef = React.useRef<Map<string, ISeriesApi<any>>>(new Map())
  const klinesRef = React.useRef<Kline[]>([])
  const chartTypeRef = React.useRef<ChartType>("candles")
  const isLoadingHistoryRef = React.useRef(false)
  const historyExhaustedRef = React.useRef(false)
  const priceLinesRef = React.useRef<Map<number, any>>(new Map())
  const bidAskLinesRef = React.useRef<{ bid: any; ask: any } | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)

  const [interval, setInterval] = React.useState("1H")
  const intervalRef = React.useRef("1H")
  const [loading, setLoading] = React.useState(true)
  const [intervalLoading, setIntervalLoading] = React.useState(false)
  const [hasData, setHasData] = React.useState(false)
  const [chartType, setChartType] = React.useState<ChartType>("candles")
  const [activeIndicators, setActiveIndicators] = React.useState<Set<IndicatorKey>>(new Set())
  const [showIndicatorMenu, setShowIndicatorMenu] = React.useState(false)
  const [showDrawTools, setShowDrawTools] = React.useState(false)
  const [crosshairMode, setCrosshairMode] = React.useState<"normal" | "magnet">("normal")
  const refreshIndicatorsRef = React.useRef<() => void>(() => {})
  // Debounce timer: limits indicator setData() calls to max once per 1.5s during live WS updates
  const indicatorDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  // RAF handle: coalesces scroll/range-change redraws to one animation frame
  const drawRafRef = React.useRef<number>(0)

  // Drawing tools state
  const [activeTool, setActiveTool] = React.useState<DrawTool>("select")
  const [drawings, setDrawings] = React.useState<Drawing[]>([])
  const [draftPoints, setDraftPoints] = React.useState<DrawPoint[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [drawColor, setDrawColor] = React.useState("#f97316")
  const [drawTick, setDrawTick] = React.useState(0)
  const drawingsLenRef = React.useRef(0)
  const [mouseXY, setMouseXY] = React.useState<{ x: number; y: number } | null>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)

  // Keep ref in sync
  chartTypeRef.current = chartType
  intervalRef.current = interval
  drawingsLenRef.current = drawings.length

  // Map chart-area intervals to Hyperliquid API format
  const hlIntervalMap: Record<string, string> = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1H": "1h", "2H": "2h", "4H": "4h", "12H": "12h",
    "1D": "1d", "1W": "1w", "3M": "1d", "6M": "1d", "1Y": "1w",
  }

  // Load older candles when user scrolls to the left edge
  const loadOlderHistory = React.useCallback(async () => {
    if (isLoadingHistoryRef.current || historyExhaustedRef.current) return
    const existing = klinesRef.current
    if (existing.length === 0) return

    isLoadingHistoryRef.current = true
    try {
      const oldestTime = existing[0].time // ms
      const hlInterval = hlIntervalMap[intervalRef.current] || "1h"
      const base = symbol.replace(/[\/\-_]/g, "").replace(/(USDC|USDT|USD|USDH)$/i, "").toUpperCase()
      const res = await fetch(
        `/api/hyperliquid/candles?coin=${encodeURIComponent(base)}&interval=${hlInterval}&limit=500&endTime=${oldestTime}`
      )
      const json = await res.json()
      if (!json.success || !json.data?.length) {
        historyExhaustedRef.current = true
        return
      }
      // Convert to Kline format (API returns time in seconds, our Klines use ms)
      const older: Kline[] = json.data
        .filter((c: { time: number }) => c.time * 1000 < oldestTime)
        .map((c: { time: number; open: number; high: number; low: number; close: number; volume: number }) => ({
          time: c.time * 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        }))
      if (older.length === 0) {
        historyExhaustedRef.current = true
        return
      }
      // Save viewport before prepend — logical indices will shift by older.length
      const savedRange = chartRef.current?.timeScale().getVisibleLogicalRange()
      klinesRef.current = [...older, ...existing]
      applyMainData(klinesRef.current)
      applyVolumeData(klinesRef.current)
      refreshIndicatorsRef.current()
      // Restore shifted range so viewport doesn't jump
      if (savedRange && chartRef.current) {
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: savedRange.from + older.length,
          to: savedRange.to + older.length,
        })
      }
    } catch {
      // ignore history load errors
    } finally {
      isLoadingHistoryRef.current = false
    }
  }, [symbol])

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



  // ── Chart instance (recreates on theme change) ──
  React.useEffect(() => {
    if (!containerRef.current) return

    // Use safe hex colors — oklch from CSS vars may not be supported by canvas libs
    const chartBg = isDark ? "#1c1917" : "#ffffff"
    const text = isDark ? "#71717a" : "#a1a1aa"
    const grid = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"
    const border = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
    const labelBg = isDark ? "#27272a" : "#e4e4e7"

    const chart = createChart(containerRef.current, {
      autoSize: true,
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

    // Volume (always present)
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
    volumeSeriesRef.current = vol

    const onRangeChange = (range: { from: number; to: number } | null) => {
      if (range && range.from < 10) loadOlderHistory()
      // Only re-render the SVG drawing overlay when drawings actually exist,
      // and coalesce to one repaint per animation frame to eliminate jitter.
      if (drawingsLenRef.current > 0) {
        cancelAnimationFrame(drawRafRef.current)
        drawRafRef.current = requestAnimationFrame(() => setDrawTick((t) => t + 1))
      }
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange)

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange)
      cancelAnimationFrame(drawRafRef.current)
      indicatorSeriesRef.current.clear()
      mainSeriesRef.current = null
      volumeSeriesRef.current = null
      chart.remove()
      chartRef.current = null
    }
  }, [isDark])

  // ── Main series (swaps on chart type change) ──
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

    function addOscillator(key: string, values: (number | null)[], color: string, scaleId: string) {
      const d: LineData<Time>[] = []
      for (let i = 0; i < values.length; i++) {
        if (values[i] !== null) d.push({ time: times[i], value: values[i]! })
      }
      const s = chart!.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceScaleId: scaleId,
      })
      s.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      s.setData(d)
      indicatorSeriesRef.current.set(key, s)
    }

    // Moving Averages
    if (activeIndicators.has("ma9")) addLine("ma9", computeSMA(closes, 9), "#f97316")
    if (activeIndicators.has("ma20")) addLine("ma20", computeSMA(closes, 20), "#f59e0b")
    if (activeIndicators.has("ma50")) addLine("ma50", computeSMA(closes, 50), "#3b82f6")
    if (activeIndicators.has("ma100")) addLine("ma100", computeSMA(closes, 100), "#06b6d4")
    if (activeIndicators.has("ma200")) addLine("ma200", computeSMA(closes, 200), "#8b5cf6")
    if (activeIndicators.has("ema9")) addLine("ema9", computeEMA(closes, 9), "#ec4899")
    if (activeIndicators.has("ema21")) addLine("ema21", computeEMA(closes, 21), "#06b6d4")
    if (activeIndicators.has("ema50")) addLine("ema50", computeEMA(closes, 50), "#14b8a6")
    if (activeIndicators.has("ema100")) addLine("ema100", computeEMA(closes, 100), "#84cc16")
    if (activeIndicators.has("ema200")) addLine("ema200", computeEMA(closes, 200), "#a855f7")
    // Advanced MAs
    if (activeIndicators.has("dema9")) addLine("dema9", computeDEMA(closes, 9), "#fb923c")
    if (activeIndicators.has("dema21")) addLine("dema21", computeDEMA(closes, 21), "#38bdf8")
    if (activeIndicators.has("tema9")) addLine("tema9", computeTEMA(closes, 9), "#f472b6")
    if (activeIndicators.has("tema21")) addLine("tema21", computeTEMA(closes, 21), "#4ade80")
    if (activeIndicators.has("wma20")) addLine("wma20", computeWMA(closes, 20), "#c084fc")
    if (activeIndicators.has("wma50")) addLine("wma50", computeWMA(closes, 50), "#22d3ee")
    if (activeIndicators.has("hma9")) addLine("hma9", computeHMA(closes, 9), "#fb7185")
    if (activeIndicators.has("hma21")) addLine("hma21", computeHMA(closes, 21), "#34d399")
    // Overlays
    if (activeIndicators.has("bb")) {
      const bb = computeBB(closes, 20, 2)
      addLine("bb-u", bb.upper, "#6366f1")
      addLine("bb-m", bb.middle, "#6366f1")
      addLine("bb-l", bb.lower, "#6366f1")
    }
    if (activeIndicators.has("vwap")) addLine("vwap", computeVWAP(klines), "#f97316", 2)
    if (activeIndicators.has("ichimoku")) {
      const ich = computeIchimoku(klines)
      addLine("ich-tenkan", ich.tenkan, "#ef4444")
      addLine("ich-kijun", ich.kijun, "#3b82f6")
      addLine("ich-senkouA", ich.senkouA, "#22c55e")
      addLine("ich-senkouB", ich.senkouB, "#ef4444")
      addLine("ich-chikou", ich.chikou, "#a855f7")
    }
    if (activeIndicators.has("sar")) addLine("sar", computeParabolicSAR(klines), "#fbbf24")
    if (activeIndicators.has("donchian")) {
      const dc = computeDonchian(klines, 20)
      addLine("dc-u", dc.upper, "#2dd4bf")
      addLine("dc-m", dc.middle, "#2dd4bf")
      addLine("dc-l", dc.lower, "#2dd4bf")
    }
    if (activeIndicators.has("keltner")) {
      const kc = computeKeltner(klines, 20, 10, 1.5)
      addLine("kc-u", kc.upper, "#a78bfa")
      addLine("kc-m", kc.middle, "#a78bfa")
      addLine("kc-l", kc.lower, "#a78bfa")
    }
    if (activeIndicators.has("supertrend")) {
      const stR = computeSupertrend(klines, 10, 3)
      addLine("st-bull", stR.values.map((v, i) => stR.direction[i] === 1 ? v : null), "#22c55e")
      addLine("st-bear", stR.values.map((v, i) => stR.direction[i] === -1 ? v : null), "#ef4444")
    }
    // Oscillators
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
    if (activeIndicators.has("adx")) {
      const dx = computeADX(klines, 14)
      addOscillator("adx", dx.adx, "#f97316", "adx")
      addOscillator("adx-pdi", dx.pdi, "#22c55e", "adx")
      addOscillator("adx-ndi", dx.ndi, "#ef4444", "adx")
    }
    if (activeIndicators.has("mfi")) addOscillator("mfi", computeMFI(klines, 14), "#ec4899", "mfi")
    if (activeIndicators.has("roc")) addOscillator("roc", computeROC(closes, 12), "#8b5cf6", "roc")
    if (activeIndicators.has("momentum")) addOscillator("momentum", computeMomentum(closes, 10), "#06b6d4", "mom")
    if (activeIndicators.has("trix")) addOscillator("trix", computeTRIX(closes, 15), "#14b8a6", "trix")
    if (activeIndicators.has("atr")) addOscillator("atr", computeATR(klines, 14), "#f43f5e", "atr")
    if (activeIndicators.has("obv")) addOscillator("obv", computeOBV(klines), "#84cc16", "obv")
    if (activeIndicators.has("cmf")) addOscillator("cmf", computeCMF(klines, 20), "#fb923c", "cmf")

    // Store a refresh fn for in-place data updates (no series add/remove)
    refreshIndicatorsRef.current = () => {
      const kl = klinesRef.current
      if (!kl.length) return
      const c = kl.map((k) => k.close)
      const t = kl.map((k) => (k.time / 1000) as Time)
      function updateSeries(key: string, values: (number | null)[]) {
        const s = indicatorSeriesRef.current.get(key)
        if (!s) return
        const d: LineData<Time>[] = []
        for (let i = 0; i < values.length; i++) { if (values[i] !== null) d.push({ time: t[i], value: values[i]! }) }
        s.setData(d)
      }
      if (activeIndicators.has("ma9")) updateSeries("ma9", computeSMA(c, 9))
      if (activeIndicators.has("ma20")) updateSeries("ma20", computeSMA(c, 20))
      if (activeIndicators.has("ma50")) updateSeries("ma50", computeSMA(c, 50))
      if (activeIndicators.has("ma100")) updateSeries("ma100", computeSMA(c, 100))
      if (activeIndicators.has("ma200")) updateSeries("ma200", computeSMA(c, 200))
      if (activeIndicators.has("ema9")) updateSeries("ema9", computeEMA(c, 9))
      if (activeIndicators.has("ema21")) updateSeries("ema21", computeEMA(c, 21))
      if (activeIndicators.has("ema50")) updateSeries("ema50", computeEMA(c, 50))
      if (activeIndicators.has("ema100")) updateSeries("ema100", computeEMA(c, 100))
      if (activeIndicators.has("ema200")) updateSeries("ema200", computeEMA(c, 200))
      if (activeIndicators.has("dema9")) updateSeries("dema9", computeDEMA(c, 9))
      if (activeIndicators.has("dema21")) updateSeries("dema21", computeDEMA(c, 21))
      if (activeIndicators.has("tema9")) updateSeries("tema9", computeTEMA(c, 9))
      if (activeIndicators.has("tema21")) updateSeries("tema21", computeTEMA(c, 21))
      if (activeIndicators.has("wma20")) updateSeries("wma20", computeWMA(c, 20))
      if (activeIndicators.has("wma50")) updateSeries("wma50", computeWMA(c, 50))
      if (activeIndicators.has("hma9")) updateSeries("hma9", computeHMA(c, 9))
      if (activeIndicators.has("hma21")) updateSeries("hma21", computeHMA(c, 21))
      if (activeIndicators.has("bb")) { const bb = computeBB(c, 20, 2); updateSeries("bb-u", bb.upper); updateSeries("bb-m", bb.middle); updateSeries("bb-l", bb.lower) }
      if (activeIndicators.has("vwap")) updateSeries("vwap", computeVWAP(kl))
      if (activeIndicators.has("ichimoku")) { const ich = computeIchimoku(kl); updateSeries("ich-tenkan", ich.tenkan); updateSeries("ich-kijun", ich.kijun); updateSeries("ich-senkouA", ich.senkouA); updateSeries("ich-senkouB", ich.senkouB); updateSeries("ich-chikou", ich.chikou) }
      if (activeIndicators.has("sar")) updateSeries("sar", computeParabolicSAR(kl))
      if (activeIndicators.has("donchian")) { const dc = computeDonchian(kl, 20); updateSeries("dc-u", dc.upper); updateSeries("dc-m", dc.middle); updateSeries("dc-l", dc.lower) }
      if (activeIndicators.has("keltner")) { const kc = computeKeltner(kl, 20, 10, 1.5); updateSeries("kc-u", kc.upper); updateSeries("kc-m", kc.middle); updateSeries("kc-l", kc.lower) }
      if (activeIndicators.has("supertrend")) { const stR = computeSupertrend(kl, 10, 3); updateSeries("st-bull", stR.values.map((v, i) => stR.direction[i] === 1 ? v : null)); updateSeries("st-bear", stR.values.map((v, i) => stR.direction[i] === -1 ? v : null)) }
      if (activeIndicators.has("rsi")) updateSeries("rsi", computeRSI(c, 14))
      if (activeIndicators.has("macd")) { const m = computeMACD(c); updateSeries("macd-line", m.macd); updateSeries("macd-signal", m.signal) }
      if (activeIndicators.has("stochastic")) { const st = computeStochastic(kl, 14, 3); updateSeries("stoch-k", st.k); updateSeries("stoch-d", st.d) }
      if (activeIndicators.has("williamsR")) updateSeries("williamsR", computeWilliamsR(kl, 14))
      if (activeIndicators.has("cci")) updateSeries("cci", computeCCI(kl, 20))
      if (activeIndicators.has("adx")) { const dx = computeADX(kl, 14); updateSeries("adx", dx.adx); updateSeries("adx-pdi", dx.pdi); updateSeries("adx-ndi", dx.ndi) }
      if (activeIndicators.has("mfi")) updateSeries("mfi", computeMFI(kl, 14))
      if (activeIndicators.has("roc")) updateSeries("roc", computeROC(c, 12))
      if (activeIndicators.has("momentum")) updateSeries("momentum", computeMomentum(c, 10))
      if (activeIndicators.has("trix")) updateSeries("trix", computeTRIX(c, 15))
      if (activeIndicators.has("atr")) updateSeries("atr", computeATR(kl, 14))
      if (activeIndicators.has("obv")) updateSeries("obv", computeOBV(kl))
      if (activeIndicators.has("cmf")) updateSeries("cmf", computeCMF(kl, 20))
    }
  }, [activeIndicators, isDark])

  // ── Data fetching ──
  React.useEffect(() => {
    let cancelled = false
    // Reset history state on symbol/interval change
    historyExhaustedRef.current = false
    isLoadingHistoryRef.current = false

    async function fetchKlines() {
      if (hasData) setIntervalLoading(true)
      else setLoading(true)
      try {
        const res = await getSpotKlines(symbol, interval)
        if (cancelled) return
        if (res.success && res.data.length > 0) {
          klinesRef.current = res.data
          applyMainData(res.data)
          applyVolumeData(res.data)
          refreshIndicatorsRef.current()
          // Show full chart data range
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent()
          }
          setHasData(true)
        }
      } catch {
        // keep previous data
      } finally {
        if (!cancelled) { setLoading(false); setIntervalLoading(false) }
      }
    }

    fetchKlines().then(() => {
      if (cancelled) return
      // Open Hyperliquid WebSocket for real-time candle updates
      const wsInterval = HL_WS_INTERVAL[interval]
      if (!wsInterval) return

      // Derive the coin name HL expects (strip suffixes)
      const hlCoin = symbol
        .replace(/[\-\/_ ]/g, "")
        .replace(/(USDC|USDT|USD|USDH)$/i, "")
        .toUpperCase()

      const ws = new WebSocket("wss://api.hyperliquid.xyz/ws")
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            method: "subscribe",
            subscription: { type: "candle", coin: hlCoin, interval: wsInterval },
          })
        )
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.channel !== "candle" || !msg.data) return

          const c = msg.data
          const time = Math.floor(c.t / 1000) as Time
          const open = Number(c.o)
          const high = Number(c.h)
          const low = Number(c.l)
          const close = Number(c.c)
          const volume = Number(c.v)
          const isUp = close >= open

          // Incremental update on chart series
          if (chartTypeRef.current === "candles") {
            mainSeriesRef.current?.update({ time, open, high, low, close })
          } else {
            mainSeriesRef.current?.update({ time, value: close })
          }
          volumeSeriesRef.current?.update({
            time,
            value: volume,
            color: isUp ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
          })

          // Keep klinesRef in sync for indicators & history
          const klines = klinesRef.current
          const klineEntry: Kline = { time: c.t, open, high, low, close, volume }
          if (klines.length > 0 && Math.floor(klines[klines.length - 1].time / 1000) === Math.floor(c.t / 1000)) {
            klines[klines.length - 1] = klineEntry
          } else {
            klines.push(klineEntry)
          }
          // Debounce indicator refresh — setData() on many series each tick causes jitter
          if (indicatorDebounceRef.current) clearTimeout(indicatorDebounceRef.current)
          indicatorDebounceRef.current = setTimeout(() => refreshIndicatorsRef.current(), 1500)
        } catch {
          // ignore malformed messages
        }
      }

      ws.onerror = () => {
        console.warn("[ChartArea] WS error, falling back to polling")
      }

      // If WS closes unexpectedly, fall back to 30s poll until next reconnect
      ws.onclose = () => {
        if (cancelled) return
        const fallbackId = window.setInterval(async () => {
          try {
            const res = await getSpotKlines(symbol, interval)
            if (cancelled) return
            if (res.success && res.data.length > 0) {
              klinesRef.current = res.data
              applyMainData(res.data)
              applyVolumeData(res.data)
              refreshIndicatorsRef.current()
            }
          } catch { /* ignore */ }
        }, 30_000)
        // Store fallback ID on the ref so cleanup can clear it
        ;(wsRef as any).__fallbackId = fallbackId
      }
    })

    return () => {
      cancelled = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      const fallbackId = (wsRef as any).__fallbackId
      if (fallbackId) clearInterval(fallbackId)
    }
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
  }

  // ── Drawing coordinate helpers ──
  function chartToScreen(price: number, time: number): { x: number; y: number } | null {
    const chart = chartRef.current
    const series = mainSeriesRef.current
    if (!chart || !series) return null
    const x = chart.timeScale().timeToCoordinate(Math.floor(time) as Time)
    const y = series.priceToCoordinate(price)
    if (x === null || y === null) return null
    return { x, y }
  }

  function screenToChart(x: number, y: number): DrawPoint | null {
    const chart = chartRef.current
    const series = mainSeriesRef.current
    if (!chart || !series) return null
    const t = chart.timeScale().coordinateToTime(x)
    const price = series.coordinateToPrice(y)
    if (t === null || price === null) return null
    return { price, time: Number(t) }
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setActiveTool("select"); setDraftPoints([]) }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA") return
        setDrawings((prev) => prev.filter((d) => d.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId])

  // ── Open orders price lines ──────────────────────────────────────────
  React.useEffect(() => {
    const series = mainSeriesRef.current
    if (!series) return

    // Remove old lines
    for (const [, line] of priceLinesRef.current) {
      try { series.removePriceLine(line) } catch { /* already removed */ }
    }
    priceLinesRef.current.clear()

    // Filter for current symbol
    const sym = symbol.replace("-", "").replace("/", "").toUpperCase()
    const relevant = openOrders.filter(
      (o) => o.coin.toUpperCase().replace("-", "").replace("/", "") === sym
    )

    for (const order of relevant) {
      const px = parseFloat(order.limitPx)
      if (!px || isNaN(px)) continue

      const isBuy = order.side === "B"
      const isStopOrder = order.orderType === "Stop Limit" || order.orderType === "Stop Market"

      // Determine order color and label based on type
      let color: string
      let label: string
      let lineStyle = 2 // dashed

      if (isStopOrder) {
        // TP/SL detection: stop order on opposite side = take profit or stop loss
        // If it's a sell stop above entry (or buy stop below entry), likely a TP/SL
        const isAbovePrice = px > price
        if ((isBuy && !isAbovePrice) || (!isBuy && isAbovePrice)) {
          // Take Profit — green dashed
          color = "#10b981"
          label = `🎯 TP ${order.sz} @ ${px}`
          lineStyle = 2
        } else {
          // Stop Loss — red dashed
          color = "#ef4444"
          label = `🛑 SL ${order.sz} @ ${px}`
          lineStyle = 2
        }
      } else {
        // Regular limit order
        color = isBuy ? "#10b981" : "#ef4444"
        label = `${isBuy ? "▲ Buy" : "▼ Sell"} Limit ${order.sz} @ ${px}`
        lineStyle = 0 // solid for limit orders
      }

      const line = series.createPriceLine({
        price: px,
        color,
        lineWidth: isStopOrder ? 1 : 2,
        lineStyle,
        axisLabelVisible: true,
        title: label,
      })
      priceLinesRef.current.set(order.oid, line)
    }
  }, [openOrders, symbol, price])

  // ── Live bid/ask lines ───────────────────────────────────────────────
  React.useEffect(() => {
    const series = mainSeriesRef.current
    if (!series) return

    // Remove old bid/ask lines
    if (bidAskLinesRef.current) {
      try { series.removePriceLine(bidAskLinesRef.current.bid) } catch {}
      try { series.removePriceLine(bidAskLinesRef.current.ask) } catch {}
      bidAskLinesRef.current = null
    }

    if (bestBid > 0 && bestAsk > 0) {
      const bidLine = series.createPriceLine({
        price: bestBid,
        color: "rgba(16,185,129,0.7)",
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: true,
        title: `Bid $${bestBid.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
      })
      const askLine = series.createPriceLine({
        price: bestAsk,
        color: "rgba(239,68,68,0.7)",
        lineWidth: 1,
        lineStyle: 3, // dotted
        axisLabelVisible: true,
        title: `Ask $${bestAsk.toLocaleString(undefined, { maximumFractionDigits: 4 })}`,
      })
      bidAskLinesRef.current = { bid: bidLine, ask: askLine }
    }
  }, [bestBid, bestAsk])

  // ── Right-click on chart canvas → set TP/SL ──────────────────────────
  // Attached to the container (not the SVG) so it never blocks chart pan/zoom.
  // The SVG has pointerEvents:none in select mode so events reach the canvas.
  React.useEffect(() => {
    const el = containerRef.current
    if (!el || (!onSetTP && !onSetSL)) return

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const pt = screenToChart(x, y)
      if (!pt) return
      if (pt.price > price && onSetTP) onSetTP(pt.price)
      else if (pt.price < price && onSetSL) onSetSL(pt.price)
    }

    el.addEventListener("contextmenu", handleContextMenu)
    return () => el.removeEventListener("contextmenu", handleContextMenu)
  }, [onSetTP, onSetSL, price])

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (activeTool === "select") { setSelectedId(null); return }
    const rect = svgRef.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pt = screenToChart(x, y)
    if (!pt) return
    const required = POINT_COUNT[activeTool as DrawingType]
    const newPoints = [...draftPoints, pt]
    if (newPoints.length >= required) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setDrawings((prev) => [...prev, { id, type: activeTool as DrawingType, points: newPoints, color: drawColor }])
      setDraftPoints([])
    } else {
      setDraftPoints(newPoints)
    }
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect()
    setMouseXY({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  function handleSvgLeave() { setMouseXY(null) }

  function deleteDrawing(id: string) {
    setDrawings((prev) => prev.filter((d) => d.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function renderDrawing(d: Drawing): React.ReactNode {
    const SVG_EXT = 9999
    const pts = d.points.map((p) => chartToScreen(p.price, p.time)).filter(Boolean) as { x: number; y: number }[]
    const col = d.color
    const sel = d.id === selectedId
    const stroke = sel ? 2.5 : 1.5
    const selProps = sel ? { filter: "drop-shadow(0 0 3px " + col + "99)" } : {}
    switch (d.type) {
      case "line": {
        if (pts.length < 2) return null
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={col} strokeWidth={stroke} /><circle cx={pts[0].x} cy={pts[0].y} r={3} fill={col} opacity={0.7} /><circle cx={pts[1].x} cy={pts[1].y} r={3} fill={col} opacity={0.7} /></g>)
      }
      case "ray": {
        if (pts.length < 2) return null
        const dx = pts[1].x - pts[0].x; const dy = pts[1].y - pts[0].y
        const len = Math.sqrt(dx * dx + dy * dy) || 1; const scale = SVG_EXT * 2 / len
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={pts[0].x} y1={pts[0].y} x2={pts[0].x + dx * scale} y2={pts[0].y + dy * scale} stroke={col} strokeWidth={stroke} /><circle cx={pts[0].x} cy={pts[0].y} r={3} fill={col} opacity={0.7} /></g>)
      }
      case "arrow": {
        if (pts.length < 2) return null
        const dx = pts[1].x - pts[0].x; const dy = pts[1].y - pts[0].y; const angle = Math.atan2(dy, dx); const al = 10
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={col} strokeWidth={stroke} /><polyline points={`${pts[1].x - al * Math.cos(angle - 0.4)},${pts[1].y - al * Math.sin(angle - 0.4)} ${pts[1].x},${pts[1].y} ${pts[1].x - al * Math.cos(angle + 0.4)},${pts[1].y - al * Math.sin(angle + 0.4)}`} stroke={col} strokeWidth={stroke} fill="none" /></g>)
      }
      case "hline": {
        if (pts.length < 1) return null
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={0} y1={pts[0].y} x2={SVG_EXT} y2={pts[0].y} stroke={col} strokeWidth={stroke} strokeDasharray="4 3" /><text x={pts[0].x > 100 ? pts[0].x - 6 : pts[0].x + 6} y={pts[0].y - 4} fill={col} fontSize={9} textAnchor="end">{d.points[0].price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>)
      }
      case "vline": {
        if (pts.length < 1) return null
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={pts[0].x} y1={0} x2={pts[0].x} y2={SVG_EXT} stroke={col} strokeWidth={stroke} strokeDasharray="4 3" /></g>)
      }
      case "channel": {
        if (pts.length < 3) return null
        const dx = pts[1].x - pts[0].x; const dy = pts[1].y - pts[0].y; const len = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = -dy / len; const ny = dx / len; const proj = (pts[2].x - pts[0].x) * nx + (pts[2].y - pts[0].y) * ny
        const ox = nx * proj; const oy = ny * proj
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={col} strokeWidth={stroke} /><line x1={pts[0].x + ox} y1={pts[0].y + oy} x2={pts[1].x + ox} y2={pts[1].y + oy} stroke={col} strokeWidth={stroke} /><line x1={pts[0].x} y1={pts[0].y} x2={pts[0].x + ox} y2={pts[0].y + oy} stroke={col} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} /><line x1={pts[1].x} y1={pts[1].y} x2={pts[1].x + ox} y2={pts[1].y + oy} stroke={col} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} /></g>)
      }
      case "rect": {
        if (pts.length < 2) return null
        const x = Math.min(pts[0].x, pts[1].x); const y = Math.min(pts[0].y, pts[1].y); const w = Math.abs(pts[1].x - pts[0].x); const h = Math.abs(pts[1].y - pts[0].y)
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><rect x={x} y={y} width={w} height={h} fill={col + "18"} stroke={col} strokeWidth={stroke} /></g>)
      }
      case "fib": {
        if (pts.length < 2) return null
        const p0 = d.points[0]; const p1 = d.points[1]; const priceRange = p1.price - p0.price
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer">{FIB_LEVELS.map((lvl) => { const price = p0.price + priceRange * lvl; const s = chartToScreen(price, p0.time); if (!s) return null; const fc = FIB_COLORS[lvl] || "#94a3b8"; return (<g key={lvl}><line x1={0} y1={s.y} x2={SVG_EXT} y2={s.y} stroke={fc} strokeWidth={1.2} strokeDasharray="5 3" /><text x={6} y={s.y - 3} fill={fc} fontSize={8.5}>{(lvl * 100).toFixed(1)}% {price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>) })}</g>)
      }
      case "pitchfork": {
        if (pts.length < 3) return null
        const midX = (pts[1].x + pts[2].x) / 2; const midY = (pts[1].y + pts[2].y) / 2
        const dx = midX - pts[0].x; const dy = midY - pts[0].y; const ext = SVG_EXT * 2; const len = Math.sqrt(dx * dx + dy * dy) || 1
        const mx2 = midX + (dx / len) * ext; const my2 = midY + (dy / len) * ext
        const t1x2 = pts[1].x + (dx / len) * ext; const t1y2 = pts[1].y + (dy / len) * ext
        const t2x2 = pts[2].x + (dx / len) * ext; const t2y2 = pts[2].y + (dy / len) * ext
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><line x1={pts[0].x} y1={pts[0].y} x2={mx2} y2={my2} stroke={col} strokeWidth={stroke} /><line x1={pts[1].x} y1={pts[1].y} x2={t1x2} y2={t1y2} stroke={col} strokeWidth={stroke} opacity={0.85} /><line x1={pts[2].x} y1={pts[2].y} x2={t2x2} y2={t2y2} stroke={col} strokeWidth={stroke} opacity={0.85} /><line x1={pts[1].x} y1={pts[1].y} x2={pts[2].x} y2={pts[2].y} stroke={col} strokeWidth={1} strokeDasharray="4 3" opacity={0.5} /><circle cx={pts[0].x} cy={pts[0].y} r={3} fill={col} opacity={0.7} /></g>)
      }
      case "measure": {
        if (pts.length < 2) return null
        const p0 = d.points[0]; const p1 = d.points[1]; const priceDiff = p1.price - p0.price; const pricePct = ((priceDiff / p0.price) * 100).toFixed(2)
        const bars = Math.abs(Math.round((p1.time - p0.time) / 60)); const positive = priceDiff >= 0
        const x = Math.min(pts[0].x, pts[1].x); const y = Math.min(pts[0].y, pts[1].y); const w = Math.abs(pts[1].x - pts[0].x); const h = Math.abs(pts[1].y - pts[0].y)
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><rect x={x} y={y} width={w} height={h} fill={positive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)"} stroke={positive ? "#10b981" : "#ef4444"} strokeWidth={1} strokeDasharray="4 3" /><text x={x + w / 2} y={y + h / 2} fill={positive ? "#10b981" : "#ef4444"} fontSize={10} textAnchor="middle" dominantBaseline="middle" fontWeight="600">{positive ? "+" : ""}{pricePct}%</text><text x={x + w / 2} y={y + h / 2 + 14} fill="#94a3b8" fontSize={8.5} textAnchor="middle">{bars} bars</text></g>)
      }
      case "longpos": {
        if (pts.length < 3) return null
        const entry = d.points[0]; const target = d.points[1]; const stop = d.points[2]
        const es = chartToScreen(entry.price, entry.time); const ts = chartToScreen(target.price, entry.time); const ss = chartToScreen(stop.price, entry.time)
        if (!es || !ts || !ss) return null; const w = 120; const x = es.x
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><rect x={x} y={Math.min(es.y, ts.y)} width={w} height={Math.abs(ts.y - es.y)} fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth={1} /><rect x={x} y={Math.min(es.y, ss.y)} width={w} height={Math.abs(ss.y - es.y)} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth={1} /><line x1={0} y1={es.y} x2={x + w + 10} y2={es.y} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 3" /><line x1={0} y1={ts.y} x2={x + w + 10} y2={ts.y} stroke="#10b981" strokeWidth={1.2} strokeDasharray="3 3" /><line x1={0} y1={ss.y} x2={x + w + 10} y2={ss.y} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="3 3" /><text x={x + 4} y={es.y - 3} fill="#f97316" fontSize={8.5}>Entry {entry.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text><text x={x + 4} y={ts.y - 3} fill="#10b981" fontSize={8.5}>Target {target.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text><text x={x + 4} y={ss.y - 3} fill="#ef4444" fontSize={8.5}>Stop {stop.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>)
      }
      case "shortpos": {
        if (pts.length < 3) return null
        const entry = d.points[0]; const target = d.points[1]; const stop = d.points[2]
        const es = chartToScreen(entry.price, entry.time); const ts = chartToScreen(target.price, entry.time); const ss = chartToScreen(stop.price, entry.time)
        if (!es || !ts || !ss) return null; const w = 120; const x = es.x
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><rect x={x} y={Math.min(es.y, ts.y)} width={w} height={Math.abs(ts.y - es.y)} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth={1} /><rect x={x} y={Math.min(es.y, ss.y)} width={w} height={Math.abs(ss.y - es.y)} fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth={1} /><line x1={0} y1={es.y} x2={x + w + 10} y2={es.y} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 3" /><line x1={0} y1={ts.y} x2={x + w + 10} y2={ts.y} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="3 3" /><line x1={0} y1={ss.y} x2={x + w + 10} y2={ss.y} stroke="#10b981" strokeWidth={1.2} strokeDasharray="3 3" /><text x={x + 4} y={es.y - 3} fill="#f97316" fontSize={8.5}>Entry {entry.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text><text x={x + 4} y={ts.y - 3} fill="#ef4444" fontSize={8.5}>Target {target.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text><text x={x + 4} y={ss.y - 3} fill="#10b981" fontSize={8.5}>Stop {stop.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>)
      }
      case "text": {
        if (pts.length < 1) return null
        return (<g style={selProps} onClick={() => setSelectedId(d.id)} className="cursor-pointer"><text x={pts[0].x} y={pts[0].y} fill={col} fontSize={12} fontWeight="600">{d.text || "Label"}</text></g>)
      }
      default: return null
    }
  }

  function renderDraft(): React.ReactNode {
    const SVG_EXT = 9999
    if (activeTool === "select" || draftPoints.length === 0) return null
    const pts = draftPoints.map((p) => chartToScreen(p.price, p.time)).filter(Boolean) as { x: number; y: number }[]
    const cur = mouseXY; if (!cur) return null; const col = drawColor
    if ((activeTool === "line" || activeTool === "ray" || activeTool === "arrow" || activeTool === "channel" || activeTool === "measure") && pts.length >= 1) {
      return <line x1={pts[pts.length - 1].x} y1={pts[pts.length - 1].y} x2={cur.x} y2={cur.y} stroke={col} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />
    }
    if ((activeTool === "fib" || activeTool === "rect") && pts.length >= 1) {
      const dx = cur.x - pts[0].x; const dy = cur.y - pts[0].y
      return <rect x={Math.min(pts[0].x, cur.x)} y={Math.min(pts[0].y, cur.y)} width={Math.abs(dx)} height={Math.abs(dy)} fill={col + "18"} stroke={col} strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
    }
    if ((activeTool === "longpos" || activeTool === "shortpos") && pts.length === 1) {
      return <line x1={0} y1={pts[0].y} x2={SVG_EXT} y2={pts[0].y} stroke={col} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
    }
    if ((activeTool === "longpos" || activeTool === "shortpos") && pts.length >= 2) {
      return <line x1={0} y1={cur.y} x2={SVG_EXT} y2={cur.y} stroke={activeTool === "longpos" ? "#ef4444" : "#10b981"} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
    }
    return null
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

  // Group indicators by group
  const indicatorGroups = React.useMemo(() => {
    const groups: Record<string, IndicatorDef[]> = {}
    for (const ind of INDICATORS) {
      if (!groups[ind.group]) groups[ind.group] = []
      groups[ind.group].push(ind)
    }
    return groups
  }, [])

  return (
    <div data-onboarding="spot-chart" className="flex h-full flex-col bg-card overflow-hidden">
      {/* ── TOP BAR: Indicators + Chart type + Tools + Price ── */}
      <div className="flex items-center gap-0.5 border-b border-border/20 px-2 py-1 shrink-0 overflow-x-auto">
        {/* Indicators toggle */}
        <button
          onClick={() => setShowIndicatorMenu((v) => !v)}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            activeIndicators.size > 0 || showIndicatorMenu
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Indicators{activeIndicators.size > 0 && ` (${activeIndicators.size})`}
        </button>

        {/* Draw tools toggle */}
        <button
          onClick={() => setShowDrawTools((v) => !v)}
          className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
            showDrawTools
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Draw
        </button>

        <div className="mx-1 h-4 w-px bg-border/30 shrink-0" />

        {/* Chart type */}
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

        {/* Tools */}
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

        {/* Delete drawing(s) — visible when drawings exist */}
        {drawings.length > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-border/30 shrink-0" />
            {selectedId && (
              <button
                onClick={() => deleteDrawing(selectedId)}
                title="Delete selected drawing"
                className="rounded-md px-1.5 py-1 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
              </button>
            )}
            <button
              onClick={() => { setDrawings([]); setSelectedId(null) }}
              title="Clear all drawings"
              className="rounded-md px-1.5 py-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" strokeWidth="2"/></svg>
            </button>
          </>
        )}

        {/* Price */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 tabular-nums">
            <span className="text-xl font-bold text-foreground">
              ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
              {isPositive ? "+" : ""}{change24h.toFixed(2)}%
            </span>
          </div>
          {(loading || intervalLoading) && <HugeiconsIcon icon={Loading03Icon} className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
        </div>
      </div>

      {/* ── MIDDLE: Drawing sidebar (left) + Chart + Indicators panel (right) ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left drawing toolbar — vertical, collapsible groups */}
        {showDrawTools && <div className="flex flex-col gap-px border-r border-border/20 px-1 py-1.5 shrink-0 overflow-y-auto w-10 slim-scroll">
          {/* Select tool */}
          <button
            title="Select / Move"
            onClick={() => { setActiveTool("select"); setDraftPoints([]) }}
            className={`rounded-lg p-1.5 transition-all ${
              activeTool === "select" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            }`}
          >
            <svg width={SZ} height={SZ} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l16 7-7 2-3 8z"/></svg>
          </button>

          <div className="my-1 h-px bg-border/30 mx-1" />

          {/* Tool groups with popover */}
          {TOOL_GROUPS.map((group) => (
            <PopoverToolGroup
              key={group.label}
              group={group}
              activeTool={activeTool}
              onSelect={(tool) => { setActiveTool(tool); setDraftPoints([]) }}
            />
          ))}

          <div className="my-1 h-px bg-border/30 mx-1" />

          {/* Color palette */}
          <div className="flex flex-col items-center gap-1 py-1">
            {DRAW_PALETTE.slice(0, 6).map((c) => (
              <button
                key={c}
                title={c}
                onClick={() => setDrawColor(c)}
                className={`rounded-full w-4 h-4 shrink-0 transition-all ${drawColor === c ? "scale-125 ring-2 ring-offset-1 ring-offset-card ring-white/30" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
                style={{ background: c }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="mt-auto flex flex-col items-center gap-0.5 pt-1">
            {selectedId && (
              <button
                title="Delete selected"
                onClick={() => deleteDrawing(selectedId)}
                className="rounded-lg p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>
              </button>
            )}
            {drawings.length > 0 && (
              <button
                title="Clear all drawings"
                onClick={() => { setDrawings([]); setSelectedId(null) }}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14"/></svg>
              </button>
            )}
            {draftPoints.length > 0 && (
              <span className="text-[9px] text-primary font-medium">
                {POINT_COUNT[activeTool as DrawingType] - draftPoints.length}
              </span>
            )}
          </div>
        </div>}

        {/* Indicators side panel */}
        {showIndicatorMenu && (
          <div className="shrink-0 w-44 flex flex-col border-r border-border/20 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/20 shrink-0">
              <span className="text-[10px] font-semibold text-foreground">Indicators</span>
              {activeIndicators.size > 0 && (
                <button
                  onClick={() => setActiveIndicators(new Set())}
                  className="text-[9px] text-red-400 hover:text-red-500 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto slim-scroll py-1">
              {Object.entries(indicatorGroups).map(([group, items]) => (
                <div key={group}>
                  <div className="px-2 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {group}
                  </div>
                  {items.map((ind) => (
                    <button
                      key={ind.key}
                      onClick={() => toggleIndicator(ind.key)}
                      className={`flex w-full items-center gap-1.5 px-2 py-1 text-[10px] transition-colors ${
                        activeIndicators.has(ind.key)
                          ? "bg-accent/60 text-foreground"
                          : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ind.color }} />
                      {ind.label}
                      {activeIndicators.has(ind.key) && (
                        <svg className="ml-auto h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chart container — hide TradingView watermark */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden [&_div[class*='apply-common-tooltip']]:hidden! [&_a[href*='tradingview']]:hidden! [&_table[class*='tv-attr-logo']]:hidden!">
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

            {/* SVG Drawing layer */}
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{ pointerEvents: activeTool === "select" ? "none" : "all", zIndex: 15, cursor: activeTool === "select" ? "default" : "crosshair" }}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={handleSvgLeave}
            >
              {drawings.map((d) => <React.Fragment key={d.id}>{renderDrawing(d)}</React.Fragment>)}
              {renderDraft()}
              {activeTool !== "select" && mouseXY && (
                <>
                  <line x1={mouseXY.x} y1={0} x2={mouseXY.x} y2={9999} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={0} y1={mouseXY.y} x2={9999} y2={mouseXY.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="3 3" />
                </>
              )}
            </svg>
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR: Interval / Duration selector ── */}
      <div className="flex items-center gap-0.5 border-t border-border/20 px-2 py-1 shrink-0 overflow-x-auto">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              interval === iv.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {iv.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <CandleCountdown interval={interval} />
          {(loading || intervalLoading) && <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

    </div>
  )
}
