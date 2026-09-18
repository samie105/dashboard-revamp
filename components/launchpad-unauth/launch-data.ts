/**
 * The launchpad preview's whole backend.
 *
 * No API, no wallet, no chain. Every launch below is invented; the page that
 * renders them says so at the top. What is NOT invented is the arithmetic:
 * price, market cap, progress and the creator's pre-buy cost all come from one
 * curve function, so the chart, the progress rail and the cost summary cannot
 * disagree with each other. That is the property the live pages spent a whole
 * redesign recovering, and a preview is the cheapest place to have it from the
 * start.
 *
 * No "use client": the server-rendered pages import this.
 */

import { mulberry32, seedOf } from "@/components/preview/seeded"

/* ══════════════════════════════════════════════════════════════════════════
   FIGURE PROVENANCE — keep this current. It is the deliverable, not a comment.

   Every number on a launchpad screen is about someone's money. In a preview
   they are all made up, which is fine here and dangerous later: this redesign
   had to cut a Fear & Greed dial, confirmation counts, bridge ETAs, market-cap
   curves and fee splits from live pages because a preview invented them and
   no backend ever served them.

   RULE: an ASSUMED figure may appear in the preview. It may not reach a live
   page until it has moved to SOURCED. Stage 5 hands this list to the backend
   work as its spec.
   ══════════════════════════════════════════════════════════════════════════ */

export type Provenance = {
  figure: string
  kind: "sourced" | "assumed"
  /** Where it comes from, or what it would take to make it real. */
  note: string
  /** Which screens show it — the manifest card filters on this. */
  pages: ("discovery" | "token" | "create")[]
}

export const PROVENANCE: Provenance[] = [
  {
    figure: "Name, symbol, description, links",
    kind: "sourced",
    note: "TokenLaunch — ours, written at draft",
    pages: ["discovery", "token", "create"],
  },
  {
    figure: "Creator allocation %",
    kind: "sourced",
    note: "TokenLaunch.allocation, enforced server-side",
    pages: ["discovery", "token", "create"],
  },
  {
    figure: "SOL raised, tokens sold",
    kind: "sourced",
    note: "Curve program pool account",
    pages: ["discovery", "token"],
  },
  {
    figure: "Graduation threshold",
    kind: "sourced",
    note: "Curve program config",
    pages: ["discovery", "token", "create"],
  },
  {
    figure: "Price and market cap",
    kind: "sourced",
    note: "Derived from pool reserves — arithmetic, not a feed",
    pages: ["discovery", "token", "create"],
  },
  {
    figure: "Supply split (curve / reserve)",
    kind: "sourced",
    note: "Curve program config",
    pages: ["token", "create"],
  },
  {
    figure: "Launch status",
    kind: "sourced",
    note: "TokenLaunch.status, advanced by the reconciler",
    pages: ["discovery", "token"],
  },
  {
    figure: "Mint and pool addresses",
    kind: "sourced",
    note: "Chain",
    pages: ["token"],
  },
  {
    figure: "Launched … ago",
    kind: "sourced",
    note: "TokenLaunch.createdAt",
    pages: ["discovery", "token"],
  },
  {
    figure: "SOL → USD",
    kind: "sourced",
    note: "The existing price feed (getPrices)",
    pages: ["discovery", "token", "create"],
  },

  {
    figure: "Curve constants (30 / 1.073B / 85 SOL)",
    kind: "assumed",
    note: "Standard virtual-reserve values. The real ones are the chosen program's — open question #2",
    pages: ["discovery", "token", "create"],
  },
  {
    figure: "“Near graduation” at 75%",
    kind: "assumed",
    note: "A filter threshold — a product call, not a fact about the curve",
    pages: ["discovery"],
  },
  {
    figure: "Creation fee (0.02 SOL)",
    kind: "assumed",
    note: "Fee model undecided — open question #3",
    pages: ["create"],
  },
  {
    figure: "Network rent (~0.022 SOL)",
    kind: "assumed",
    note: "Estimate. The real figure comes from simulating the launch transaction",
    pages: ["create"],
  },
  {
    figure: "Trading fee (1%)",
    kind: "assumed",
    note: "Fee model undecided — open question #3",
    pages: ["token", "create"],
  },
  {
    figure: "20% allocation cap",
    kind: "assumed",
    note: "LAUNCHPAD_MAX_CREATOR_BPS — a proposal, not a decision",
    pages: ["create"],
  },
  {
    figure: "Buy / sell quote",
    kind: "sourced",
    note: "Program math over live pool reserves — never a local reimplementation in production",
    pages: ["token"],
  },
  {
    figure: "Price impact, minimum received",
    kind: "sourced",
    note: "Arithmetic over the quote and your slippage",
    pages: ["token"],
  },
  {
    figure: "Recent trades",
    kind: "assumed",
    note: "Needs a curve-trade index — the same missing index as price history",
    pages: ["token"],
  },
  {
    figure: "Your SOL and token balance",
    kind: "assumed",
    note: "A demo wallet here. Live: the existing wallet balances hook",
    pages: ["token"],
  },
  {
    figure: "Buy past the threshold",
    kind: "assumed",
    note: "Here the excess is simply not taken. The real behaviour is the chosen program's",
    pages: ["token"],
  },
  {
    figure: "Name / symbol rules",
    kind: "assumed",
    note: "Proposed validation — see validateDraft()",
    pages: ["create"],
  },
]

