/**
 * Registry row → spot order intent (spec §8).
 *
 * The modern wallet has no hardcoded market catalogue: every tradable pair
 * arrives from `/trading/spot/markets`, and this module is the only place that
 * turns one of those rows plus a USD amount into the exact payload the backend
 * expects. Both venues route through LI.FI; the registry's `venue` field
 * (`0x` / `jupiter`) says which token identifiers the row carries, not who
 * executes the trade.
 *
 * The law here is REFUSE, NEVER GUESS. A mis-scaled order is the catastrophic
 * failure mode of this screen: one wrong decimal exponent sells 1e12 times the
 * intended size. So anything we are not certain about — a token whose decimals
 * we don't know, a row missing its addresses, a sell with no live price —
 * returns `{ kind: "unavailable", reason }` for the UI to gate on BEFORE the
 * user can press the button. Nothing here ever picks a plausible default.
 */

import { toBaseUnits } from "@/lib/crypto-wallet/address-validation"
import type { CryptoBackendClient } from "./client"

type EvmSpotInput = Parameters<CryptoBackendClient["createModernSpotIntent"]>[0]
type LifiSwapInput = Parameters<CryptoBackendClient["createModernLifiSwapIntent"]>[0]

/** The live registry row, exactly as `getModernSpotMarkets` returns it. */
type RegistryRow = Awaited<ReturnType<CryptoBackendClient["getModernSpotMarkets"]>>["markets"][number]

/**
 * What this builder accepts. It is deliberately looser than `RegistryRow` —
 * the trade workspace carries registry rows through its own list type, so
 * every field arrives optional and gets validated here rather than trusted.
 */
export type ModernSpotMarketRow = {
  id?: string
  symbol: string
  quote?: string
  networkId?: string
  venue?: string
  chartSymbol?: string
  chartSupported?: boolean
  price?: number
  icon?: string | null
  sellToken?: string
  buyToken?: string
  inputMint?: string
  outputMint?: string
  baseDecimals?: number
  quoteDecimals?: number
}

/** Compile-time proof a real registry row is accepted as-is (spec §8). */
export type RegistryRowIsAccepted = RegistryRow extends ModernSpotMarketRow ? true : never

export type SpotOrderPlan =
  | { kind: "evm"; input: EvmSpotInput }
  | { kind: "lifi"; input: LifiSwapInput }
  | { kind: "unavailable"; reason: string }

/**
 * One slippage figure for every spot route, as a fraction.
 *
 * Solana used to take its own `slippageBps` because it went to Jupiter, which
 * speaks basis points. Both routes are LI.FI now and both take the fraction,
 * so the two constants that had to be kept in agreement are one constant.
 */
export const SLIPPAGE_PERCENTAGE = 0.01

/**
 * Until the registry carries decimals (backend request filed — see the plan's
 * Backend Asks), refuse pairs whose token precision we don't know.
 *
 * Keys are `networkId:identifier`. EVM addresses are hex and case-insensitive,
 * so they are stored lowercased; Solana mints are base58 and case-SENSITIVE,
 * so they are stored verbatim and matched exactly.
 *
 * The symbol is carried alongside so the row's stated quote asset can be
 * checked against the address the row hands us — see `orientationProblem`.
 */
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "arbitrum-one:0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 },
  "arbitrum-one:0x82af49447d8a07e3bd95bd0d56f35241523fbab1": { symbol: "WETH", decimals: 18 },
  "ethereum-mainnet:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { symbol: "USDC", decimals: 6 },
  "ethereum-mainnet:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { symbol: "WETH", decimals: 18 },
  "solana-mainnet-beta:So11111111111111111111111111111111111111112": { symbol: "SOL", decimals: 9 },
  "solana-mainnet-beta:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", decimals: 6 },
}

/** Quote assets the ticket's USD amount can be taken at face value against. */
const USD_QUOTE_SYMBOLS = new Set(["USD", "USDC", "USDC.E", "USDT", "USDB", "DAI"])

const EVM_SPOT_NETWORKS = new Set<EvmSpotInput["networkId"]>(["ethereum-mainnet", "arbitrum-one"])

function knownTokenFor(networkId: string, identifier: string) {
  const key = networkId.startsWith("solana")
    ? `${networkId}:${identifier}`
    : `${networkId}:${identifier.toLowerCase()}`
  return KNOWN_TOKENS[key]
}

