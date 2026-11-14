/**
 * Invented launches and market data for building the launchpad UI locally.
 * Only reachable through lib/launchpad-market/source.ts while
 * LAUNCHPAD_MOCKS_ENABLED (lib/launchpad-mocks.ts) is true, which a
 * production build can never be.
 *
 * Every price comes from one deterministic function of time per token
 * (priceAt), so the board's change %, the mini charts, the candles and the
 * trade prices always agree, and a reload shows the same market.
 *
 * Force a state with `?mockState=` on a launchpad URL:
 *   ok (default) · loading · empty · error · unavailable
 */

import type { LaunchpadCurve, LaunchpadFeedFilter, LaunchpadNetworkId, LaunchpadToken } from "@/lib/crypto-backend/types"
import {
  MarketUnavailableError,
  type Candle,
  type ChartRange,
  type LaunchActivity,
  type LaunchHolder,
  type LaunchMarketStats,
  type LaunchpadMarketSource,
  type LaunchPortfolio,
  type LaunchTrade,
  type MarketWindow,
} from "@/lib/launchpad-market/types"

export const LAUNCH_MOCK_STATES = ["ok", "loading", "empty", "error", "unavailable"] as const
export type LaunchMockState = (typeof LAUNCH_MOCK_STATES)[number]

export function parseLaunchMockState(value: string | null | undefined): LaunchMockState {
  return (LAUNCH_MOCK_STATES as readonly string[]).includes(value ?? "") ? (value as LaunchMockState) : "ok"
}

function currentState(): LaunchMockState {
  if (typeof window === "undefined") return "ok"
  return parseLaunchMockState(new URLSearchParams(window.location.search).get("mockState"))
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
/** Mock SOL price in USD, for market caps and volumes. */
export const MOCK_SOL_USD = 182.4
export const MOCK_SUPPLY = 1_000_000_000
const GRADUATION_SOL = 85

/* ── The invented launches ─────────────────────────────────────────── */

type Seed = { name: string; symbol: string; description: string; ageH: number; progress: number; status?: LaunchpadToken["status"]; creatorBps?: number; heat: number }

const MAINNET: Seed[] = [
  { name: "Lagos Lion", symbol: "LION", description: "The pride of Lagos, on-chain. Community-run, no team tokens.", ageH: 30, progress: 0.94, heat: 1.6 },
  { name: "Jollof Coin", symbol: "JOLLOF", description: "Settling the jollof war one block at a time.", ageH: 5, progress: 0.71, heat: 2.2 },
  { name: "Gold Rush", symbol: "RUSH", description: "Digital gold for the street. Fair launch on the curve.", ageH: 70, progress: 1, status: "graduated", heat: 0.9 },
  { name: "Danfo", symbol: "DANFO", description: "Yellow buses, green candles.", ageH: 1.2, progress: 0.18, heat: 3.1 },
  { name: "Afrobeat", symbol: "BEAT", description: "Music, culture and a token that dances.", ageH: 48, progress: 0.56, heat: 1.1 },
  { name: "Suya Swap", symbol: "SUYA", description: "Spicy memes, grilled fresh daily.", ageH: 0.4, progress: 0.06, heat: 2.8 },
  { name: "Naija Pepe", symbol: "NPEPE", description: "Pepe went to Lagos and never came back.", ageH: 12, progress: 0.83, heat: 1.9 },
  { name: "Okada Run", symbol: "OKADA", description: "Fast, a little dangerous, always on time.", ageH: 96, progress: 1, status: "graduated", heat: 0.7 },
  { name: "Street Bull", symbol: "SBULL", description: "For the bulls of WorldStreet.", ageH: 20, progress: 0.42, heat: 1.3 },
  { name: "Harmattan", symbol: "HMTN", description: "Dry season, hot charts.", ageH: 3.5, progress: 0.29, heat: 1.7 },
  { name: "Eko Atlantic", symbol: "EKO", description: "Building on sand, building on Solana.", ageH: 140, progress: 0.99, status: "graduating", heat: 0.8 },
  { name: "Gidi Gang", symbol: "GIDI", description: "Lagos never sleeps; neither does this chart.", ageH: 9, progress: 0.35, creatorBps: 1200, heat: 1.4 },
  { name: "Puff-Puff", symbol: "PUFF", description: "Sweet, round, gone in seconds.", ageH: 0.15, progress: 0.02, heat: 3.4 },
  { name: "Owambe", symbol: "OWMB", description: "The party token. Dress code: aso ebi.", ageH: 26, progress: 0.64, heat: 1.2 },
]

const DEVNET: Seed[] = [
  { name: "Test Rocket", symbol: "TROCK", description: "Devnet test launch for the curve.", ageH: 2, progress: 0.38, heat: 1.5 },
  { name: "Sandbox Cat", symbol: "SCAT", description: "Meow-net. No value, all vibes.", ageH: 18, progress: 0.81, heat: 1.2 },
  { name: "QA Token", symbol: "QA", description: "Created by the QA team to try graduation.", ageH: 60, progress: 1, status: "graduated", heat: 0.6 },
  { name: "Faucet Frog", symbol: "FROG", description: "Funded entirely by the devnet faucet.", ageH: 0.6, progress: 0.09, heat: 2.4 },
  { name: "Staging Star", symbol: "STAR", description: "Release-candidate token.", ageH: 7, progress: 0.52, heat: 1 },
  { name: "Mock Moon", symbol: "MMOON", description: "Going to the moon, on devnet.", ageH: 30, progress: 0.23, heat: 0.9 },
]

function addressOf(seed: number): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let out = ""
  let x = seed >>> 0
  for (let i = 0; i < 44; i++) {
    x = Math.imul(x ^ (x >>> 15), 2_246_822_507) + i * 3_266_489_909
    out += alphabet[(x >>> 0) % alphabet.length]
  }
  return out
}

