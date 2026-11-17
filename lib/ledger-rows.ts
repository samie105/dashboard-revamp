/**
 * A ledger record, described for a human.
 *
 * One record shape has to serve two very different rows — a transfer ("Sent
 * 0.0057 SOL") and a swap ("Bought 0.44 TRUMP") — and the two carry their
 * amount differently: a transfer's `summary.amount` is already a decimal in
 * whole units, a swap's is BASE units of the token received. Reading one as
 * the other is off by nine or eighteen orders of magnitude, so the two cases
 * are separated here, once, rather than in each card that renders them.
 *
 * Tokens are named through lib/token-resolver.ts (native coin, spot
 * registry, then the user's own wallet balances), so a token WorldStreet
 * doesn't list still gets its real symbol, logo and precision when the user
 * holds it.
 *
 * A swap's side is read from what changed hands, not from whether the
 * registry lists the token received: paying with a stablecoin or the native
 * coin for something else is a buy of that something; receiving the more
 * money-like token is a sale. The old rule ("a buy only if the received token
 * is listed") turned every buy of an unlisted token into a "Sold" row.
 */

import { formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"
import type { SpotRegistry } from "@/hooks/useSpotRegistry"
import { MONEY_RANK, cleanSymbol, resolveToken, shortAddress, tokenLabel, type ResolvedToken, type WalletTokens } from "@/lib/token-resolver"
import type { CryptoTransactionRecord } from "@/lib/crypto-backend"

export type SwapSide = "buy" | "sell" | "swap"

export type LedgerRow = {
  id: string
  /** What kind of movement this was — the two render differently. */
  kind: "trade" | "transfer"
  /** "Bought", "Sold", "Swapped", "Sent", "Received", "Moved". */
  label: string
  /** Which way the money went, for colour. */
  direction: "in" | "out" | "neutral"
  /** Settlement status, straight from the ledger. */
  status: string
  networkId: string
  txHash: string
  createdAt: string | null
  /** The token this row is about — a symbol where we know one, else its short address. */
  symbol: string
  icon: string | null
  /** Formatted amount, or null when we cannot state one honestly. */
  amountText: string | null
  /** The same amount as a number (of `unit`), or null alongside amountText. */
  amount: number | null
  /** What `amount` is counted in. */
  unit: string
  /** USD value, where it can be established. */
  valueUsd: number | null
  /** The token the row is about, with everything we could resolve. */
  token: ResolvedToken
  /** Swaps only: which way, and both legs. Only the received leg has an amount on record. */
  side?: SwapSide
  paid?: ResolvedToken
  received?: ResolvedToken
}

const SWAP_ACTIONS = new Set(["spot-swap", "jupiter-swap"])

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null
}

// Bitcoin's genesis block; no real movement predates it. A backend that
// reports an unset time as epoch 0 would otherwise render as "20748d ago".
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2009, 0, 3)

function plausibleTime(value: unknown): string | null {
  const text = str(value)
  if (!text) return null
  const ms = Date.parse(text)
  return Number.isFinite(ms) && ms >= EARLIEST_PLAUSIBLE_MS ? text : null
}

function amountWithUnit(amount: number, unit: string): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ""}`
}

/** USD for an amount of a resolved token: a dollar per stablecoin, else its market price. */
function usdOf(amount: number, t: ResolvedToken): number | null {
  if (t.role === "stable") return amount
  return t.price != null && t.price > 0 ? amount * t.price : null
}

/**
 * Describe one ledger record, or `null` if it is not a movement we can render.
 *
 * `registry` supplies symbols, icons and — critically — token precision;
 * `wallet` (optional) adds what the balance feed knows about held tokens the
 * registry doesn't list. A record whose precision we cannot establish reports
 * a null amount rather than a number scaled by a guess.
 */
export function describeLedgerRecord(
  record: CryptoTransactionRecord,
  registry: SpotRegistry,
  wallet?: WalletTokens,
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
    createdAt: plausibleTime(record.submittedAt) ?? plausibleTime(record.createdAt),
  }

  if (SWAP_ACTIONS.has(action)) {
    const buyToken = str(summary.buyToken) ?? str(asRecord(summary.asset).identifier)
    const sellToken = str(summary.sellToken)
    const destination = str(summary.destinationNetworkId) ?? networkId
    const received = resolveToken(destination, buyToken, registry, wallet)
    const paid = resolveToken(networkId, sellToken, registry, wallet)

    const rankIn = MONEY_RANK[received.role]
    const rankOut = MONEY_RANK[paid.role]
    const side: SwapSide = rankIn < rankOut ? "buy" : rankIn > rankOut ? "sell" : "swap"
    const subject = side === "sell" ? paid : received

    // Precision belongs to the token RECEIVED: the base on a buy, the quote on a sell.
    const unit = tokenLabel(received)
    const rawAmount = str(summary.amount)
    const size = received.decimals !== undefined && rawAmount ? Number(formatCryptoAmount(rawAmount, received.decimals, 9)) : null
    const known = size !== null && Number.isFinite(size)

    return {
      ...base,
      kind: "trade",
      label: side === "buy" ? "Bought" : side === "sell" ? "Sold" : "Swapped",
      direction: side === "buy" ? "in" : side === "sell" ? "out" : "neutral",
      symbol: tokenLabel(subject),
      icon: subject.icon,
      amountText: known ? amountWithUnit(size, unit) : null,
      amount: known ? size : null,
      unit,
      valueUsd: known ? usdOf(size, received) : null,
      token: subject,
      side,
      paid,
      received,
    }
  }

  if (action === "transfer") {
    const asset = asRecord(summary.asset)
    const identifier = str(asset.identifier)
    const isNative = str(asset.kind) === "native"
    const resolved = isNative
      ? { ...resolveToken(networkId, null, registry, wallet), symbol: identifier, role: "native" as const }
      : resolveToken(networkId, identifier, registry, wallet)
    /* The backend may name a token by its own symbol, by its mint (Solana
       deposits do), or by a placeholder: only a real symbol is used, then
       whatever the resolver found, then the short address. */
    const token: ResolvedToken = { ...resolved, symbol: isNative ? identifier : (resolved.symbol ?? cleanSymbol(asset.symbol)) }
    const symbol = isNative ? (identifier ?? "") : tokenLabel(token)

    /* A transfer's amount is ALREADY a decimal in whole units — it is not
       base units like a swap's, and dividing it again would report a rounding
       error as a balance. */
    const amount = Number(str(summary.amount) ?? "")
    const known = Number.isFinite(amount) && str(summary.amount) !== null

    // Our own address on both sides means moving between our accounts.
    const from = str(record.fromAddress)
    const to = str(record.toAddress)
    const internal = record.direction === "internal" || Boolean(from && to && from === to)
    const incoming = record.direction === "incoming"
    return {
      ...base,
      kind: "transfer",
      label: internal ? "Moved" : incoming ? "Received" : "Sent",
      direction: internal ? "neutral" : incoming ? "in" : "out",
      symbol,
      icon: token.icon,
      amountText: known ? amountWithUnit(amount, symbol) : null,
      amount: known ? amount : null,
      unit: symbol,
      valueUsd: known && token.listed ? usdOf(amount, token) : null,
      token,
    }
  }

  return null
}

export { shortAddress }
