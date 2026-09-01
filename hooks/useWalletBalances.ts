"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { useWalletMode } from "@/components/wallet-mode-provider"
import {
  CryptoBackendError,
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { modernDataEnabled } from "@/lib/wallet-mode"

export interface TokenBalance {
  symbol: string
  name: string
  chain: string
  balance: number
  contractAddress?: string
  isNative: boolean
  /** Exact backend value, retained for future precision-safe formatting. */
  rawAmountBaseUnits?: string
  decimals?: number
  logo?: string
  networkName?: string
  accountId?: string
}

interface UseWalletBalancesReturn {
  balances: TokenBalance[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

function formatBalance(amountBaseUnits: string, decimals: number) {
  const amount = Number(amountBaseUnits) / 10 ** decimals
  return Number.isFinite(amount) ? amount : 0
}

async function fetchCryptoBalances(signal?: AbortSignal, forceRefresh = false): Promise<TokenBalance[]> {
  let wallet
  try {
    wallet = await cryptoBackendClient.getWallet(signal)
  } catch (error) {
    // Wallet creation is phase 3. Until then, a signed-in user may validly
    // have no crypto wallet yet; render an empty balance list instead of an
    // alarming dashboard error.
    if (error instanceof CryptoBackendError && error.status === 404) return []
    throw error
  }

  const snapshot = await cryptoBackendClient.listBalanceSnapshot(forceRefresh, signal)

  return snapshot.results.flatMap(({ networkId, networkName, accountId, balances }) =>
    balances.map((balance) => ({
      symbol: balance.symbol,
      name: balance.name || balance.symbol,
      chain: networkId,
      balance: formatBalance(balance.amountBaseUnits, balance.decimals),
      contractAddress: balance.asset.kind === "token" ? balance.asset.identifier : undefined,
      isNative: balance.asset.kind === "native",
      rawAmountBaseUnits: balance.amountBaseUnits,
      decimals: balance.decimals,
      logo: balance.logo,
      networkName,
      accountId,
    })),
  )
}

async function fetchLegacyBalances(signal?: AbortSignal): Promise<TokenBalance[]> {
  const response = await fetch("/api/wallet/balances", { credentials: "include", signal })
  const payload = (await response.json().catch(() => ({}))) as {
    balances?: TokenBalance[]
    data?: { balances?: TokenBalance[] }
    error?: string
  }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
  return payload.balances ?? payload.data?.balances ?? []
}

/**
 * Reads balances through TanStack Query when the crypto backend is enabled
 * AND the user has actually selected the modern wallet mode (spec §1, §5).
 * The legacy endpoint serves legacy-mode users even once the modern backend
 * flag is on.
 */
export function useWalletBalances(refreshInterval = 0): UseWalletBalancesReturn {
  const { user, isLoaded, isSignedIn } = useAuth()
  const { mode } = useWalletMode()
  const userId = user?.userId ?? "anonymous"
  const backendEnabled =
    modernDataEnabled({ modernEnabled: isCryptoBackendEnabled, mode }) && isLoaded && isSignedIn
  const queryClient = useQueryClient()
  const queryKey = backendEnabled
    ? cryptoQueryKeys.balances(userId)
    : ["legacy", "wallet-balances", userId, refreshInterval]

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => (backendEnabled ? fetchCryptoBalances(signal) : fetchLegacyBalances(signal)),
    enabled: isLoaded && isSignedIn,
    staleTime: backendEnabled ? 5 * 60_000 : 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: backendEnabled ? false : (refreshInterval > 0 ? refreshInterval : false),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  })

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? "Failed to fetch balances" : null,
    refetch: async () => {
      if (backendEnabled) {
        const fresh = await fetchCryptoBalances(undefined, true)
        queryClient.setQueryData(queryKey, fresh)
        return
      }
      await query.refetch()
    },
  }
}