function hash(text: string): number {
  let h = 2_166_136_261
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16_777_619)
  return h >>> 0
}

type MockLaunch = { token: LaunchpadToken; seed: Seed; createdMs: number; h: number }

function buildLaunches(now: number): MockLaunch[] {
  const make = (networkId: LaunchpadNetworkId, seeds: Seed[], prefix: string) =>
    seeds.map((s, i): MockLaunch => {
      const id = `mock-${prefix}-${s.symbol.toLowerCase()}`
      const h = hash(id)
      const createdMs = now - Math.round(s.ageH * HOUR)
      const status = s.status ?? "live"
      const raisedSol = Math.min(1, s.progress) * GRADUATION_SOL
      return {
        seed: s,
        createdMs,
        h,
        token: {
          launchId: id,
          status,
          chainFamily: "solana",
          networkId,
          creatorAddress: addressOf(h + 1),
          name: s.name,
          symbol: s.symbol,
          description: s.description,
          links: i % 3 === 0 ? { x: `https://x.com/${s.symbol.toLowerCase()}`, website: `https://${s.symbol.toLowerCase()}.example` } : undefined,
          mint: addressOf(h + 2),
          poolAddress: addressOf(h + 3),
          allocation: { creatorBps: s.creatorBps ?? (i % 4 === 0 ? 0 : 200 + (i % 5) * 150) },
          curve: {
            solRaised: String(Math.round(raisedSol * 1e9)),
            progressBps: Math.round(Math.min(1, s.progress) * 10_000),
            graduationLamports: String(GRADUATION_SOL * 1e9),
            refreshedAt: new Date(now - 30_000).toISOString(),
          },
          graduation: status === "graduated" ? { migratedAt: new Date(createdMs + s.ageH * 0.7 * HOUR).toISOString(), ammPoolAddress: addressOf(h + 4) } : undefined,
          createdAt: new Date(createdMs).toISOString(),
          updatedAt: new Date(now - 30_000).toISOString(),
        },
      }
    })
  return [...make("solana-mainnet-beta", MAINNET, "main"), ...make("solana-devnet", DEVNET, "dev")]
}

/* ── One price function per launch ─────────────────────────────────── */

/** Starting price on the curve, SOL per token. */
const BASE_PRICE = 2.8e-8

/**
 * The launch's price at `t` (ms), SOL per token. Rises with the curve's
 * progress over the launch's life, with seeded swings of a few frequencies
 * on top. Null before the launch existed.
 */