/**
 * Decimals for a token the backend named, or `undefined` when we have never
 * been told — the caller must refuse, not assume 18.
 */
export function tokenDecimalsFor(networkId: string, identifier: string): number | undefined {
  return knownTokenFor(networkId, identifier)?.decimals
}

/**
 * The registry states its token identifiers in the BUY direction: the token
 * spent (`sellToken`/`inputMint`) is the quote, the token received is the base.
 * That is an assumption about someone else's payload, so where we recognise
 * the address we check it — a row whose "spend this" address is not the quote
 * asset it names would trade backwards, and is refused instead.
 */
function orientationProblem(networkId: string, quoteIdentifier: string, quoteSymbol: string, label: string): string | null {
  const known = knownTokenFor(networkId, quoteIdentifier)
  if (!known || known.symbol === quoteSymbol) return null
  return `The registry's token addresses for ${label} don't line up with the ${quoteSymbol} quote it names, so we won't guess which side of the trade is which.`
}

function unavailable(reason: string): SpotOrderPlan {
  return { kind: "unavailable", reason }
}

function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto
  return typeof webCrypto?.randomUUID === "function"
    ? webCrypto.randomUUID()
    : `spot-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** A double carries ~15-17 honest significant digits; 15 is the noise-free floor. */
const SIGNIFICANT_DIGITS = 15

/**
 * A plain (never exponential) decimal string carrying only the double's honest
 * digits. `toFixed` alone is not enough: `(100 / 2500).toFixed(18)` reads
 * `0.040000000000000001` because that IS the binary value — printing the noise
 * would send one extra wei of a token we were asked for exactly 0.04 of.
 */
function plainDecimal(value: number, significantDigits: number): string {
  const printed = value.toPrecision(significantDigits)
  if (!/e/i.test(printed)) return printed
  const [mantissa, exponent] = printed.split(/e/i)
  const negative = mantissa.startsWith("-")
  const unsigned = negative ? mantissa.slice(1) : mantissa
  const dot = unsigned.indexOf(".")
  const digits = unsigned.replace(".", "")
  const pointIndex = (dot === -1 ? unsigned.length : dot) + Number(exponent)
  const body =
    pointIndex <= 0
      ? `0.${"0".repeat(-pointIndex)}${digits}`
      : pointIndex >= digits.length
        ? digits + "0".repeat(pointIndex - digits.length)
        : `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`
  return negative ? `-${body}` : body
}

/** Drop (never round up) fraction digits the token cannot represent. */
function truncateFraction(decimalText: string, decimals: number): string {
  const [whole, fraction = ""] = decimalText.split(".")
  if (fraction.length <= decimals) return decimalText
  return decimals === 0 ? whole : `${whole}.${fraction.slice(0, decimals)}`
}

/**
 * Exact base-unit conversion. `toBaseUnits` is string/BigInt maths, so the
 * only float in the chain is the quantity itself — printed at the token's own
 * precision, with the binary noise trimmed, before it is ever scaled.
 */
function sizeInBaseUnits(quantity: number, decimals: number): { units: string } | { problem: "unusable" | "dust" } {
  if (!Number.isFinite(quantity) || quantity <= 0) return { problem: "unusable" }
  // Past 1e21 there is no honest decimal string for a double this side of BigInt.
  if (quantity >= 1e21) return { problem: "unusable" }
  const units = toBaseUnits(truncateFraction(plainDecimal(quantity, SIGNIFICANT_DIGITS), decimals), decimals)
  if (units === null) return { problem: "unusable" }
  if (units === "0") return { problem: "dust" }
  return { units }
}

/**
 * Turn a registry row + ticket state into the exact intent input, or say why
 * we won't. `side === "buy"` spends the quote token for the base; `"sell"`
 * reverses it. Buys are already denominated in USD (≈ the quote stablecoin);
 * sells convert `amountUsd / price` into the base token's own units.
 */
export function buildSpotOrderPlan(
  row: ModernSpotMarketRow,
  side: "buy" | "sell",
  amountUsd: number,
  price: number,
): SpotOrderPlan {
  const label = row.symbol ? row.symbol.toUpperCase() : "This market"

  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return unavailable("Enter an amount above zero to size this order.")
  }

  const quoteSymbol = (row.quote ?? "").toUpperCase()
  if (!quoteSymbol) return unavailable(missingQuoteReason(label))
  if (!USD_QUOTE_SYMBOLS.has(quoteSymbol)) {
    // The ticket takes a USD figure. Against a non-USD quote that figure is a
    // different quantity entirely — the mis-scaling this module exists to stop.
    return unavailable(`${label} is quoted in ${quoteSymbol}, and this ticket only sizes orders in USD.`)
  }
  if (side === "sell" && !(Number.isFinite(price) && price > 0)) {
    return unavailable(`We don't have a live ${label} price yet, so we can't work out how much to sell.`)
  }

  if (row.venue === "0x") return buildEvmPlan(row, side, amountUsd, price, label, quoteSymbol)
  if (row.venue === "jupiter") return buildSolanaPlan(row, side, amountUsd, price)
  return unavailable(venueReason(row.venue, label))
}

function buildEvmPlan(
  row: ModernSpotMarketRow,
  side: "buy" | "sell",
  amountUsd: number,
  price: number,
  label: string,
  quoteSymbol: string,
): SpotOrderPlan {
  const networkId = row.networkId as EvmSpotInput["networkId"] | undefined
  if (!networkId || !EVM_SPOT_NETWORKS.has(networkId)) {
    return unavailable(
      `${label} settles on ${row.networkId ?? "an unnamed network"}, which Worldstreet spot doesn't cover yet.`,
    )
  }
  // The registry states the buy direction: sell the quote, buy the base.
  const quoteToken = row.sellToken
  const baseToken = row.buyToken
  if (!quoteToken || !baseToken) {
    return unavailable(`The market registry didn't include the token addresses for ${label}, so we can't build the order.`)
  }
  const misoriented = orientationProblem(networkId, quoteToken, quoteSymbol, label)
  if (misoriented) return unavailable(misoriented)

  const sellToken = side === "buy" ? quoteToken : baseToken
  const buyToken = side === "buy" ? baseToken : quoteToken
  const sellDecimals = side === "buy"
    ? row.quoteDecimals ?? tokenDecimalsFor(networkId, sellToken)
    : row.baseDecimals ?? tokenDecimalsFor(networkId, sellToken)
  if (sellDecimals === undefined) {
    return unavailable(precisionReason(side === "buy" ? quoteSymbol : label, networkId))
  }

  const sized = sizeInBaseUnits(side === "buy" ? amountUsd : amountUsd / price, sellDecimals)
  if ("problem" in sized) return unavailable(sizingReason(sized.problem, label))

  return {
    kind: "evm",
    input: {
      networkId,
      sellToken,
      buyToken,
      sellAmountBaseUnits: sized.units,
      slippagePercentage: SLIPPAGE_PERCENTAGE,
      idempotencyKey: newIdempotencyKey(),
    },
  }
}

