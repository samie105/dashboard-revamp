"use client"

import * as React from "react"

const USDC_IMAGE = "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png"

const SYMBOL_COLORS: Record<string, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  AVAX: "#E84142",
  DOGE: "#C2A633",
  ADA: "#0033AD",
  DOT: "#E6007A",
  LINK: "#2A5ADA",
  UNI: "#FF007A",
  ATOM: "#2E3148",
  NEAR: "#00C1DE",
  APT: "#000000",
  SUI: "#4DA2FF",
  ARB: "#28A0F0",
  OP: "#FF0420",
  FIL: "#0090FF",
  XRP: "#23292F",
  PEPE: "#4F8B2F",
}

function hashColor(symbol: string): string {
  let hash = 0
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash)
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 55%, 50%)`
}

function LetterFallback({ symbol, size }: { symbol: string; size: number }) {
  const color = SYMBOL_COLORS[symbol] || hashColor(symbol)
  const fontSize = Math.round(size * 0.42)
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: color, fontSize }}
    >
      {symbol.charAt(0)}
    </div>
  )
}

export function CoinAvatar({
  image,
  symbol,
  size = 20,
  className,
}: {
  image?: string
  symbol: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)

  if (!image || failed) {
    return <LetterFallback symbol={symbol} size={size} />
  }

  return (
    <img
      src={image}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className ?? ""}`}
      onError={() => setFailed(true)}
    />
  )
}

export function PairAvatar({
  baseImage,
  baseSymbol,
  quoteImage,
  baseSize = 20,
  quoteSize = 14,
}: {
  baseImage?: string
  baseSymbol: string
  quoteImage?: string
  baseSize?: number
  quoteSize?: number
}) {
  return (
    <div className="relative shrink-0" style={{ width: baseSize + quoteSize * 0.4, height: baseSize }}>
      <div className="absolute left-0 top-0 z-[1]">
        <CoinAvatar image={baseImage} symbol={baseSymbol} size={baseSize} />
      </div>
      <div className="absolute z-0 ring-2 ring-card rounded-full" style={{ left: baseSize - quoteSize * 0.45, top: baseSize - quoteSize }}>
        <CoinAvatar image={quoteImage || USDC_IMAGE} symbol="USDC" size={quoteSize} />
      </div>
    </div>
  )
}