/* Deliberately NOT on any screen, and listed so nobody adds them by accident:
     holderCount       — needs an indexer
     timeToGraduation  — no ETA exists anywhere; progress is shown instead
     priceHistory      — needs a curve-trade index (the token page charts the
                         CURVE, which is config, not history)
     volume24h         — same index
     trendingRank      — needs a formula nobody has defined; discovery ranks
                         by graduation progress, which is real              */

/* ── Curve ──────────────────────────────────────────────────────────────────
   A virtual-reserve constant-product curve — the shape the candidate programs
   use. Price is vSol / vTok, and k = vSol · vTok never changes, so everything
   below is exact algebra rather than an approximation.

   Checked: at the 85 SOL threshold the curve has sold 793.1M of its 800M
   supply, so the threshold and the supply agree with each other. */

export const TOTAL_SUPPLY = 1_000_000_000
/** Sold on the curve. */
export const CURVE_SUPPLY = 800_000_000
/** Held back and paired with the raised SOL as the AMM pool at graduation —
 *  this is the "liquidity seeding". */
export const RESERVE_SUPPLY = TOTAL_SUPPLY - CURVE_SUPPLY
export const VIRTUAL_SOL = 30
export const VIRTUAL_TOKENS = 1_073_000_000
export const GRADUATION_SOL = 85
const K = VIRTUAL_SOL * VIRTUAL_TOKENS

export const CREATE_FEE_SOL = 0.02
export const NETWORK_RENT_SOL = 0.022
export const TRADE_FEE_BPS = 100
export const MAX_CREATOR_BPS = 2000
/** Sourced in production from the price feed; frozen here. */
export const SOL_USD = 216.4

/** Tokens the curve has released once `solRaised` SOL has gone in. */
export function tokensSoldAt(solRaised: number): number {
  return VIRTUAL_TOKENS - K / (VIRTUAL_SOL + solRaised)
}

/** Spot price, SOL per token, at `solRaised`. vSol² / k. */
export function priceAt(solRaised: number): number {
  const vSol = VIRTUAL_SOL + solRaised
  return (vSol * vSol) / K
}

/** SOL needed to buy `tokens` starting from a curve that has raised `from`. */
export function solToBuy(tokens: number, from = 0): number {
  const vSol = VIRTUAL_SOL + from
  const vTok = K / vSol
  if (tokens <= 0) return 0
  if (tokens >= vTok) return Infinity
  return K / (vTok - tokens) - vSol
}

/** The creator's pre-buy: `bps` of curve supply off a fresh curve. */
export function creatorAllocation(bps: number) {
  const tokens =
    (Math.min(Math.max(bps, 0), MAX_CREATOR_BPS) / 10_000) * CURVE_SUPPLY
  const sol = solToBuy(tokens)
  return { tokens, sol, usd: sol * SOL_USD }
}

/** The curve as points, price against tokens sold — for the chart. Config,
 *  not history: this line exists before a single trade. */
