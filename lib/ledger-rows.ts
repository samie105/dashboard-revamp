/**
 * A ledger record, described for a human.
 *
 * One record shape has to serve two very different rows — a transfer ("Sent
 * 0.0057 SOL") and a swap ("Bought 0.44 TRUMP") — and the two carry their
 * amount differently: a transfer's `summary.amount` is already a decimal in
 * whole units, a swap's is BASE units of the token received. Reading one as
 * the other is off by nine or eighteen orders of magnitude, so the two cases
 * are separated here, once, rather than in each card that renders them.
 */

import { formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import { addressKey, type SpotRegistry } from "@/hooks/useSpotRegistry"
import { nativeTokenFor } from "@/lib/native-token"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"

export type LedgerRow = {
  id: string
  /** What kind of movement this was — the two render differently. */
  kind: "trade" | "transfer"
  /** "Bought", "Sold", "Sent", "Received". */
  label: string
  /** Which way the money went, for colour. */
  direction: "in" | "out" | "neutral"
  /** Settlement status, straight from the ledger. */
  status: string
  networkId: string
  txHash: string
  createdAt: string | null
  /** The token this row is about — a symbol where we know one. */
  symbol: string
  icon: string | null
  /** Formatted amount, or null when we cannot state one honestly. */
  amountText: string | null
  /** USD value, where it can be established. */
  valueUsd: number | null
}

const SWAP_ACTIONS = new Set(["spot-swap", "jupiter-swap"])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

function shortAddress(address: string | null): string {
  if (!address) return "Unknown"
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

function amountWithUnit(amount: number, unit: string): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ""}`
}

/**
 * Describe one ledger record, or `null` if it is not a movement we can render.
 *
 * `registry` supplies symbols, icons and — critically — token precision. A
 * record whose precision we cannot establish reports a null amount rather
 * than a number scaled by a guess.
 */
export function describeLedgerRecord(
  record: CryptoTransactionRecord,
  registry: SpotRegistry,
): LedgerRow | null {
  const summary = asRecord(record.summary)
  const action = str(summary.action)
  if (!action) return null

  const networkId = String(record.networkId ?? "")
  const base = {
    id: record.id,
    status: String(record.status ?? "unknown"),
    networkId,
    txHash: String(record.txHash ?? ""),
    createdAt: str(record.submittedAt) ?? str(record.createdAt),
  }

  const lookup = (address: string | null) => {
    const native = nativeTokenFor(networkId, address)
    const key = native?.wrapped ?? address
    const market = key ? registry.byAddress.get(addressKey(networkId, key)) : undefined
    return { native, market }
  }

  if (SWAP_ACTIONS.has(action)) {
    const buyToken = str(summary.buyToken) ?? str(asRecord(summary.asset).identifier)
    const sellToken = str(summary.sellToken)
    const bought = lookup(buyToken)
    const sold = bought.market || bought.native ? { native: null, market: undefined } : lookup(sellToken)

    const isBuy = Boolean(bought.market || bought.native)
    const subject = isBuy ? bought : sold
    const market = bought.market ?? sold.market
    const symbol = subject.native?.symbol ?? market?.symbol ?? shortAddress(buyToken)

    // Precision belongs to the token RECEIVED, which is the base on a buy and
    // the quote on a sell.
    const decimals = bought.native?.decimals ?? (isBuy ? market?.baseDecimals : market?.quoteDecimals)
    const unit = bought.native?.symbol ?? (isBuy ? market?.symbol : market?.quote) ?? ""
    const rawAmount = str(summary.amount)

    if (decimals === undefined || !rawAmount) {
      return { ...base, kind: "trade", label: isBuy ? "Bought" : "Sold", direction: isBuy ? "in" : "out", symbol, icon: market?.icon ?? null, amountText: null, valueUsd: null }
    }
    const size = Number(formatCryptoAmount(rawAmount, decimals, 9))
    // A sell's proceeds are already dollars — every quote is a stablecoin.
    const valueUsd = isBuy ? (market && market.price > 0 ? size * market.price : null) : size
    return {
      ...base,
      kind: "trade",
      label: isBuy ? "Bought" : "Sold",
      direction: isBuy ? "in" : "out",
      symbol,
      icon: market?.icon ?? null,
      amountText: amountWithUnit(size, unit),
      valueUsd,
    }
  }

  if (action === "transfer") {
    const asset = asRecord(summary.asset)
    const identifier = str(asset.identifier)
    const isNative = str(asset.kind) === "native"
    const { market } = lookup(identifier)
    // A native transfer names its own asset ("SOL"); a token transfer carries
    // a mint, which the registry turns into a symbol when it knows one.
    const symbol = isNative ? (identifier ?? "") : (market?.symbol ?? shortAddress(identifier))

    /* A transfer's amount is ALREADY a decimal in whole units — it is not
       base units like a swap's, and dividing it again would report a rounding
       error as a balance. */
    const amount = Number(str(summary.amount) ?? "")
    const amountText = Number.isFinite(amount) ? amountWithUnit(amount, symbol) : null

    // Our own address on both sides means moving between our accounts.
    const from = str(record.fromAddress)
    const to = str(record.toAddress)
    const internal = Boolean(from && to && from === to)
    return {
      ...base,
      kind: "transfer",
      label: internal ? "Moved" : "Sent",
      direction: internal ? "neutral" : "out",
      symbol,
      icon: market?.icon ?? null,
      amountText,
      valueUsd:
        market && market.price > 0 && Number.isFinite(amount) ? amount * market.price : null,
    }
  }

  return null
}
