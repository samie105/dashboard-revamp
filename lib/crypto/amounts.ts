import { formatUnits } from "viem"

/** Shape of one entry from GET .../balances (integration guide §8.5). */
export type BalanceEntry = {
  asset: { kind: "native" | "token"; identifier: string }
  amountBaseUnits: string
  decimals: number
  symbol: string
}

/**
 * Base-unit decimal string → display string. BigInt end to end; a JS number
 * would silently corrupt anything past MAX_SAFE_INTEGER (guide §8.5).
 */
export function formatBaseUnits(
  amountBaseUnits: string,
  decimals: number,
  maxFraction = 6,
): string {
  const full = formatUnits(BigInt(amountBaseUnits), decimals)
  const [whole, fraction = ""] = full.split(".")
  const trimmed = fraction.slice(0, maxFraction).replace(/0+$/, "")
  return trimmed ? `${whole}.${trimmed}` : whole
}

/**
 * Validates a user-typed DISPLAY-unit amount (what createTransferIntent
 * expects — guide §8.2). Positive plain decimals only: no exponents, no
 * leading/trailing dot, not zero.
 */
export function isValidDisplayAmount(input: string): boolean {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(input)) return false
  return /[1-9]/.test(input)
}
