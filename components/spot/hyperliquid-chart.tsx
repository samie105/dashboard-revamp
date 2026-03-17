"use client"

import React, { useEffect, useRef, useState, useCallback, memo } from "react"
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  UTCTimestamp,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
} from "lightweight-charts"

interface OpenOrderForChart {
  coin: string
  side: "B" | "A"
  limitPx: string
  sz: string
  oid: number
  orderType?: string
  tif?: string | null
}

interface HyperliquidChartProps {
  symbol: string
  openOrders?: OpenOrderForChart[]
}

interface OhlcInfo {
  open: number
  high: number
  low: number
  close: number
  volume: number
  change: number
  changePct: number
  time: number
}

const INTERVALS = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
] as const

function extractBase(symbol: string): string {
  return symbol
    .replace(/[\/\-_]/g, "")
    .replace(/(USDC|USDT|USD|USDH)$/i, "")
    .toUpperCase()
}

/** Compute a simple moving average over `period` values. */
function computeSMA(
  data: { time: UTCTimestamp; value: number }[],
  period: number
): { time: UTCTimestamp; value: number }[] {
  const result: { time: UTCTimestamp; value: number }[] = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].value
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

function formatPrice(price: number): string {
  if (price >= 10000)
    return price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  if (price >= 100)
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 1)
    return price.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

const VOLUME_SMA_PERIOD = 20

