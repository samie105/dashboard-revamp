/**
 * The Sell ticket's 25% / 50% / 75% / Max chips (the redesign preview's
 * quick amounts), from the wallet's own balance snapshot.
 *
 * Display help only: a chip fills the amount field with a figure the user
 * could have typed, and the flow validates it as usual. When the balance
 * can't be pinned to exactly one holding (no match, or more than one asset
 * with that symbol on that network), there are no chips rather than a guess.
 */

export type BalanceLike = { networkId: string; symbol: string; amountBaseUnits: string; decimals: number }

/** The one balance of `symbol` on `networkId`, or null when there's none or it's ambiguous. */
export function sellableBalance<T extends BalanceLike>(balances: readonly T[], networkId: string, symbol: string): T | null {
  const matches = balances.filter((b) => b.networkId === networkId && b.symbol.toUpperCase() === symbol.toUpperCase())
  return matches.length === 1 ? matches[0] : null
}

/**
 * `pct` percent of a base-unit amount as a decimal string, rounded DOWN to
 * `maxFractionDigits` so a chip never asks for more than is held. Empty
 * string for zero or malformed input.
 */
export function percentOfBalance(amountBaseUnits: string, decimals: number, pct: number, maxFractionDigits: number): string {
  if (!/^\d+$/.test(amountBaseUnits) || !Number.isInteger(decimals) || decimals < 0) return ""
  if (!Number.isInteger(pct) || pct <= 0 || pct > 100) return ""
  const part = (BigInt(amountBaseUnits) * BigInt(pct)) / BigInt(100)
  if (part === BigInt(0)) return ""
  const digits = part.toString().padStart(decimals + 1, "0")
  const whole = decimals === 0 ? digits : digits.slice(0, -decimals)
  const fraction = decimals === 0 ? "" : digits.slice(-decimals).slice(0, maxFractionDigits).replace(/0+$/, "")
  if (whole === "0" && !fraction) return ""
  return fraction ? `${whole}.${fraction}` : whole
}

export const SELL_CHIPS = [25, 50, 75, 100] as const
