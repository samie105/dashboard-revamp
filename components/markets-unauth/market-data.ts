/**
 * Dummy data for the markets redesign preview (/markets-unauth).
 *
 * Deterministic throughout, and — the point of this file — SELF-CONSISTENT.
 * The live page's faults are all consistency faults:
 *
 *   · Market cap, 24h volume and BTC dominance all render as "—", with
 *     "+0.00%" underneath. Every row's Market Cap and Volume cell is "—" too.
 *   · Every 7-day sparkline is drawn in red, including rows that are UP —
 *     MATIC at +0.00% and ARB at +18.22% both get a falling red curve. The
 *     chart is not reading the series.
 *   · BTC prints at $75,938 while the rest of the product prices it near $96k.
 *
 * So here the series is generated FIRST and everything else is read off it:
 * the 24h change is the series' own move, the high and low are its extremes,
 * and the header totals are sums over the rows. A chart cannot disagree with
 * its percentage because the percentage comes from the chart.
 */

/* ── Seeded series ──────────────────────────────────────────────────────── */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A 7-day walk of `n` points landing exactly on `end`. */
function walk(seed: number, n: number, end: number, driftPct: number, volPct: number): number[] {
  const rand = mulberry32(seed)
  const start = end / (1 + driftPct / 100)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const base = start + (end - start) * t
    out.push(base + (rand() - 0.5) * 2 * (volPct / 100) * base * (1 - t))
  }
  out[out.length - 1] = end
  return out
}

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatUSD(value: number, opts?: { compact?: boolean; maxFrac?: number }): string {
  const max = opts?.maxFrac ?? (opts?.compact ? 2 : 2)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact ? "compact" : "standard",
    minimumFractionDigits: Math.min(opts?.compact ? 0 : 2, max),
    maximumFractionDigits: max,
  }).format(value)
}

/** Prices span $96,420 to $0.0000069, so precision has to follow magnitude. */
export function formatPrice(value: number): string {
  const frac = value >= 1000 ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : value >= 0.0001 ? 6 : 8
  return value.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac })
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value)
}

/* ── Markets ────────────────────────────────────────────────────────────── */

export type Quote = "USDT" | "BTC" | "ETH"

export type Market = {
  id: string
  base: string
  name: string
  quote: Quote
  price: number
  /** Derived from `series` — never typed by hand, so it cannot contradict it. */
  changePct: number
  high: number
  low: number
  volumeUsd: number
  marketCapUsd: number
  series: number[]
  /** Chains this pair can be traded on. Deduplicated at source. */
  chains: string[]
  /** Rank for the "Hot" list — trading interest, not price. */
  heat: number
}

type Seed = [
  base: string,
  name: string,
  quote: Quote,
  price: number,
  driftPct: number,
  volPct: number,
  volumeUsd: number,
  marketCapUsd: number,
  chains: string[],
  heat: number,
]