/**
 * Every containment check a Jupiter row must pass before an amount is even
 * scaled: venue, quote asset, both mints, the orientation self-check, and the
 * precision of the token about to be SPENT. Both Solana entry points — the
 * USD ticket and the token-denominated panel — go through this and nothing
 * else, so neither can drift into deriving mints or decimals on its own.
 */
function resolveSolanaLegs(
  row: ModernSpotMarketRow,
  side: "buy" | "sell",
): { inputMint: string; outputMint: string; inputDecimals: number; spentSymbol: string; label: string } | { reason: string } {
  const label = row.symbol ? row.symbol.toUpperCase() : "This market"
  if (row.venue !== "jupiter") return { reason: venueReason(row.venue, label) }

  const quoteSymbol = (row.quote ?? "").toUpperCase()
  if (!quoteSymbol) return { reason: missingQuoteReason(label) }

  const networkId = row.networkId ?? "solana-mainnet-beta"
  // The registry states the buy direction: spend the quote mint for the base.
  const quoteMint = row.inputMint
  const baseMint = row.outputMint
  if (!quoteMint || !baseMint) {
    return { reason: `The market registry didn't include the token mints for ${label}, so we can't build the swap.` }
  }
  const misoriented = orientationProblem(networkId, quoteMint, quoteSymbol, label)
  if (misoriented) return { reason: misoriented }

  const inputMint = side === "buy" ? quoteMint : baseMint
  const outputMint = side === "buy" ? baseMint : quoteMint
  const spentSymbol = side === "buy" ? quoteSymbol : label
  const inputDecimals = side === "buy"
    ? row.quoteDecimals ?? tokenDecimalsFor(networkId, inputMint)
    : row.baseDecimals ?? tokenDecimalsFor(networkId, inputMint)
  if (inputDecimals === undefined) return { reason: precisionReason(spentSymbol, networkId) }

  return { inputMint, outputMint, inputDecimals, spentSymbol, label }
}

