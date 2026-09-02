/**
 * One row per asset, instead of one row per asset per network.
 *
 * The single most confusing thing on the wallet for someone new is seeing
 * their dollars three times — `USDC / Ethereum`, `USDC / Arbitrum`,
 * `USDC / Solana` — because to them USDC is not three things, it is money.
 * Simple mode sums those into one row and says how many places it sits in;
 * Pro keeps the per-network truth, which is the truth a sender needs.
 *
 * Amounts are summed in BASE UNITS as BigInt, never as formatted decimals
 * parsed back to floats. The same symbol can arrive with different
 * `decimals` from different networks (6 on one chain, 18 on another), so
 * every member is first rescaled to the group's finest precision and only
 * then added. Doing it the lazy way loses the tail of an 18-decimal holding
 * the moment a 6-decimal one joins the group.
 */

import { formatCryptoAmount } from "@/hooks/crypto/useCryptoBalances"

/** What grouping needs from a balance row. A superset is fine — the wallet
 *  passes its own richer row and reads the group back. */
export type GroupableBalance = {
  symbol: string
  amountBaseUnits: string
  decimals: number
  networkId: string
  networkName: string
  logo?: string
  /** USD value, or null when nothing could price it. */
  value: number | null
}

export type GroupedBalance = {
  /** As the backend spelled it on the first member seen. */
  symbol: string
  /** The whole holding, summed across networks, as a decimal string. */
  amount: string
  /** Summed USD across the members that priced; null when none did. */
  value: number | null
  /** How many networks this asset sits on. */
  placeCount: number
  /** The network's name when there is exactly one; null when there are more
   *  — a single row cannot honestly name three places. */
  networkName: string | null
  /** The biggest member's network, so a per-row Deposit opens somewhere real. */
  networkId: string
  logo?: string
  /** Members the price feed could not value. Kept so the page can go on
   *  footnoting "some assets have no live price" rather than quietly
   *  under-reporting a group. */
  unpricedCount: number
}

/* `BigInt(0)` rather than the `0n` literal throughout: this project compiles
   to ES2017, where the literal syntax is a type error even though the runtime
   has BigInt. Raising the whole app's target is not this feature's call. */
const ZERO = BigInt(0)
const TEN = BigInt(10)

/** Rescales `units` from `from` decimals up to `to` decimals. */
function rescale(units: bigint, from: number, to: number): bigint {
  if (to === from) return units
  return units * TEN ** BigInt(to - from)
}

export function groupBalancesBySymbol(balances: readonly GroupableBalance[]): GroupedBalance[] {
  type Bucket = {
    symbol: string
    /** Running total, carried at `scale` decimals. */
    units: bigint
    scale: number
    value: number | null
    networks: Set<string>
    networkName: string | null
    /** The network of the largest member seen so far, and its value. */
    topNetworkId: string
    topValue: number
    logo?: string
    unpricedCount: number
  }

  const buckets = new Map<string, Bucket>()

  for (const balance of balances) {
    const key = (balance.symbol ?? "").toUpperCase()
    // A row with no symbol has nothing to group by and nothing to label a
    // group with; passing it through would produce an unnamed row.
    if (!key) continue

    const decimals = Number.isInteger(balance.decimals) && balance.decimals >= 0 ? balance.decimals : 0
    // Reuse the app's own parser rather than a second opinion on what a
    // valid amount is: anything it rejects contributes zero, which keeps a
    // malformed member from poisoning the whole group with NaN.
    const parseable = /^\d+$/.test(balance.amountBaseUnits ?? "")
    const units = parseable ? BigInt(balance.amountBaseUnits) : ZERO

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        symbol: balance.symbol,
        units: ZERO,
        scale: decimals,
        value: null,
        networks: new Set(),
        networkName: balance.networkName ?? null,
        topNetworkId: balance.networkId,
        topValue: -Infinity,
        logo: balance.logo,
        unpricedCount: 0,
      }
      buckets.set(key, bucket)
    }

    // Carry the running total at the finest precision any member has used.
    if (decimals > bucket.scale) {
      bucket.units = rescale(bucket.units, bucket.scale, decimals)
      bucket.scale = decimals
    }
    bucket.units += rescale(units, decimals, bucket.scale)

    if (balance.value === null || !Number.isFinite(balance.value)) {
      bucket.unpricedCount += 1
    } else {
      bucket.value = (bucket.value ?? 0) + balance.value
      if (balance.value > bucket.topValue) {
        bucket.topValue = balance.value
        bucket.topNetworkId = balance.networkId
      }
    }

    bucket.networks.add(balance.networkId)
    if (bucket.networks.size > 1) bucket.networkName = null
    if (!bucket.logo && balance.logo) bucket.logo = balance.logo
  }

  const groups: GroupedBalance[] = [...buckets.values()].map((bucket) => ({
    symbol: bucket.symbol,
    // Formatted at the group's own scale, so the sum reads the way each
    // member did — and with the same rounding the per-network rows use.
    amount: formatCryptoAmount(bucket.units.toString(), bucket.scale),
    value: bucket.value,
    placeCount: bucket.networks.size,
    networkName: bucket.networks.size === 1 ? bucket.networkName : null,
    networkId: bucket.topNetworkId,
    logo: bucket.logo,
    unpricedCount: bucket.unpricedCount,
  }))

  // Biggest first, unpriced last — the same order the per-network list uses,
  // so switching modes reorders nothing a reader was tracking.
  groups.sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
  return groups
}
