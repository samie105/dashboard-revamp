import type { CryptoBalance, CryptoBalanceSnapshot, CryptoBalanceSnapshotItem } from "@/lib/crypto-backend"

export type CryptoBalanceResult = CryptoBalance & {
  accountId: string
  networkId: string
  networkName: string
}

/**
 * Flattens a balance snapshot's per-account `results` into the flat
 * `CryptoBalanceResult[]` shape consumers render. Treats an incomplete
 * payload (missing/non-array `results`) as an empty snapshot instead of
 * crashing the page while a fresh aggregate request is in flight.
 */
export function flattenSnapshot(snapshot: CryptoBalanceSnapshot | null | undefined): CryptoBalanceResult[] {
  const results = Array.isArray(snapshot?.results) ? snapshot.results : []
  return results.flatMap((result) => result.balances.map((balance) => ({
    ...balance,
    accountId: result.accountId,
    networkId: result.networkId,
    networkName: result.networkName,
  })))
}

/** Per-account results whose provider read failed, reported separately from `balances`. */
export function unavailableNetworksOf(snapshot: CryptoBalanceSnapshot | null | undefined): CryptoBalanceSnapshotItem[] {
  const results = Array.isArray(snapshot?.results) ? snapshot.results : []
  return results.filter((result) => result.status === "unavailable")
}
