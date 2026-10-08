/**
 * Ledger records → the rows the swap history lists.
 *
 * Moved VERBATIM out of SwapClient's history card (components/swap/
 * swap-client.tsx) so the redesigned swap page and the old card read swaps
 * the same way: only spot-swap / jupiter-swap records, a symbol on both sides
 * (the static asset list, then the spot registry, then a shortened address),
 * and the ledger's own formatted amount.
 */

import type { CryptoTransactionRecord } from "@/lib/crypto-backend"
import { addressKey, type useSpotRegistry } from "@/hooks/useSpotRegistry"
import { describeLedgerRecord } from "@/lib/ledger-rows"
import { SWAP_ASSETS, fromBaseUnits } from "./swap-model"

export interface SwapTx {
  id: string
  /** Always present on a unified row — the asset the movement is denominated
   *  in. The from/to pair below is swap-specific and often missing. */
  token?: string
  fromToken?: string
  toToken?: string
  amount: number
  amountText?: string
  toAmount?: string
  fromChain?: string
  toChain?: string
  status: string
  txHash?: string
  createdAt: string
}

/* The sentinels a chain uses to mean "the native coin". SWAP_ASSETS stores
   natives with the literal address "native", so a ledger row carrying one of
   these matched nothing and the UI printed the sentinel — which is how
   "USDC → 0x0000000000000000000000000000000000000000" ended up on screen
   where "USDC → ETH" belongs. */
const NATIVE_SENTINELS = new Set([
  "native",
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  "so11111111111111111111111111111111111111112",
  "11111111111111111111111111111111",
])

function historicalSwapAsset(networkId: string | undefined, identifier: string | undefined) {
  if (!networkId || !identifier) return undefined
  const normalized = identifier.toLowerCase()
  if (NATIVE_SENTINELS.has(normalized)) {
    return SWAP_ASSETS.find((asset) => asset.networkId === networkId && asset.kind === "native")
  }
  return SWAP_ASSETS.find((asset) => asset.networkId === networkId && asset.address.toLowerCase() === normalized)
}

/** Last resort for an identifier nothing could name. A 42-character contract
 *  address in a row that is 30 characters wide is not information, it is a
 *  layout accident — so it is shortened the way every other address in the
 *  app is. */
function shortIdentifier(value: string): string {
  return value.length <= 13 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`
}


export function swapRowsFrom(records: CryptoTransactionRecord[], registry: ReturnType<typeof useSpotRegistry>): SwapTx[] {
  return records.flatMap((record) => {
    const summary = record.summary ?? {}
    if (summary.action !== "spot-swap" && summary.action !== "jupiter-swap") return []
    const asset = summary.asset && typeof summary.asset === "object" ? summary.asset as Record<string, unknown> : {}
    const text = (value: unknown) => typeof value === "string" && value ? value : undefined
    const described = describeLedgerRecord(record, registry)
    const buyAsset = historicalSwapAsset(record.networkId, text(summary.buyToken) ?? text(asset.identifier))
    const sellAsset = historicalSwapAsset(record.networkId, text(summary.sellToken))

    /* Name a token, or say as little as possible about it.
       The static SWAP_ASSETS list holds thirteen entries; the registry holds
       the whole tradable set and is ALREADY loaded on this card — it was just
       never consulted here, so every swap of anything outside those thirteen
       rendered its contract address. Order: the static list, then the
       registry, then a shortened address. */
    const nameOf = (identifier: string | undefined, known: { symbol: string } | undefined) => {
      if (known) return known.symbol
      if (!identifier) return undefined
      if (record.networkId) {
        const row = registry.byAddress.get(addressKey(record.networkId, identifier))
        if (row?.symbol) return row.symbol
      }
      return shortIdentifier(identifier)
    }

    const amount = Number(summary.amount ?? 0)
    return [{
      id: record.id,
      token: nameOf(text(summary.buyToken) ?? text(asset.identifier), buyAsset) ?? text(asset.symbol),
      fromToken: nameOf(text(summary.sellToken), sellAsset),
      toToken: nameOf(text(summary.buyToken), buyAsset),
      amount: Number.isFinite(amount) ? amount : 0,
      amountText: described?.amountText
        ?? (buyAsset ? `${fromBaseUnits(text(summary.amount), buyAsset.decimals)?.toLocaleString(undefined, { maximumFractionDigits: 6 }) ?? "Amount unavailable"} ${buyAsset.symbol}` : undefined),
      // `summary.amount` is the received token's base-unit amount. The
      // precision-aware ledger description already formats it; showing the
      // raw value here would make a small swap look like millions of tokens.
      toAmount: undefined,
      fromChain: record.networkId,
      toChain: record.networkId,
      status: record.status === "confirmed" ? "completed" : record.status,
      createdAt: record.submittedAt ?? record.createdAt ?? new Date().toISOString(),
    }]
  })
}