// eslint-disable-next-line react/display-name
const HyperliquidChart = ({ symbol, openOrders = [] }: HyperliquidChartProps) => {
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const volSmaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCandlesRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLinesRef = useRef<Map<number, any>>(new Map())

  const [interval, setInterval] = useState("30m")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ohlc, setOhlc] = useState<OhlcInfo | null>(null)
  const [volSmaValue, setVolSmaValue] = useState<number | null>(null)

  const baseCoin = extractBase(symbol)

  // Initialize chart
  useEffect(() => {
    if (!chartAreaRef.current) return

    const chart = createChart(chartAreaRef.current, {
      width: chartAreaRef.current.clientWidth,
      height: chartAreaRef.current.clientHeight,
      layout: {
        background: { color: "#0b0e11" },
        textColor: "#848e9c",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.15)" },
        horzLines: { color: "rgba(42, 46, 57, 0.15)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(224, 227, 235, 0.1)",
          style: 0,
          labelBackgroundColor: "#2a2e39",
        },
        horzLine: {
          color: "rgba(224, 227, 235, 0.1)",
          style: 0,
          labelBackgroundColor: "#2a2e39",
        },
      },
      rightPriceScale: {
        borderColor: "#2a2e39",
        scaleMargins: { top: 0.05, bottom: 0.28 },
      },
      timeScale: {
        borderColor: "#2a2e39",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#0ecb81",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#0ecb81",
      wickDownColor: "#f6465d",
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: "#f6465d",
      priceLineWidth: 1,
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    const volSmaSeries = chart.addSeries(LineSeries, {
      color: "#f0b90b",
      lineWidth: 1,
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    volSmaSeriesRef.current = volSmaSeries

    // Crosshair move → update OHLC header
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time) {
        const candles = rawCandlesRef.current
        if (candles.length > 0) {
          const last = candles[candles.length - 1]
          const prev = candles.length > 1 ? candles[candles.length - 2] : last
          setOhlc({
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            volume: last.volume,
            change: last.close - prev.close,
            changePct: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0,
            time: last.time,
          })
        }
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candleData = param.seriesData.get(candleSeries) as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const volData = param.seriesData.get(volumeSeries) as any
      if (candleData) {
        const candles = rawCandlesRef.current
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const idx = candles.findIndex((c: any) => c.time === (param.time as number))
        const prev = idx > 0 ? candles[idx - 1] : candleData
        setOhlc({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volData?.value || 0,
          change: candleData.close - prev.close,
          changePct: prev.close ? ((candleData.close - prev.close) / prev.close) * 100 : 0,
          time: param.time as number,
        })
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const smaData = param.seriesData.get(volSmaSeries) as any
      if (smaData && smaData.value !== undefined) {
        setVolSmaValue(smaData.value)
      }
    })

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) chart.applyOptions({ width, height })
    })
    ro.observe(chartAreaRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      volSmaSeriesRef.current = null
    }
  }, [])

  // Fetch candles + stream
  const fetchAndStream = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !volSmaSeriesRef.current)
      return

    setLoading(true)
    setError(null)

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    try {
      const res = await fetch(
        `/api/hyperliquid/candles?coin=${encodeURIComponent(baseCoin)}&interval=${interval}&limit=1000`
      )
      const json = await res.json()

      if (!json.success || !json.data?.length) {
        setError("No candle data available")
        setLoading(false)
        return
      }

      rawCandlesRef.current = json.data

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candles: CandlestickData[] = json.data.map((c: any) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const volumes: HistogramData[] = json.data.map((c: any) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(14, 203, 129, 0.35)" : "rgba(246, 70, 93, 0.35)",
      }))

      // Volume SMA
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const volRaw = json.data.map((c: any) => ({
        time: c.time as UTCTimestamp,
        value: c.volume as number,
      }))
      const smaData = computeSMA(volRaw, VOLUME_SMA_PERIOD)

      candleSeriesRef.current.setData(candles)
      volumeSeriesRef.current.setData(volumes)
      volSmaSeriesRef.current.setData(smaData)
      chartRef.current?.timeScale().fitContent()

      const last = json.data[json.data.length - 1]
      const prev = json.data.length > 1 ? json.data[json.data.length - 2] : last
      setOhlc({
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
        volume: last.volume,
        change: last.close - prev.close,
        changePct: prev.close ? ((last.close - prev.close) / prev.close) * 100 : 0,
        time: last.time,
      })
      if (smaData.length > 0) setVolSmaValue(smaData[smaData.length - 1].value)

      setLoading(false)

      // Update last price line color
      const priceColor = last.close >= last.open ? "#0ecb81" : "#f6465d"
      candleSeriesRef.current.applyOptions({ priceLineColor: priceColor })

      // WebSocket for live updates from Hyperliquid
      // If candles came from Gate.io, resolve HL coin name for WS
      let hlCoinName = json.coinName || baseCoin
      if (json.source === "gateio") {
        try {
          const metaRes = await fetch(
            `/api/hyperliquid/orderbook?coin=${encodeURIComponent(baseCoin)}`
          )
          const metaJson = await metaRes.json()
          if (metaJson.success && metaJson.coin) {
            hlCoinName = metaJson.coin
          }
        } catch {
          // use baseCoin as fallback
        }
      }
      const ws = new WebSocket("wss://api.hyperliquid.xyz/ws")
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            method: "subscribe",
            subscription: { type: "candle", coin: hlCoinName, interval },
          })
        )
      }

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.channel === "candle" && msg.data) {
            const c = msg.data
            const time = Math.floor(c.t / 1000) as UTCTimestamp
            const open = Number(c.o)
            const high = Number(c.h)
            const low = Number(c.l)
            const close = Number(c.c)
            const volume = Number(c.v)
            const isUp = close >= open

            candleSeriesRef.current?.update({ time, open, high, low, close })
            volumeSeriesRef.current?.update({
              time,
              value: volume,
              color: isUp ? "rgba(14, 203, 129, 0.35)" : "rgba(246, 70, 93, 0.35)",
            })

            const existing = rawCandlesRef.current
            if (existing.length > 0 && existing[existing.length - 1].time === time) {
              existing[existing.length - 1] = { time, open, high, low, close, volume }
            } else {
              existing.push({ time, open, high, low, close, volume })
            }

            const prev2 = existing.length > 1 ? existing[existing.length - 2] : { close: open }
            setOhlc({
              open, high, low, close, volume,
              change: close - prev2.close,
              changePct: prev2.close ? ((close - prev2.close) / prev2.close) * 100 : 0,
              time,
            })

            candleSeriesRef.current?.applyOptions({
              priceLineColor: isUp ? "#0ecb81" : "#f6465d",
            })
          }
        } catch {
          // ignore
        }
      }

      ws.onerror = () => {
        console.warn("[HyperliquidChart] WS error")
      }
    } catch (err: unknown) {
      console.error("[HyperliquidChart]", err)
      setError("Failed to load chart data")
      setLoading(false)
    }
  }, [baseCoin, interval])

  useEffect(() => {
    fetchAndStream()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [fetchAndStream])

  // Render open orders as price lines on the chart
  useEffect(() => {
    if (!candleSeriesRef.current) return
    const series = candleSeriesRef.current

    // Remove old price lines
    priceLinesRef.current.forEach((line) => {
      try { series.removePriceLine(line) } catch { /* ignore */ }
    })
    priceLinesRef.current.clear()

    // Filter orders for current symbol
    const currentBase = extractBase(symbol)
    const relevantOrders = openOrders.filter(o => {
      const orderBase = o.coin.replace(/\/.*$/, "").replace(/@\d+/, "")
      return orderBase.toUpperCase() === currentBase
    })

    // Add price lines for each order
    relevantOrders.forEach((order) => {
      const px = parseFloat(order.limitPx)
      if (!px || isNaN(px)) return
      const isBuy = order.side === "B"
      const isTrigger = order.orderType === "trigger" || (order.tif && typeof order.tif === "object")

      let color: string
      let title: string
      let lineStyle: number

      if (isTrigger) {
        color = isBuy ? "#f6465d" : "#0ecb81"
        title = isBuy ? `SL $${px.toFixed(2)}` : `TP $${px.toFixed(2)}`
        lineStyle = 1 // dotted
      } else {
        color = isBuy ? "#0ecb81" : "#f6465d"
        title = `${isBuy ? "Buy" : "Sell"} Limit $${px.toFixed(2)}`
        lineStyle = 2 // dashed
      }

      const line = series.createPriceLine({
        price: px,
        color,
        lineWidth: 1,
        lineStyle,
        axisLabelVisible: true,
        title,
      })
      priceLinesRef.current.set(order.oid, line)
    })
  }, [openOrders, symbol])

  const isUp = ohlc ? ohlc.close >= ohlc.open : true
  const changeColor = isUp ? "text-[#0ecb81]" : "text-[#f6465d]"

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0e11] overflow-hidden">
      {/* Top toolbar: timeframes */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#2a2e39] shrink-0">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
              interval === iv.value
                ? "bg-[#2b3139] text-white font-semibold"
                : "text-[#848e9c] hover:text-white"
            }`}
          >
            {iv.label}
          </button>
        ))}
        <div className="w-px h-4 bg-[#2a2e39] mx-1.5" />
        <span className="text-[10px] text-[#848e9c]">Indicators</span>
      </div>

      {/* OHLC Header */}
      <div className="flex items-center gap-3 px-2 py-1 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white">{baseCoin}/USD</span>
          <span className="text-[10px] text-[#848e9c]">· {interval} · Hyperliquid</span>
          {ohlc && (
            <span
              className={`inline-block w-2 h-2 rounded-full ${isUp ? "bg-[#0ecb81]" : "bg-[#f6465d]"}`}
            />
          )}
        </div>

        {ohlc && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#848e9c]">
              O<span className={changeColor}>{formatPrice(ohlc.open)}</span>
            </span>
            <span className="text-[#848e9c]">
              H<span className="text-[#0ecb81]">{formatPrice(ohlc.high)}</span>
            </span>
            <span className="text-[#848e9c]">
              L<span className="text-[#f6465d]">{formatPrice(ohlc.low)}</span>
            </span>
            <span className="text-[#848e9c]">
              C<span className={changeColor}>{formatPrice(ohlc.close)}</span>
            </span>
            <span className={`font-medium ${changeColor}`}>
              {ohlc.change >= 0 ? "+" : ""}
              {formatPrice(ohlc.change)} ({ohlc.changePct >= 0 ? "+" : ""}
              {ohlc.changePct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Volume SMA label */}
      <div className="px-2 pb-0.5 shrink-0">
        <span className="text-[10px] text-[#848e9c]">
          Volume{" "}
          <span className="text-[#f0b90b]">SMA {VOLUME_SMA_PERIOD}</span>{" "}
          {volSmaValue !== null && (
            <span className="text-[#f0b90b]">{volSmaValue.toFixed(2)}</span>
          )}
        </span>
      </div>

      {/* Chart area */}
      <div className="relative flex-1 min-h-0">
        <div ref={chartAreaRef} className="absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e11]/80 z-10">
            <div className="flex items-center gap-2 text-[#848e9c] text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading chart...
            </div>
          </div>
        )}

        {error && !loading && rawCandlesRef.current.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e11]/80 z-10">
            <div className="text-center">
              <p className="text-[#f6465d] text-sm mb-2">{error}</p>
              <button
                onClick={fetchAndStream}
                className="text-xs text-[#848e9c] underline hover:text-white"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(HyperliquidChart)