export function priceAt(l: MockLaunch, t: number, now: number): number | null {
  if (t < l.createdMs) return null
  const life = Math.max(1, now - l.createdMs)
  const along = Math.min(1, Math.max(0, (t - l.createdMs) / life))
  const progress = Math.min(1, l.seed.progress) * along
  const trend = Math.pow(1 + progress * 3.2, 2)
  const p1 = (l.h % 997) / 997
  const p2 = (l.h % 613) / 613
  const swing =
    0.09 * l.seed.heat * Math.sin(t / (37 * MIN) + p1 * 6.28) +
    0.05 * l.seed.heat * Math.sin(t / (7.3 * MIN) + p2 * 6.28) +
    0.025 * Math.sin(t / (1.9 * MIN) + p1 * 3.1)
  return BASE_PRICE * trend * Math.exp(swing * Math.min(1, along * 6))
}

/** SOL traded in [t, t+span). Deterministic per launch and bucket. */
function volumeIn(l: MockLaunch, t: number, span: number, now: number): number {
  if (t + span <= l.createdMs || t > now) return 0
  const minutes = Math.max(0, Math.min(t + span, now) - Math.max(t, l.createdMs)) / MIN
  const bucket = Math.floor(t / (5 * MIN))
  const noise = 0.5 + ((hash(`${l.token.launchId}:${bucket}`) % 1000) / 1000)
  const youth = 1 + 2.5 * Math.exp(-(now - l.createdMs) / (6 * HOUR))
  return minutes * 0.42 * l.seed.heat * noise * youth * (l.token.status === "graduated" ? 0.35 : 1)
}

const WINDOW_MS: Record<MarketWindow, number> = { "5m": 5 * MIN, "1h": HOUR, "6h": 6 * HOUR, "24h": DAY }

function statsFor(l: MockLaunch, now: number): LaunchMarketStats {
  const price = priceAt(l, now, now) ?? BASE_PRICE
  const changePct = {} as LaunchMarketStats["changePct"]
  const volumeUsd = {} as LaunchMarketStats["volumeUsd"]
  const txns = {} as LaunchMarketStats["txns"]
  const spark = {} as LaunchMarketStats["spark"]
  for (const w of Object.keys(WINDOW_MS) as MarketWindow[]) {
    const span = WINDOW_MS[w]
    const before = priceAt(l, now - span, now)
    changePct[w] = before === null ? null : (price / before - 1) * 100
    const solVol = volumeIn(l, now - span, span, now)
    volumeUsd[w] = Math.round(solVol * MOCK_SOL_USD)
    const count = Math.max(0, Math.round(solVol / (0.35 + (l.h % 7) * 0.05)))
    const buyShare = (changePct[w] ?? 0) >= 0 ? 0.6 : 0.42
    txns[w] = { buys: Math.round(count * buyShare), sells: count - Math.round(count * buyShare) }
    spark[w] = Array.from({ length: 24 }, (_, i) => priceAt(l, now - span + (span * i) / 23, now)).filter((v): v is number => v !== null)
  }
  const holders = Math.round(14 + Math.min(1, l.seed.progress) * 900 * l.seed.heat + (l.h % 40))
  return {
    launchId: l.token.launchId,
    priceSol: price,
    priceUsd: price * MOCK_SOL_USD,
    marketCapUsd: Math.round(price * MOCK_SUPPLY * MOCK_SOL_USD),
    holders,
    changePct,
    volumeUsd,
    txns,
    spark,
  }
}

/** Candle size per range, so each chart shows roughly 60–170 candles. */
export const RANGE_STEP: Record<ChartRange, { span: number | null; step: number }> = {
  "1h": { span: HOUR, step: MIN },
  "6h": { span: 6 * HOUR, step: 5 * MIN },
  "24h": { span: DAY, step: 15 * MIN },
  "7d": { span: 7 * DAY, step: HOUR },
  all: { span: null, step: 0 },
}

