"use client"

import { getDexScreenerUrl } from "@/lib/spotv2/binance"

interface DexScreenerChartProps {
  chain: string
  contractAddress: string | null
  displaySymbol: string
}

export function DexScreenerChart({
  chain,
  contractAddress,
  displaySymbol,
}: DexScreenerChartProps) {
  const url = getDexScreenerUrl(chain, contractAddress)

  if (!url) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/10">
        <p className="text-sm text-muted-foreground/60">
          No chart available for {displaySymbol}
        </p>
      </div>
    )
  }

  return (
    <iframe
      key={url}
      src={url}
      className="h-full w-full border-0 bg-background"
      title={`${displaySymbol} Chart`}
      allow="clipboard-write"
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-popups"
    />
  )
}
