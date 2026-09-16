/**
 * Dummy data for the bridge redesign preview (/bridge-unauth).
 *
 * The live bridge is ONE lane: Arbitrum USDC → Intertrain WSK, 1:1, hardcoded
 * into the component's title. The sidebar even describes the whole feature as
 * "Arbitrum USDC to Intertrain". That is a transfer screen wearing the word
 * "Bridge", and it has three consequences this file exists to undo:
 *
 *   · you cannot choose a route, so there is nothing to compare
 *   · there is no fee, no ETA and no limit anywhere — "Settlement: After
 *     source finality" is prose standing where a number belongs
 *   · once you press the button there is no state at all. A bridge takes
 *     minutes and has distinct stages, and none of them are shown.
 *
 * Deterministic throughout: no Math.random(), no Date.now() at render.
 */

export type ChainId = "arbitrum" | "ethereum" | "solana" | "base" | "tron" | "ton" | "intertrain"

export type Chain = {
  id: ChainId
  name: string
  /** Coin mark to stand in for the chain. */
  symbol: string
  /** Blocks needed before a deposit is considered final. */
  confirmations: number
  /** Seconds a deposit typically takes to reach finality. */
  finalitySeconds: number
}

export const CHAINS: Chain[] = [
  { id: "arbitrum", name: "Arbitrum One", symbol: "ARB", confirmations: 12, finalitySeconds: 120 },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", confirmations: 12, finalitySeconds: 180 },
  { id: "base", name: "Base", symbol: "ETH", confirmations: 10, finalitySeconds: 90 },
  { id: "solana", name: "Solana", symbol: "SOL", confirmations: 32, finalitySeconds: 25 },
  { id: "tron", name: "TRON", symbol: "TRX", confirmations: 19, finalitySeconds: 60 },
  { id: "ton", name: "TON", symbol: "TON", confirmations: 1, finalitySeconds: 15 },
  { id: "intertrain", name: "Intertrain", symbol: "USDC", confirmations: 1, finalitySeconds: 10 },
]

export function chainById(id: ChainId): Chain {
  return CHAINS.find((c) => c.id === id) ?? CHAINS[0]
}

/* ── Routes ─────────────────────────────────────────────────────────────────
   A lane is a (from, to, asset) triple with its own liquidity, fee and relay.
   The live page has exactly one of these and treats it as the product. */

export type Route = {
  id: string
  from: ChainId
  to: ChainId
  /** What you send. */
  asset: string
  /** What lands. Usually the same; the Intertrain lane mints WSK. */
  receiveAsset: string
  /** receiveAsset per asset. */
  rate: number
  /** Bridge fee, as a fraction of the amount. */
  feePct: number
  /** Flat gas cost on the destination, in USD. */
  destinationGasUsd: number
  minAmount: number
  maxAmount: number
  /** Liquidity available on the destination side, in asset units. */
  liquidity: number
  relay: string
  /** What you hold on the source chain. */
  balance: number
}

export const ROUTES: Route[] = [
  { id: "arb-intertrain-usdc", from: "arbitrum", to: "intertrain", asset: "USDC", receiveAsset: "WSK", rate: 1, feePct: 0, destinationGasUsd: 0, minAmount: 1, maxAmount: 250_000, liquidity: 1_840_000, relay: "Intertrain bridge", balance: 1023.44 },
  { id: "arb-sol-usdc", from: "arbitrum", to: "solana", asset: "USDC", receiveAsset: "USDC", rate: 1, feePct: 0.0006, destinationGasUsd: 0.02, minAmount: 5, maxAmount: 500_000, liquidity: 4_120_000, relay: "LI.FI · Circle CCTP", balance: 1023.44 },
  { id: "eth-arb-eth", from: "ethereum", to: "arbitrum", asset: "ETH", receiveAsset: "ETH", rate: 1, feePct: 0.0004, destinationGasUsd: 0.31, minAmount: 0.002, maxAmount: 400, liquidity: 2_400, relay: "Arbitrum canonical", balance: 0.417 },
  { id: "sol-tron-usdt", from: "solana", to: "tron", asset: "USDT", receiveAsset: "USDT", rate: 1, feePct: 0.0009, destinationGasUsd: 1.1, minAmount: 10, maxAmount: 200_000, liquidity: 960_000, relay: "LI.FI", balance: 842.1 },
  { id: "base-arb-usdc", from: "base", to: "arbitrum", asset: "USDC", receiveAsset: "USDC", rate: 1, feePct: 0.0005, destinationGasUsd: 0.18, minAmount: 5, maxAmount: 300_000, liquidity: 2_050_000, relay: "Across", balance: 0 },
  { id: "ton-arb-usdt", from: "ton", to: "arbitrum", asset: "USDT", receiveAsset: "USDT", rate: 1, feePct: 0.0012, destinationGasUsd: 0.22, minAmount: 10, maxAmount: 80_000, liquidity: 410_000, relay: "Stargate", balance: 612.35 },
]

export const DEFAULT_ROUTE = ROUTES[0].id