// Prices agree with the other previews (BTC 96,420.50, ETH 3,284.12, …) so a
// reviewer moving between pages does not see the same asset at two prices.
const SEEDS: Seed[] = [
  ["BTC", "Bitcoin", "USDT", 96420.5, 1.84, 1.1, 31_640_000_000, 1_902_000_000_000, ["Bitcoin"], 98],
  ["ETH", "Ethereum", "USDT", 3284.12, 3.46, 1.6, 14_820_000_000, 395_400_000_000, ["Ethereum", "Arbitrum One"], 95],
  ["SOL", "Solana", "USDT", 182.55, -1.27, 2.1, 4_118_000_000, 87_200_000_000, ["Solana"], 91],
  ["XRP", "XRP", "USDT", 2.41, 0.92, 1.8, 3_204_000_000, 138_600_000_000, ["XRP Ledger"], 74],
  ["TON", "Toncoin", "USDT", 5.38, 5.92, 2.6, 389_400_000, 13_600_000_000, ["TON"], 66],
  ["ARB", "Arbitrum", "USDT", 0.372, 8.13, 3.2, 214_800_000, 1_580_000_000, ["Arbitrum One"], 71],
  ["SUI", "Sui", "USDT", 3.14, 5.05, 2.8, 502_100_000, 9_100_000_000, ["Sui"], 69],
  ["AVAX", "Avalanche", "USDT", 41.28, 2.91, 2.2, 612_300_000, 16_900_000_000, ["Avalanche"], 63],
  ["TRX", "TRON", "USDT", 0.242, -0.63, 1.2, 421_700_000, 20_900_000_000, ["TRON"], 58],
  ["DOGE", "Dogecoin", "USDT", 0.1642, -6.41, 3.4, 1_204_000_000, 24_100_000_000, ["Dogecoin"], 77],
  ["LINK", "Chainlink", "USDT", 18.94, -3.12, 2.4, 741_500_000, 11_800_000_000, ["Ethereum", "Arbitrum One"], 61],
  ["DOT", "Polkadot", "USDT", 6.41, -2.64, 2.3, 196_200_000, 9_400_000_000, ["Polkadot"], 47],
  ["ADA", "Cardano", "USDT", 0.918, -0.41, 1.9, 684_000_000, 32_400_000_000, ["Cardano"], 55],
  ["APT", "Aptos", "USDT", 8.22, -4.77, 3.0, 288_900_000, 5_200_000_000, ["Aptos"], 44],
  ["OP", "Optimism", "USDT", 1.742, 11.4, 4.1, 174_600_000, 2_900_000_000, ["Optimism"], 68],
  ["ATOM", "Cosmos", "USDT", 6.12, -3.6, 2.7, 121_400_000, 2_400_000_000, ["Cosmos"], 39],
  ["MATIC", "Polygon", "USDT", 0.482, 0.04, 1.7, 196_200_000, 4_800_000_000, ["Polygon", "Ethereum"], 42],
  ["LTC", "Litecoin", "USDT", 104.7, -3.19, 2.0, 402_800_000, 7_900_000_000, ["Litecoin"], 37],
  ["NEAR", "NEAR Protocol", "USDT", 5.94, 7.28, 3.3, 231_500_000, 6_700_000_000, ["NEAR"], 52],
  ["INJ", "Injective", "USDT", 24.16, 14.62, 4.6, 168_900_000, 2_300_000_000, ["Injective"], 73],
  ["SEI", "Sei", "USDT", 0.594, -8.12, 4.2, 142_700_000, 2_600_000_000, ["Sei"], 48],
  ["TIA", "Celestia", "USDT", 6.87, 9.34, 3.9, 198_300_000, 1_400_000_000, ["Celestia"], 57],
  // Non-USDT quotes, so the quote tabs have something to filter.
  ["ETH", "Ethereum", "BTC", 0.034062, 1.58, 1.1, 2_140_000_000, 395_400_000_000, ["Ethereum"], 84],
  ["SOL", "Solana", "BTC", 0.001893, -3.05, 1.8, 604_000_000, 87_200_000_000, ["Solana"], 72],
  ["TON", "Toncoin", "BTC", 0.0000558, 4.01, 2.4, 88_200_000, 13_600_000_000, ["TON"], 45],
  ["ARB", "Arbitrum", "ETH", 0.0001133, 4.52, 3.0, 61_400_000, 1_580_000_000, ["Arbitrum One"], 49],
  ["OP", "Optimism", "ETH", 0.0005304, 7.68, 3.6, 44_900_000, 2_900_000_000, ["Optimism"], 51],
  ["LINK", "Chainlink", "ETH", 0.005767, -4.52, 2.6, 96_300_000, 11_800_000_000, ["Ethereum"], 43],
]

export const MARKETS: Market[] = SEEDS.map(
  ([base, name, quote, price, driftPct, volPct, volumeUsd, marketCapUsd, chains, heat], i) => {
    const series = walk(1000 + i * 37, 32, price, driftPct, volPct)
    const first = series[0]
    const last = series[series.length - 1]
    return {
      id: `${base}-${quote}`,
      base,
      name,
      quote,
      price,
      // The percentage IS the series' move. This is the fix for the live
      // page's red-chart-on-a-green-row.
      changePct: ((last - first) / first) * 100,
      high: Math.max(...series),
      low: Math.min(...series),
      volumeUsd,
      marketCapUsd,
      series,
      // Deduplicated: the live page renders "Solana ↗ Ethereum ↗ Arbitrum ↗
      // Arbitrum ↗" on the SOL row, listing Arbitrum twice.
      chains: [...new Set(chains)],
      heat,
    }
  },
)

/* ── Header stats — summed from the rows, so none of them can be "—" ────── */

const usdtMarkets = MARKETS.filter((m) => m.quote === "USDT")
/** One entry per asset, so a coin quoted in three pairs is not counted thrice. */
const uniqueAssets = [...new Map(usdtMarkets.map((m) => [m.base, m])).values()]

const listedCap = uniqueAssets.reduce((s, m) => s + m.marketCapUsd, 0)
const btcCap = uniqueAssets.find((m) => m.base === "BTC")?.marketCapUsd ?? 0