export function curvePoints(
  n = 64
): { sold: number; price: number; sol: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const sol = (GRADUATION_SOL * i) / (n - 1)
    return { sol, sold: tokensSoldAt(sol), price: priceAt(sol) }
  })
}

/* ── Trading on the curve ───────────────────────────────────────────────
   Exact inverses of each other: buying and immediately selling the same
   tokens returns the SOL put in less the two fees, to the lamport. Checked
   before this was written — a quote that could create or destroy value on a
   round trip would be a quote that lies. */

/** Tokens out for `solIn` (after fee) against a curve that has raised `raised`. */
export function tokensForSol(solIn: number, raised: number): number {
  const vSol = VIRTUAL_SOL + raised
  return K / vSol - K / (vSol + solIn)
}

/** SOL out (before fee) for selling `tokensIn` into a curve at `raised`. */
export function solForTokens(tokensIn: number, raised: number): number {
  const vSol = VIRTUAL_SOL + raised
  return vSol - K / (K / vSol + tokensIn)
}

/** How long a curve quote is shown before it is re-read. A UI cadence, not a
 *  chain fact: reserves move whenever anyone else trades. */
export const CURVE_QUOTE_TTL = 20

export type CurveQuote = {
  side: "buy" | "sell"
  /** What the user puts in: SOL for a buy, tokens for a sell. */
  amountIn: number
  /** What they get, after fee. */
  amountOut: number
  feeSol: number
  priceImpactPct: number
  minOut: number
  /** A buy larger than what is left on the curve — the excess is not taken. */
  cappedAtSol?: number
}

export function quoteCurve(
  side: "buy" | "sell",
  amountIn: number,
  launch: LaunchView,
  slippageBps: number
): CurveQuote | null {
  if (!Number.isFinite(amountIn) || amountIn <= 0 || launch.status !== "live")
    return null
  const raised = launch.solRaised
  const spot = priceAt(raised)

  if (side === "buy") {
    let gross = amountIn
    let cappedAtSol: number | undefined
    // Net SOL that would fill the curve exactly: remaining / (1 - fee).
    const fillGross = launch.remainingSol / (1 - TRADE_FEE_BPS / 10_000)
    if (gross > fillGross) {
      cappedAtSol = fillGross
      gross = fillGross
    }
    const feeSol = (gross * TRADE_FEE_BPS) / 10_000
    const net = gross - feeSol
    const out = tokensForSol(net, raised)
    const avg = net / out
    return {
      side,
      amountIn: gross,
      amountOut: out,
      feeSol,
      priceImpactPct: (avg / spot - 1) * 100,
      minOut: out * (1 - slippageBps / 10_000),
      cappedAtSol,
    }
  }

  const gross = solForTokens(amountIn, raised)
  const feeSol = (gross * TRADE_FEE_BPS) / 10_000
  const out = gross - feeSol
  const avg = gross / amountIn
  return {
    side,
    amountIn,
    amountOut: out,
    feeSol,
    priceImpactPct: (1 - avg / spot) * 100,
    minOut: out * (1 - slippageBps / 10_000),
  }
}

/** The preview's pretend wallet. Assumed — see the manifest. */
export const DEMO_SOL_BALANCE = 12.5
export function demoTokenBalance(launch: Launch): number {
  const rand = mulberry32(seedOf(`${launch.id}:holding`))
  // Most launches: nothing held. A few: a position worth selling.
  return rand() < 0.45 ? Math.round(rand() * 24_000_000) : 0
}

export type CurveTrade = {
  id: string
  side: "buy" | "sell"
  sol: number
  tokens: number
  wallet: string
  minutesAgo: number
}

