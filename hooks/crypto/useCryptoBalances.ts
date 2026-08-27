"use client"

import { useQueries } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { CryptoBalance, CryptoNetwork, CryptoWalletAccount } from "@/lib/crypto-backend"

export type CryptoBalanceResult = CryptoBalance & {
  accountId: string
  networkId: string
  networkName: string
}

function pairs(accounts: CryptoWalletAccount[], networks: CryptoNetwork[]) {
  return accounts.flatMap((account) => networks
    .filter((network) => network.family === account.chainFamily && account.state === "active" && Boolean(account.canonicalAddress))
    .map((network) => ({ account, network })))
}

export function useCryptoBalances(accounts: CryptoWalletAccount[] = [], networks: CryptoNetwork[] = []) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  const accountNetworkPairs = pairs(accounts, networks)
  const queries = useQueries({
    queries: accountNetworkPairs.map(({ account, network }) => ({
      queryKey: cryptoQueryKeys.balance(userId, account.id, network.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => cryptoBackendClient.listBalances(account.id, network.id, [], signal),
      enabled,
      staleTime: 30_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    })),
  })

  const balances: CryptoBalanceResult[] = queries.flatMap((query, index) => {
    const pair = accountNetworkPairs[index]
    if (!pair || !query.data) return []
    return query.data.map((balance) => ({
      ...balance,
      accountId: pair.account.id,
      networkId: pair.network.id,
      networkName: pair.network.name,
    }))
  })

  return {
    balances,
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    isStale: queries.some((query) => query.isStale),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: async () => { await Promise.all(queries.map((query) => query.refetch())) },
  }
}

/** Precision-preserving display formatter. The raw value remains authoritative. */
export function formatCryptoAmount(amountBaseUnits: string, decimals: number, maxFractionDigits = 6) {
  if (!/^\d+$/.test(amountBaseUnits) || decimals < 0) return "0"
  const normalized = amountBaseUnits.replace(/^0+(?=\d)/, "")
  if (decimals === 0) return normalized
  const padded = normalized.padStart(decimals + 1, "0")
  const whole = padded.slice(0, -decimals) || "0"
  const fraction = padded.slice(-decimals).replace(/0+$/, "").slice(0, maxFractionDigits)
  return fraction ? `${whole}.${fraction}` : whole
}
