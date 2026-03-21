"use client"

import { useEffect, useRef, memo } from "react"

interface TradingViewChartProps {
  symbol: string
}

function TradingViewChartInner({ symbol }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clear previous widget
    container.innerHTML = ""

    // Create the widget container div that TradingView expects
    const widgetDiv = document.createElement("div")
    widgetDiv.className = "tradingview-widget-container__widget"
    widgetDiv.style.height = "100%"
    widgetDiv.style.width = "100%"
    container.appendChild(widgetDiv)

    // Inject the TradingView embed script
    const script = document.createElement("script")
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
    script.type = "text/javascript"
    script.async = true
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: `CRYPTO:${symbol.toUpperCase()}USD`,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_side_toolbar: true,
      hide_top_toolbar: false,
      withdateranges: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    })

    container.appendChild(script)

    return () => {
      // Cleanup on unmount or symbol change
      if (container) {
        container.innerHTML = ""
      }
    }
  }, [symbol])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Loading skeleton — hidden once TradingView renders */}
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          <span className="text-xs text-muted-foreground/50">Loading chart…</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="tradingview-widget-container relative z-10 h-full w-full"
      />
    </div>
  )
}

export const TradingViewChart = memo(TradingViewChartInner)