/** A seeded tape of recent curve trades. Assumed — no trade index exists. */
export function tradesFor(launch: Launch, n = 14): CurveTrade[] {
  const rand = mulberry32(seedOf(`${launch.id}:tape`))
  const trades: CurveTrade[] = []
  let raised = Math.min(launch.solRaised, GRADUATION_SOL)
  let minutes = Math.max(1, Math.floor(rand() * 4))
  for (let i = 0; i < n && raised > 0.2; i++) {
    const buy = rand() < 0.7
    const sol = Math.round((0.05 + rand() * rand() * 3.5) * 1000) / 1000
    // Walk the curve BACKWARDS from today, so the newest trade is priced at
    // the current reserves and each earlier one a little lower down.
    const before = buy ? Math.max(0, raised - sol) : raised
    const tokens = buy
      ? tokensForSol(sol, before)
      : tokensForSol(sol, Math.max(0, raised - sol))
    trades.push({
      id: `${launch.id}-t${i}`,
      side: buy ? "buy" : "sell",
      sol,
      tokens,
      wallet: address(seedOf(`${launch.id}:w${i}`), 44),
      minutesAgo: minutes,
    })
    if (buy) raised = before
    minutes += 1 + Math.floor(rand() * 9)
  }
  return trades
}

/* ── Launches ───────────────────────────────────────────────────────────── */

export type LaunchStatus = "live" | "graduating" | "graduated"

export type Launch = {
  id: string
  name: string
  symbol: string
  description: string
  /** Avatar hue, 0–360. A real launch has an uploaded icon instead. */
  hue: number
  iconUrl?: string
  creatorBps: number
  solRaised: number
  status: LaunchStatus
  /** Fixed offset rather than a timestamp: no clock is read at render. */
  minutesAgo: number
  creator: string
  mint: string
  links: { website?: string; x?: string; telegram?: string }
}

/** Everything a screen shows about a launch, derived in ONE place. */
export type LaunchView = Launch & {
  progressBps: number
  tokensSold: number
  priceSol: number
  priceUsd: number
  marketCapUsd: number
  remainingSol: number
  creatorTokens: number
}