export function candlesFor(l: MockLaunch, range: ChartRange, now: number): Candle[] {
  const cfg = RANGE_STEP[range]
  const life = now - l.createdMs
  const span = cfg.span === null ? life : Math.min(cfg.span, life)
  // "All" picks a step that gives ~120 candles of the launch's whole life.
  const step = cfg.span === null ? Math.max(MIN, Math.ceil(life / 120 / MIN) * MIN) : cfg.step
  const start = Math.floor((now - span) / step) * step
  const out: Candle[] = []
  for (let t = Math.max(start, Math.floor(l.createdMs / step) * step); t < now; t += step) {
    const end = Math.min(t + step, now)
    const samples: number[] = []
    for (let k = 0; k <= 6; k++) {
      const v = priceAt(l, t + ((end - t) * k) / 6, now)
      if (v !== null) samples.push(v)
    }
    if (samples.length < 2) continue
    const wick = 1 + ((hash(`${l.token.launchId}:w:${t}`) % 100) / 100) * 0.012
    out.push({ t, o: samples[0]!, c: samples[samples.length - 1]!, h: Math.max(...samples) * wick, l: Math.min(...samples) / wick, v: volumeIn(l, t, step, now) })
  }
  return out
}

export function tradesFor(l: MockLaunch, now: number, count = 40): LaunchTrade[] {
  const out: LaunchTrade[] = []
  let t = now - 4_000
  for (let i = 0; i < count && t > l.createdMs; i++) {
    const r = hash(`${l.token.launchId}:t:${i}`)
    t -= 8_000 + (r % 170_000) / l.seed.heat
    const price = priceAt(l, t, now)
    if (price === null) break
    const sol = Math.round((0.05 + ((r >>> 8) % 1000) / 1000 * 3.2) * 1000) / 1000
    const creator = i === count - 1 && l.token.allocation.creatorBps > 0
    out.push({
      id: `${l.token.launchId}-trade-${i}`,
      at: new Date(t).toISOString(),
      side: r % 5 < 3 ? "buy" : "sell",
      traderLabel: creator ? `${l.token.creatorAddress.slice(0, 4)}…${l.token.creatorAddress.slice(-4)}` : i === 3 ? "You" : `${addressOf(r).slice(0, 4)}…${addressOf(r).slice(-4)}`,
      traderIsCreator: creator,
      solAmount: sol,
      tokenAmount: Math.round(sol / price),
      priceSol: price,
      txHash: addressOf(r + 9).repeat(2).slice(0, 88),
    })
  }
  return out
}

/** The network's latest trades across all its launches, newest first. */
export function activityFor(all: MockLaunch[], networkId: LaunchpadNetworkId, now: number, count = 30): LaunchActivity[] {
  return all
    .filter((l) => l.token.networkId === networkId && l.token.status !== "graduated")
    .flatMap((l) => tradesFor(l, now, 6).map((t) => ({ ...t, launchId: l.token.launchId, name: l.token.name, symbol: l.token.symbol, iconUrl: l.token.iconUrl ?? null, mint: l.token.mint ?? null })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, count)
}

export function holdersFor(l: MockLaunch): LaunchHolder[] {
  const progress = Math.min(1, l.seed.progress)
  const graduated = l.token.status === "graduated"
  const curve = graduated ? 0 : Math.round((1 - progress) * 79.3 * 10) / 10
  const creator = l.token.allocation.creatorBps / 100
  let left = 100 - curve - creator
  const rows: LaunchHolder[] = []
  if (!graduated) rows.push({ label: "Bonding curve", pct: curve, kind: "curve" })
  if (graduated) {
    const pool = Math.round(left * 0.22 * 10) / 10
    rows.push({ label: "Liquidity pool", pct: pool, kind: "curve" })
    left -= pool
  }
  if (creator > 0) rows.push({ label: `${l.token.creatorAddress.slice(0, 4)}…${l.token.creatorAddress.slice(-4)} (creator)`, pct: creator, kind: "creator" })
  for (let i = 0; i < 12 && left > 0.2; i++) {
    const share = Math.round(left * (0.16 + ((hash(`${l.token.launchId}:h:${i}`) % 100) / 1000)) * 100) / 100
    const addr = addressOf(hash(`${l.token.launchId}:h:${i}`))
    rows.push({ label: i === 2 ? "You" : `${addr.slice(0, 4)}…${addr.slice(-4)}`, pct: share, kind: i === 2 ? "you" : "holder" })
    left -= share
  }
  return rows
}

export function curveFor(l: MockLaunch, now: number): LaunchpadCurve {
  const target = GRADUATION_SOL
  const priceAtRaised = (s: number) => BASE_PRICE * Math.pow(1 + (s / target) * 3.2, 2)
  const raised = Math.min(1, l.seed.progress) * target
  return {
    points: Array.from({ length: 41 }, (_, i) => {
      const s = (target * i) / 40
      return { solRaised: String(Math.round(s * 1e9)), price: priceAtRaised(s) }
    }),
    current: l.token.status === "live" ? { solRaised: String(Math.round(raised * 1e9)), price: priceAt(l, now, now) ?? priceAtRaised(raised) } : null,
    graduationLamports: String(target * 1e9),
    tokenDecimals: 6,
  }
}

function feedFor(all: MockLaunch[], networkId: LaunchpadNetworkId, filter: LaunchpadFeedFilter, now: number): LaunchpadToken[] {
  const onNet = all.filter((l) => l.token.networkId === networkId)
  const rows =
    filter === "graduated" ? onNet.filter((l) => l.token.status === "graduated")
      : filter === "near" ? onNet.filter((l) => l.token.status === "live" && (l.token.curve?.progressBps ?? 0) >= 7_500)
        : filter === "new" ? onNet.filter((l) => now - l.createdMs <= DAY && l.token.status === "live")
          : onNet.filter((l) => l.token.status === "live" || l.token.status === "graduating")
  return rows.map((l) => l.token)
}

/* ── The source ─────────────────────────────────────────────────────── */

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
}

