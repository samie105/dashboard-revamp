export type HyperliquidTransferDirection = "toPerps" | "toSpot"

export type HyperliquidTransferRequest = {
  type: "usdClassTransfer"
  amount: number
  toPerp: boolean
  idempotencyKey: string
}

export function parseFundingAmount(value: string): number | null {
  const amount = Number(value.trim())
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function buildHyperliquidTransferRequest(
  direction: HyperliquidTransferDirection,
  amount: string | number,
  idempotencyKey: string,
): HyperliquidTransferRequest {
  const parsed = typeof amount === "number" ? amount : parseFundingAmount(amount)
  if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Transfer amount must be greater than zero")
  }
  if (!idempotencyKey.trim()) throw new Error("Transfer requires an idempotency key")
  return { type: "usdClassTransfer", amount: parsed, toPerp: direction === "toPerps", idempotencyKey }
}

export function exceedsFundingBalance(amount: number | null, available: number | null): boolean {
  return amount !== null && available !== null && amount > available
}