export function viewOf(launch: Launch): LaunchView {
  const sol = Math.min(launch.solRaised, GRADUATION_SOL)
  const priceSol = priceAt(sol)
  return {
    ...launch,
    progressBps: Math.round((sol / GRADUATION_SOL) * 10_000),
    tokensSold: tokensSoldAt(sol),
    priceSol,
    priceUsd: priceSol * SOL_USD,
    marketCapUsd: priceSol * TOTAL_SUPPLY * SOL_USD,
    remainingSol: Math.max(0, GRADUATION_SOL - sol),
    creatorTokens: creatorAllocation(launch.creatorBps).tokens,
  }
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
function address(seed: number, length: number): string {
  const rand = mulberry32(seed)
  return Array.from(
    { length },
    () => BASE58[Math.floor(rand() * BASE58.length)]
  ).join("")
}

type Seed = Pick<
  Launch,
  "id" | "name" | "symbol" | "description" | "status"
> & {
  /** Fraction of the way to graduation, for live launches. */
  progress?: number
  links?: Launch["links"]
}

/* Hand-written names, seeded numbers. The names are fictional and chosen not
   to collide with anything listed — which is the rule the symbol check in
   the create form enforces. */
const SEEDS: Seed[] = [
  {
    id: "ember",
    name: "Ember",
    symbol: "EMBR",
    status: "live",
    progress: 0.93,
    description:
      "A community token for people who keep the fire going at 3am. No roadmap, one rule: stay warm.",
    links: { x: "emberonsol" },
  },
  {
    id: "tidewater",
    name: "Tidewater",
    symbol: "TIDE",
    status: "live",
    progress: 0.81,
    description:
      "Rises and falls on a schedule nobody controls. Launched by a sailing club that got bored in winter.",
    links: { website: "https://tidewater.example" },
  },
  {
    id: "quartz-owl",
    name: "Quartz Owl",
    symbol: "QOWL",
    status: "live",
    progress: 0.64,
    description:
      "Nocturnal, crystalline, mildly judgemental. The mascot of a late-night study group.",
  },
  {
    id: "gilded-finch",
    name: "Gilded Finch",
    symbol: "FINCH",
    status: "graduated",
    description:
      "The first launch on the preview to graduate. Liquidity was seeded to the AMM when the curve filled.",
    links: {
      website: "https://finch.example",
      x: "gildedfinch",
      telegram: "gildedfinch",
    },
  },
  {
    id: "night-market",
    name: "Night Market",
    symbol: "NIGHT",
    status: "live",
    progress: 0.52,
    description:
      "For the stalls that open after dark. Proceeds of the creator allocation fund absolutely nothing — it says so right here.",
  },
  {
    id: "lantern",
    name: "Lantern",
    symbol: "LNTRN",
    status: "graduating",
    description:
      "Hit the threshold an hour ago. Migration to the AMM has been submitted and is confirming.",
  },
  {
    id: "saltmarsh",
    name: "Saltmarsh",
    symbol: "SALT",
    status: "live",
    progress: 0.38,
    description:
      "A wetland conservation meme with no actual conservation attached. Brackish by design.",
  },
  {
    id: "copper-moth",
    name: "Copper Moth",
    symbol: "CMOTH",
    status: "live",
    progress: 0.29,
    description: "Drawn to every green candle. Has not yet learned from this.",
  },
  {
    id: "harbor-light",
    name: "Harbor Light",
    symbol: "HARBR",
    status: "live",
    progress: 0.21,
    description: "Guiding ships nowhere in particular since this afternoon.",
  },
  {
    id: "paper-crane",
    name: "Paper Crane",
    symbol: "CRANE",
    status: "graduated",
    description: "Folded a thousand times, graduated once.",
    links: { x: "papercranesol" },
  },
  {
    id: "orchard",
    name: "Orchard",
    symbol: "ORCH",
    status: "live",
    progress: 0.14,
    description:
      "Slow-growing. Planted by someone patient, for people who are not.",
  },
  {
    id: "kestrel",
    name: "Kestrel",
    symbol: "KSTRL",
    status: "live",
    progress: 0.09,
    description: "Hovers in place, then drops. Named honestly.",
  },
  {
    id: "velvet-static",
    name: "Velvet Static",
    symbol: "VELVT",
    status: "live",
    progress: 0.05,
    description: "Soft noise from a radio nobody owns.",
  },
  {
    id: "iron-kite",
    name: "Iron Kite",
    symbol: "IKITE",
    status: "live",
    progress: 0.03,
    description: "Should not fly. Currently flying.",
  },
  {
    id: "moss",
    name: "Moss",
    symbol: "MOSS",
    status: "live",
    progress: 0.71,
    description: "Grows on anything left still for long enough.",
  },
  {
    id: "basalt",
    name: "Basalt",
    symbol: "BSLT",
    status: "live",
    progress: 0.46,
    description: "Cooled lava. Very stable. Allegedly.",
  },
]

export const LAUNCHES: Launch[] = SEEDS.map((s) => {
  const seed = seedOf(s.id)
  const rand = mulberry32(seed)
  const progress = s.status === "live" ? (s.progress ?? rand()) : 1
  return {
    id: s.id,
    name: s.name,
    symbol: s.symbol,
    description: s.description,
    status: s.status,
    hue: Math.floor(rand() * 360),
    // Most creators take little; a few take a lot. The cap is the point of
    // showing it.
    creatorBps: [0, 150, 300, 500, 800, 1200, 1800][Math.floor(rand() * 7)],
    solRaised: Math.round(progress * GRADUATION_SOL * 100) / 100,
    minutesAgo:
      s.status === "graduated"
        ? 1440 + Math.floor(rand() * 4000)
        : Math.floor(8 + (1 - progress) * 20 + rand() * 900),
    creator: address(seed ^ 0x5bd1e995, 44),
    mint: address(seed ^ 0x27d4eb2f, 44),
    links: s.links ?? {},
  }
})

export function launchById(id: string): Launch | undefined {
  return LAUNCHES.find((l) => l.id === id)
}

/* ── Create-form validation ─────────────────────────────────────────────────
   PROPOSED rules — listed in the manifest as assumed. They are here so the
   form can be reviewed with real behaviour, and each one is a product call. */

/** Symbols already listed or reserved. Impersonating one on our own launchpad
 *  is the cheapest scam there is, and the check is a Set lookup. */
export const RESERVED_SYMBOLS = new Set([
  "SOL",
  "WSOL",
  "USDC",
  "USDT",
  "BTC",
  "WBTC",
  "ETH",
  "WETH",
  "WSK",
  "JUP",
  "BONK",
  "WIF",
  "PYTH",
  "RAY",
  "JTO",
  "ORCA",
  "MSOL",
  "JITOSOL",
  "ARB",
  "OP",
  "LINK",
  "UNI",
  "AAVE",
  "DAI",
  "PYUSD",
  "TRX",
  "SUI",
  "TON",
])

export type Draft = {
  name: string
  symbol: string
  description: string
  website: string
  x: string
  telegram: string
  creatorBps: number
  iconUrl?: string
}

export type DraftCheck = {
  key: string
  ok: boolean
  label: string
  blocking: boolean
}

export function validateDraft(d: Draft): DraftCheck[] {
  const name = d.name.trim()
  const symbol = d.symbol.trim().toUpperCase()
  const urlOk = (v: string) =>
    !v.trim() || /^https:\/\/[^\s.]+\.[^\s]{2,}$/i.test(v.trim())
  const handleOk = (v: string) =>
    !v.trim() || /^@?[A-Za-z0-9_]{1,32}$/.test(v.trim())
  const taken = LAUNCHES.some((l) => l.symbol === symbol)

  return [
    {
      key: "name",
      ok: name.length >= 2 && name.length <= 32,
      label: "Name is 2–32 characters",
      blocking: true,
    },
    {
      key: "symbol",
      ok: /^[A-Z0-9]{2,10}$/.test(symbol),
      label: "Symbol is 2–10 letters or digits",
      blocking: true,
    },
    {
      key: "reserved",
      ok: !RESERVED_SYMBOLS.has(symbol),
      label: "Symbol isn't a listed asset",
      blocking: true,
    },
    {
      key: "taken",
      ok: !taken,
      label: "Symbol isn't already launched here",
      blocking: true,
    },
    {
      key: "description",
      ok: d.description.trim().length <= 280,
      label: "Description is 280 characters or fewer",
      blocking: true,
    },
    {
      key: "links",
      ok: urlOk(d.website) && handleOk(d.x) && handleOk(d.telegram),
      label: "Links are well-formed",
      blocking: true,
    },
    {
      key: "icon",
      ok: Boolean(d.iconUrl),
      label: "Icon added",
      blocking: false,
    },
    {
      key: "allocation",
      ok: d.creatorBps <= MAX_CREATOR_BPS,
      label: `Creator allocation within ${MAX_CREATOR_BPS / 100}%`,
      blocking: true,
    },
  ]
}

/** The draft rendered as a launch, so the preview card is the real card. */
export function draftAsLaunch(d: Draft): Launch {
  const symbol = d.symbol.trim().toUpperCase()
  return {
    id: "draft",
    name: d.name.trim() || "Your token",
    symbol: symbol || "TICKER",
    description: d.description.trim() || "Your description appears here.",
    hue: seedOf(symbol || "draft") % 360,
    iconUrl: d.iconUrl,
    creatorBps: d.creatorBps,
    // At launch the creator's pre-buy is the only SOL in the curve.
    solRaised: creatorAllocation(d.creatorBps).sol,
    status: "live",
    // -1 = not launched yet. 0 is reserved for "just now", which is what a
    // launch that has actually gone live should say.
    minutesAgo: -1,
    creator: "You",
    mint: "",
    links: {},
  }
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

export function fmtSol(n: number, max = 4): string {
  if (!Number.isFinite(n)) return "—"
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: max })} SOL`
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—"
  if (n >= 1000)
    return `$${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Very small prices keep three significant figures rather than rounding to 0. */
export function fmtTinyUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—"
  if (n >= 0.01) return `$${n.toFixed(4)}`
  return `$${n.toPrecision(3)}`
}

export function fmtTokens(n: number): string {
  return Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

export function fmtPct(bps: number): string {
  const pct = bps / 100
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`
}

export function ago(minutes: number): string {
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  const days = Math.floor(minutes / 1440)
  return days === 1 ? "1 day ago" : `${days} days ago`
}

export function shortAddress(a: string): string {
  return a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`
}

export const STATUS_LABEL: Record<LaunchStatus, string> = {
  live: "On the curve",
  graduating: "Graduating",
  graduated: "Graduated",
}