export function routeById(id: string): Route {
  return ROUTES.find((r) => r.id === id) ?? ROUTES[0]
}

/** Every route out of a chain — used to offer alternatives, not just the one. */
export function routesFrom(from: ChainId): Route[] {
  return ROUTES.filter((r) => r.from === from)
}

/* ── Quote ──────────────────────────────────────────────────────────────── */

export type BridgeQuote = {
  send: number
  bridgeFee: number
  destinationGasUsd: number
  receive: number
  etaSeconds: number
  /** Below min, above max, or past available liquidity. */
  problem: string | null
}

export function quoteRoute(route: Route, amount: number): BridgeQuote {
  const bridgeFee = amount * route.feePct
  const receive = Math.max(0, (amount - bridgeFee) * route.rate)
  const from = chainById(route.from)
  const to = chainById(route.to)

  let problem: string | null = null
  if (amount > 0 && amount < route.minAmount) problem = `Minimum is ${route.minAmount} ${route.asset}`
  else if (amount > route.maxAmount) problem = `Maximum is ${route.maxAmount.toLocaleString("en-US")} ${route.asset}`
  else if (receive > route.liquidity) problem = "More than the destination has available right now"
  else if (amount > route.balance) problem = `Not enough ${route.asset} on ${from.name}`

  return {
    send: amount,
    bridgeFee,
    destinationGasUsd: route.destinationGasUsd,
    receive,
    // Source finality plus the relay's own settling time. The live page says
    // "After source finality" and leaves you to guess what that costs.
    etaSeconds: from.finalitySeconds + to.finalitySeconds + 30,
    problem,
  }
}

/* ── Stages ─────────────────────────────────────────────────────────────────
   What the live flow never renders. A bridge is three distinct waits and the
   middle one is the long one. */

export type StageKey = "source" | "relay" | "destination"

export const STAGES: { key: StageKey; label: string; detail: (r: Route) => string }[] = [
  {
    key: "source",
    label: "Confirming on source",
    detail: (r) => `${chainById(r.from).confirmations} confirmations on ${chainById(r.from).name}`,
  },
  { key: "relay", label: "Relaying", detail: (r) => `${r.relay} attesting the transfer` },
  {
    key: "destination",
    label: "Minting on destination",
    detail: (r) => `${r.receiveAsset} issued on ${chainById(r.to).name}`,
  },
]

/* ── In flight ──────────────────────────────────────────────────────────────
   Transfers already moving, so the tracking layout can be reviewed with
   something in it. */

export type Transfer = {
  id: string
  routeId: string
  amount: number
  receive: number
  /** Which stage it is currently inside. */
  stage: StageKey
  /** Progress through that stage, 0–100. */
  stagePct: number
  /** Seconds remaining overall. Fixed, not a live clock. */
  etaSeconds: number
  txid: string
}

export const IN_FLIGHT: Transfer[] = [
  { id: "t1", routeId: "arb-sol-usdc", amount: 500, receive: 499.7, stage: "relay", stagePct: 62, etaSeconds: 95, txid: "0x7c4e91ab35d0" },
  { id: "t2", routeId: "arb-intertrain-usdc", amount: 1200, receive: 1200, stage: "source", stagePct: 33, etaSeconds: 148, txid: "0x3f5401b76080" },
]

/* ── History ────────────────────────────────────────────────────────────── */

export type BridgeRecord = {
  id: string
  routeId: string
  amount: number
  receive: number
  status: "completed" | "refunded" | "failed"
  /** Fixed offsets, never a clock read. */
  minutesAgo: number
  /** How long it actually took, in seconds. */
  tookSeconds: number
  txid: string
}

export const HISTORY: BridgeRecord[] = [
  { id: "b1", routeId: "arb-intertrain-usdc", amount: 2500, receive: 2500, status: "completed", minutesAgo: 96, tookSeconds: 142, txid: "0x8b8f4c21a1de" },
  { id: "b2", routeId: "eth-arb-eth", amount: 0.42, receive: 0.41983, status: "completed", minutesAgo: 420, tookSeconds: 384, txid: "0xa3f9c1d7e5b2" },
  { id: "b3", routeId: "sol-tron-usdt", amount: 800, receive: 799.28, status: "completed", minutesAgo: 1180, tookSeconds: 118, txid: "5Kq8nRtYuV3w" },
  { id: "b4", routeId: "ton-arb-usdt", amount: 150, receive: 0, status: "refunded", minutesAgo: 2160, tookSeconds: 612, txid: "UQBGvjFGRxPG" },
  { id: "b5", routeId: "base-arb-usdc", amount: 1000, receive: 999.5, status: "completed", minutesAgo: 4320, tookSeconds: 96, txid: "0xf70d9a2c5b1e" },
]

/* ── Formatters ─────────────────────────────────────────────────────────── */

export function formatAmount(value: number, decimals = 4): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: decimals })
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** "2m 15s" rather than 135 — a duration is read, not calculated. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

export function ago(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`
  const days = Math.round(minutes / 1440)
  return days === 1 ? "Yesterday" : `${days}d ago`
}