/**
 * The same checks, as a yes/no for a screen that wants to refuse BEFORE the
 * user types an amount. `null` means the row is safe to trade on this side.
 */
export function solanaSwapProblem(row: ModernSpotMarketRow, side: "buy" | "sell"): string | null {
  const legs = resolveSolanaLegs(row, side)
  return "reason" in legs ? legs.reason : null
}

/**
 * The token-denominated sibling of `buildSpotOrderPlan`: the caller already
 * holds an amount in whole units of the token being spent (the Jupiter panel's
 * field), so no price and no USD assumption enters — but every containment
 * check is the same one, in the same order, and the conversion is still exact.
 */
export function buildSolanaSwapPlanFromTokenAmount(
  row: ModernSpotMarketRow,
  side: "buy" | "sell",
  amountText: string,
): SpotOrderPlan {
  const legs = resolveSolanaLegs(row, side)
  if ("reason" in legs) return unavailable(legs.reason)

  const amountBaseUnits = toBaseUnits(amountText.trim(), legs.inputDecimals)
  if (amountBaseUnits === null) {
    return unavailable(`Enter a ${legs.spentSymbol} amount with at most ${legs.inputDecimals} decimal places.`)
  }
  if (amountBaseUnits === "0") return unavailable(`Enter a ${legs.spentSymbol} amount above zero.`)

  return solanaPlan(legs, amountBaseUnits)
}

function buildSolanaPlan(row: ModernSpotMarketRow, side: "buy" | "sell", amountUsd: number, price: number): SpotOrderPlan {
  const legs = resolveSolanaLegs(row, side)
  if ("reason" in legs) return unavailable(legs.reason)

  const sized = sizeInBaseUnits(side === "buy" ? amountUsd : amountUsd / price, legs.inputDecimals)
  if ("problem" in sized) return unavailable(sizingReason(sized.problem, legs.label))

  return solanaPlan(legs, sized.units)
}

/**
 * A Solana spot swap, routed through LI.FI rather than Jupiter directly.
 *
 * Jupiter built the transaction on its own side and handed us the result, so
 * its failures arrived as a simulation error against a transaction nobody here
 * had composed — `custom program error: 0x1` with no statement of which token
 * was short. The LI.FI intent route is the one the rest of the product already
 * uses, and it reports an underfunded account as `INSUFFICIENT_FUNDS` instead.
 *
 * Source and destination are the same chain: this is a spot trade, not a
 * bridge. The mints go through verbatim as the sell/buy tokens.
 */
function solanaPlan(
  legs: { inputMint: string; outputMint: string },
  sellAmountBaseUnits: string,
): SpotOrderPlan {
  return {
    kind: "lifi",
    input: {
      sourceNetworkId: "solana-mainnet-beta",
      destinationNetworkId: "solana-mainnet-beta",
      sellToken: legs.inputMint,
      buyToken: legs.outputMint,
      sellAmountBaseUnits,
      slippagePercentage: SLIPPAGE_PERCENTAGE,
      idempotencyKey: newIdempotencyKey(),
    },
  }
}

function venueReason(venue: string | undefined, label: string): string {
  return `${label} trades on ${venue ?? "a venue the registry didn't name"}, which the Worldstreet wallet can't route yet.`
}

function missingQuoteReason(label: string): string {
  return `The market registry didn't say what ${label} is quoted in, so we can't size this order safely.`
}

function precisionReason(token: string, networkId: string): string {
  return `We don't know ${token}'s token precision on ${networkId} yet, and we won't guess it — a wrong guess would send the wrong amount.`
}

function sizingReason(problem: "unusable" | "dust", label: string): string {
  return problem === "dust"
    ? `That amount is too small to place on ${label}.`
    : `We couldn't turn that amount into ${label} units. Try a different size.`
}