/**
 * The cap of everything the exchange does NOT list.
 *
 * Without it, dominance is BTC divided by the 22 assets in this file, which
 * came out at 70.5% — internally consistent and obviously wrong to anyone who
 * knows the number sits near 58%. A market-wide statistic has to be measured
 * against the market, not against the sample, so the rest of it is stated
 * here rather than quietly omitted.
 */
const UNLISTED_CAP = 646_000_000_000

const totalCap = listedCap + UNLISTED_CAP

const STATS_VOLUME = MARKETS.reduce((s, m) => s + m.volumeUsd, 0)

export const STATS = {
  marketCapUsd: totalCap,
  /** Weighted by cap over the LISTED assets — the unlisted bucket has no
   *  series, so averaging it in at zero would drag the move toward nothing. */
  marketCapChangePct:
    uniqueAssets.reduce((s, m) => s + m.changePct * m.marketCapUsd, 0) / (listedCap || 1),
  volumeUsd: STATS_VOLUME,
  btcDominancePct: (btcCap / (totalCap || 1)) * 100,
  listed: MARKETS.length,
  assets: uniqueAssets.length,
  advancing: MARKETS.filter((m) => m.changePct >= 0).length,
  declining: MARKETS.filter((m) => m.changePct < 0).length,
}

/** Fear & Greed, 0–100. */
export const SENTIMENT = { score: 63, label: "Greed" }

/* ── Series behind the header stats ─────────────────────────────────────────
   The stats row was five figures on a flat panel while every other band on
   the page carried a curve or a bar, so it read as the dull strip. Each cell
   gets its own visual, and each one is DERIVED rather than decorative. */

/**
 * Total market cap over 7 days: every listed asset's own series, rebased to
 * its cap and summed, plus the flat unlisted bucket. So the curve is the
 * actual aggregate of the rows below it, not a shape chosen to look busy.
 */
export const CAP_SERIES: number[] = (() => {
  const n = uniqueAssets[0]?.series.length ?? 32
  return Array.from({ length: n }, (_, i) =>
    uniqueAssets.reduce((sum, m) => {
      const last = m.series[m.series.length - 1]
      return sum + (m.series[i] / last) * m.marketCapUsd
    }, UNLISTED_CAP),
  )
})()

/** Seven daily volume bars landing on the reported 24h figure. */
export const VOLUME_DAYS: number[] = (() => {
  const rand = mulberry32(7717)
  const today = STATS_VOLUME
  return Array.from({ length: 7 }, (_, i) =>
    i === 6 ? today : today * (0.62 + rand() * 0.55),
  )
})()

/** Dominance split for the stacked bar: BTC, ETH, everything else. */
export const DOMINANCE_SPLIT: { label: string; pct: number }[] = (() => {
  const ethCap = uniqueAssets.find((m) => m.base === "ETH")?.marketCapUsd ?? 0
  const btc = (btcCap / totalCap) * 100
  const eth = (ethCap / totalCap) * 100
  return [
    { label: "BTC", pct: btc },
    { label: "ETH", pct: eth },
    { label: "Other", pct: Math.max(0, 100 - btc - eth) },
  ]
})()

/* ── Movers ─────────────────────────────────────────────────────────────── */

const byChange = [...MARKETS].sort((a, b) => b.changePct - a.changePct)

export const GAINERS = byChange.slice(0, 5)
export const LOSERS = [...byChange].reverse().slice(0, 5)
export const HOT = [...MARKETS].sort((a, b) => b.heat - a.heat).slice(0, 5)

/** The ticker strip — the most liquid pairs, which is what a tape shows. */
export const TICKER = [...MARKETS].sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, 14)

/* ── Table vocabulary ───────────────────────────────────────────────────── */

export const QUOTE_TABS: { key: Quote | "all" | "favorites"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "USDT", label: "USDT" },
  { key: "BTC", label: "BTC" },
  { key: "ETH", label: "ETH" },
  { key: "favorites", label: "Favorites" },
]

export type SortKey = "rank" | "price" | "changePct" | "high" | "low" | "volumeUsd" | "marketCapUsd"

/** Where a Trade click goes. The live page shows "Not listed" on rows it has
 *  no venue for, which is a dead end where an action belongs. */
export function tradeHref(m: Market): string {
  return `/trade?symbol=${encodeURIComponent(m.base)}&quote=${encodeURIComponent(m.quote)}`
}
