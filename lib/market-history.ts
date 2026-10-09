/**
 * 7-day market history for the markets page's stat cards.
 *
 * CoinGecko's whole-market history (/global/market_cap_chart) is paid-only,
 * so the history is built from what the free API does serve: a few major
 * assets' own 7-day market caps and volumes (/coins/{id}/market_chart), added
 * together. They carry most of the market, so the sum draws the market's
 * week; it names the assets wherever it is shown, never passing itself off
 * as the exact global total.
 *
 * Pure: the fetching lives in getMarketHistory (lib/actions.ts).
 */

/** [timestamp ms, value] pairs, as CoinGecko returns them. */
export type Points = [number, number][]

export type MarketHistory = {
  /** Summed market cap, oldest first, thinned for a small chart. */
  capSeries: number[]
  /** Seven daily volumes, oldest first; the last is the latest 24 hours. */
  volumeDays: number[]
  /** The assets the sums cover, by symbol. */
  assets: string[]
}

/** Sum several series point by point, aligned from their newest end (the
 *  hourly feeds can differ by a point or two at the start). */
export function sumAligned(series: number[][]): number[] {
  if (series.length === 0) return []
  const n = Math.min(...series.map((s) => s.length))
  return Array.from({ length: n }, (_, i) => series.reduce((sum, s) => sum + s[s.length - n + i], 0))
}

/** Keep about `target` points, always including the last. */
export function thin(series: number[], target = 48): number[] {
  if (series.length <= target) return series
  const step = Math.max(1, Math.ceil(series.length / target))
  const out = series.filter((_, i) => i % step === 0)
  if (out[out.length - 1] !== series[series.length - 1]) out.push(series[series.length - 1])
  return out
}

/**
 * Seven daily volumes from an hourly series of rolling 24-hour volume (what
 * market_chart returns for 7 days): the value now, 24 hours back, 48 hours
 * back… Oldest first. Null when the series is too short for seven days.
 */
export function dailyVolumes(hourlyRolling24h: number[], days = 7): number[] | null {
  if (hourlyRolling24h.length < (days - 1) * 24 + 1) return null
  const last = hourlyRolling24h.length - 1
  return Array.from({ length: days }, (_, i) => hourlyRolling24h[last - (days - 1 - i) * 24])
}

/** Build the history from each asset's market_chart response. Null unless
 *  every asset answered with usable data: a sum missing one of them would
 *  draw a cliff that never happened. */

export function buildMarketHistory(charts: { market_caps?: Points; total_volumes?: Points }[], assets: string[]): MarketHistory | null {
  if (charts.length === 0) return null
  const caps: number[][] = []
  const vols: number[][] = []
  for (const c of charts) {
    const cap = (c.market_caps ?? []).map((p) => p[1]).filter((v) => Number.isFinite(v))
    const vol = (c.total_volumes ?? []).map((p) => p[1]).filter((v) => Number.isFinite(v))
    if (cap.length < 2 || vol.length < 2) return null
    caps.push(cap)
    vols.push(vol)
  }
  const capSum = sumAligned(caps)
  const volumeDays = dailyVolumes(sumAligned(vols))
  if (capSum.length < 2 || !volumeDays) return null
  return { capSeries: thin(capSum), volumeDays, assets }
}

/** "BTC, ETH and USDT". */
export function listAssets(symbols: string[]): string {
  if (symbols.length <= 1) return symbols.join("")
  return `${symbols.slice(0, -1).join(", ")} and ${symbols[symbols.length - 1]}`
}
