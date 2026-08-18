"use client"

/**
 * CoinAvatar — the coin mark, resolved from lib/coin-images with a fallback
 * that never leaves a hole in the layout.
 *
 * Two things this handles that a bare <img> doesn't:
 *
 *  1. Hyperliquid names its assets differently from the price feed. Spot pairs
 *     arrive as "UBTC/USDC" (bridged BTC) and perps size-scale their memecoins
 *     as "kPEPE" (1000×). Both must land on the same mark as BTC and PEPE.
 *  2. Coin art rots — 13 of the 80 URLs in the map were dead 403s when this
 *     was written, mostly the Hyperliquid-native listings. A missing or broken
 *     image falls back to a house-styled monogram rather than a third-party
 *     avatar service, so the rail still reads as a list of coins offline.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { getCoinImage } from "@/lib/coin-images"

/**
 * Reduce an exchange symbol to the asset the art is filed under.
 * "UBTC/USDC" → BTC · "kPEPE" → PEPE · "UNI" → UNI (never "NI").
 */
export function baseAsset(symbol: string): string {
  const s = (symbol || "").split("/")[0].split("-")[0].trim().toUpperCase()
  if (!s) return ""
  if (getCoinImage(s)) return s
  // Perps scale some memecoins by 1000 — kPEPE, kBONK.
  if (/^K[A-Z0-9]{2,}$/.test(s) && getCoinImage(s.slice(1))) return s.slice(1)
  // Hyperliquid spot bridges are U-prefixed — UBTC, UETH, USOL. Only strip
  // when the remainder is a coin we know, so UNI and USDC stay themselves.
  if (s.length > 3 && s.startsWith("U") && getCoinImage(s.slice(1))) return s.slice(1)
  return s
}

const SIZES = {
  sm: "h-5 w-5 text-[8px]",
  md: "h-6 w-6 text-[9px]",
  lg: "h-8 w-8 text-[11px]",
} as const

export function CoinAvatar({
  symbol,
  size = "md",
  className,
  src: srcOverride,
}: {
  symbol: string
  size?: keyof typeof SIZES
  className?: string
  /** An art URL the caller already has — a chain mark, or a coin image that
   *  came down with the API row. Needed because the symbol alone can't always
   *  identify the art: Arbitrum's native asset symbol is ETH, so resolving by
   *  symbol would put the Ethereum mark on the Arbitrum row. Falls through to
   *  the symbol lookup, then the monogram, so a dead URL still renders. */
  src?: string | null
}) {
  const asset = baseAsset(symbol)
  const src = srcOverride || getCoinImage(asset)
  const [failed, setFailed] = React.useState(false)

  // A new symbol deserves a fresh attempt — otherwise one broken coin poisons
  // the slot for every coin that scrolls through it.
  React.useEffect(() => setFailed(false), [src])


  const shell = cn("shrink-0 overflow-hidden rounded-full", SIZES[size], className)

  // An override that 404s falls back to the mark the symbol resolves to, and
  // only then to the monogram — two chances before we give up on art.
  const fallbackSrc = srcOverride ? getCoinImage(asset) : ""
  const resolved = failed ? (fallbackSrc && fallbackSrc !== srcOverride ? fallbackSrc : "") : src

  if (!resolved) {
    return (
      <span
        aria-hidden
        className={cn(
          shell,
          "flex items-center justify-center bg-surface-sunken font-bold uppercase leading-none text-muted-foreground ring-1 ring-inset ring-foreground/[0.06]",
        )}
      >
        {/* Four characters, not three: truncating at three renders USDT and
            USDC as an identical "USD", and telling a stablecoin from a
            stablecoin is exactly what the mark is there for. The extra
            character is tracked tighter rather than given more room. */}
        <span className={asset.length > 3 ? "tracking-[-0.06em] [font-size:0.85em]" : undefined}>
          {asset.slice(0, 4)}
        </span>
      </span>
    )
  }

  return (
    // Plain <img>: these hosts are remote-patterned for next/image, but the
    // marks are 50px thumbnails already — the optimizer costs more than it saves.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(shell, "bg-surface-sunken object-cover")}
    />
  )
}
