/**
 * The backend's own numbers for a futures order (spec §9), plus the one
 * reduce-only check the account data can honestly answer.
 *
 * The law here is RENDER, NEVER COMPUTE. A liquidation price is a function of
 * the venue's margin tiers, the account's other positions, its maintenance
 * margin and its unrealised PnL — none of which this client holds. Working one
 * out here would produce a figure that looks authoritative and is wrong exactly
 * when it matters most. So this module only READS what the backend put in the
 * intent summary; when the backend said nothing, it says nothing, and the
 * caller shows `LIQUIDATION_WARNING` in place of a number it does not have.
 *
 * `HyperliquidIntent.summary` is typed `Record<string, unknown>` by the
 * contract, and only `size`/`price` are load-bearing in the client today. So
 * every figure is looked up under the spellings the payload has been seen to
 * use, and validated as a finite, non-negative number before it is trusted —
 * an unrecognised or malformed value reads as ABSENT (and therefore warns)
 * rather than as zero.
 */

/**
 * Verbatim, by contract. Shown whenever the backend did not hand us both an
 * estimated fee and a liquidation price for the order about to be signed.
 */
export const LIQUIDATION_WARNING =
  "Check your liquidation price before confirming — high leverage can be liquidated by small moves."

export type FuturesOrderFigures = {
  /** Contract size the backend priced the order at. */
  size: number | null
  /** Price the backend priced the order at. */
  price: number | null
  /** Estimated fee, in USD, as the backend stated it. */
  feeUsd: number | null
  /** Liquidation price, as the backend stated it. NEVER derived here. */
  liquidationPrice: number | null
  /** True unless the backend supplied BOTH a fee and a liquidation price. */
  needsLiquidationWarning: boolean
}

/**
 * Spellings each figure has been observed under, most specific first. The
 * order is the precedence: the first key actually present wins, so a payload
 * carrying both a scoped and a bare name is read at its scoped name.
 */
const SIZE_KEYS = ["size", "sz", "quantity"] as const
const PRICE_KEYS = ["price", "px", "limitPrice", "executionPrice"] as const
const FEE_KEYS = ["estimatedFeeUsd", "estimatedFee", "feeUsd", "fee"] as const
const LIQUIDATION_KEYS = ["liquidationPrice", "estimatedLiquidationPrice", "liquidationPx", "liqPrice"] as const

/**
 * A finite, non-negative number, or `null`. Numeric strings are accepted
 * because the venue reports its own figures as strings; everything else —
 * `null`, `""`, `"n/a"`, booleans, objects, negatives, NaN — is absent.
 */
function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * The first of `keys` present in `source` as a usable number. A key that is
 * present but unusable is skipped rather than ending the search — a `fee: null`
 * beside an `estimatedFeeUsd: 0.04` must not blank the fee.
 */
export function readSummaryNumber(
  source: Record<string, unknown> | undefined | null,
  keys: readonly string[],
): number | null {
  if (!source) return null
  for (const key of keys) {
    const parsed = finiteNumber(source[key])
    if (parsed !== null) return parsed
  }
  return null
}

/** Everything the review screen may state about an order, straight from the backend. */
export function readFuturesOrderFigures(
  summary: Record<string, unknown> | undefined | null,
): FuturesOrderFigures {
  const feeUsd = readSummaryNumber(summary, FEE_KEYS)
  const liquidationPrice = readSummaryNumber(summary, LIQUIDATION_KEYS)
  return {
    size: readSummaryNumber(summary, SIZE_KEYS),
    price: readSummaryNumber(summary, PRICE_KEYS),
    feeUsd,
    liquidationPrice,
    needsLiquidationWarning: feeUsd === null || liquidationPrice === null,
  }
}

/**
 * Why a reduce-only order cannot be placed, or `null` when it can. Both cases
 * are answerable from the account the workspace already polls: a reduce-only
 * order with nothing to reduce, and one pointed the wrong way (a buy against a
 * long adds exposure — the exact opposite of what the toggle promises). The
 * venue would reject either; saying so before the signature is kinder and
 * costs nothing.
 *
 * Size is deliberately NOT checked against the position: the venue clamps an
 * oversized reduce-only order down to the position, which is the behaviour a
 * user wants, not an error.
 */
export function reduceOnlyProblem(
  position: { side: "long" | "short"; absSize: number } | undefined | null,
  symbol: string,
  side: "buy" | "sell",
): string | null {
  if (!position || !(position.absSize > 0)) {
    return `You have no open ${symbol} position to reduce.`
  }
  if (position.side === "long" && side === "buy") {
    return `Reduce-only is on, so your long ${symbol} position can only be reduced by selling.`
  }
  if (position.side === "short" && side === "sell") {
    return `Reduce-only is on, so your short ${symbol} position can only be reduced by buying.`
  }
  return null
}