async function respond<T>(build: (all: MockLaunch[], now: number, empty: boolean) => T, signal?: AbortSignal): Promise<T> {
  const state = currentState()
  if (state === "loading") return new Promise<T>(() => {})
  await delay(350, signal)
  if (state === "error") throw new Error("Mock: the launchpad service failed")
  if (state === "unavailable") throw new MarketUnavailableError("Market data")
  const now = Date.now()
  return build(buildLaunches(now), now, state === "empty")
}

function find(all: MockLaunch[], launchId: string): MockLaunch {
  const l = all.find((x) => x.token.launchId === launchId)
  if (!l) throw new Error("Launch not found")
  return l
}

export const mockLaunchpadMarket: LaunchpadMarketSource = {
  isMock: true,
  networks: (o) => respond(() => ({
    networks: [
      { networkId: "solana-mainnet-beta", label: "Mainnet" },
      { networkId: "solana-devnet", label: "Devnet" },
    ],
    defaultNetworkId: "solana-mainnet-beta",
  }), o?.signal),
  feed: (networkId, filter, o) => respond((all, now, empty) => (empty ? [] : feedFor(all, networkId, filter, now)), o?.signal),
  token: (launchId, o) => respond((all) => ({ token: find(all, launchId).token, platformFeeBps: 100, tokenDecimals: 6 }), o?.signal),
  curve: (launchId, o) => respond((all, now) => curveFor(find(all, launchId), now), o?.signal),
  stats: (networkId, o) => respond((all, now) => Object.fromEntries(all.filter((l) => l.token.networkId === networkId).map((l) => [l.token.launchId, statsFor(l, now)])), o?.signal),
  candles: (launchId, range, o) => respond((all, now) => candlesFor(find(all, launchId), range, now), o?.signal),
  trades: (launchId, o) => respond((all, now) => tradesFor(find(all, launchId), now), o?.signal),
  activity: (networkId, o) => respond((all, now, empty) => (empty ? [] : activityFor(all, networkId, now)), o?.signal),
  holders: (launchId, o) => respond((all) => holdersFor(find(all, launchId)), o?.signal),
  portfolio: (networkId, o) =>
    respond((all, now, empty): LaunchPortfolio => {
      if (empty) return { launchedIds: [], holdings: [] }
      const onNet = all.filter((l) => l.token.networkId === networkId)
      const held = onNet.filter((_, i) => i % 4 === 1).slice(0, 4)
      return {
        launchedIds: onNet.filter((_, i) => i % 5 === 2).map((l) => l.token.launchId),
        holdings: held.map((l) => {
          const price = priceAt(l, now, now) ?? BASE_PRICE
          const bought = priceAt(l, l.createdMs + (now - l.createdMs) * 0.4, now) ?? price
          const tokens = Math.round(2_000_000 + (l.h % 9) * 1_250_000)
          return { launchId: l.token.launchId, tokens, valueSol: tokens * price, pnlPct: (price / bought - 1) * 100 }
        }),
      }
    }, o?.signal),
}

/** For tests: the invented launches at a fixed time. */
export const __mockLaunchesAt = buildLaunches
