/**
 * Pure helpers for the launchpad board and token page: the board's sorts,
 * tiny-price formatting, window labels. Tested in
 * lib/__tests__/launchpad-market.test.ts.
 */

import type { LaunchCardView } from "@/lib/launchpad-view"
import type { ChartRange, LaunchMarketStats, MarketWindow } from "@/lib/launchpad-market/types"

export const WINDOW_LABEL: Record<MarketWindow, string> = { "5m": "5m", "1h": "1h", "6h": "6h", "24h": "24h" }
export const RANGE_LABEL: Record<ChartRange, string> = { "1h": "1H", "6h": "6H", "24h": "24H", "7d": "7D", all: "All" }

export const BOARD_SORTS = ["trending", "gainers", "newest", "near", "mcap"] as const
export type BoardSort = (typeof BOARD_SORTS)[number]
export const BOARD_SORT_LABEL: Record<BoardSort, string> = {
  trending: "Trending",
  gainers: "Top gainers",
  newest: "Newest",
  near: "Near graduation",
  mcap: "Market cap",
}

export type BoardRow = { card: LaunchCardView; stats: LaunchMarketStats | null }

/**
 * Sort the board for the chosen window. Rows without stats (market data not
 * available) keep a stable place after those with them, so a sort never
 * invents an order from missing figures.
 */
export function sortBoard(rows: BoardRow[], sort: BoardSort, window: MarketWindow): BoardRow[] {
  const by = (score: (r: BoardRow) => number | null) =>
    [...rows].sort((a, b) => {
      const x = score(a)
      const y = score(b)
      if (x === null && y === null) return 0
      if (x === null) return 1
      if (y === null) return -1
      return y - x
    })
  switch (sort) {
    case "trending":
      return by((r) => (r.stats ? r.stats.volumeUsd[window] : null))
    case "gainers":
      return by((r) => (r.stats ? r.stats.changePct[window] : null))
    case "mcap":
      return by((r) => (r.stats ? r.stats.marketCapUsd : null))
    case "near":
      return by((r) => (r.card.status === "live" ? r.card.progressBps : null))
    case "newest":
    default:
      return by((r) => Date.parse(r.card.createdAt))
  }
}

export function searchBoard(rows: BoardRow[], query: string): BoardRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((r) => r.card.name.toLowerCase().includes(q) || r.card.symbol.toLowerCase().includes(q) || (r.card.mint ?? "").toLowerCase() === q)
}

const SUBSCRIPT = "₀₁₂₃₄₅₆₇₈₉"

/**
 * A launch-token price, which is usually tiny: 0.0000000284 → "0.0₇284"
 * (the count of zeros after the point in subscript, as DEX screeners show).
 * Prices ≥ 0.001 use plain decimals.
 */
export function tinyPrice(value: number | null | undefined, unit = ""): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "—"
  const suffix = unit ? ` ${unit}` : ""
  if (value >= 1) return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`
  if (value >= 0.001) return `${value.toLocaleString("en-US", { maximumSignificantDigits: 4 })}${suffix}`
  // Zeros between the point and the first significant digit: 0.000003015 → 5.
  let zeros = Math.floor(-Math.log10(value))
  let scaled = Math.round(value * 10 ** (zeros + 3))
  if (scaled >= 1000) {
    // Rounding carried a digit (9.999e-6 → 1000): one fewer zero.
    zeros -= 1
    scaled = Math.round(scaled / 10)
  }
  const digits = scaled.toString().slice(0, 3).replace(/0+$/, "") || "0"
  const sub = String(zeros).split("").map((d) => SUBSCRIPT[Number(d)]).join("")
  return `0.0${sub}${digits}${suffix}`
}

export function compactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function compactCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

/** "+12.4%", "−3.1%", or "—" when the token is younger than the window. */
export function signedPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  const abs = Math.abs(value)
  return `${sign}${abs >= 1000 ? Math.round(abs).toLocaleString("en-US") : abs.toFixed(abs >= 100 ? 0 : 1)}%`
}

/** Buy share of a window's trades, 0–100 (50 when there were none). */
export function buyShare(t: { buys: number; sells: number }): number {
  const total = t.buys + t.sells
  return total === 0 ? 50 : (t.buys / total) * 100
}
