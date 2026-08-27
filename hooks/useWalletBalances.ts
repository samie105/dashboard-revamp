"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  CryptoBackendError,
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"

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

async function fetchCryptoBalances(signal?: AbortSignal): Promise<TokenBalance[]> {
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

  const networks = await cryptoBackendClient.listNetworks(signal)
  const activeAccounts = wallet.accounts.filter((account) => account.state === "active")
  const requests = activeAccounts.flatMap((account) =>
    networks
      .filter((network) => network.family === account.chainFamily && network.capabilities.balance !== false)
      .map(async (network) => ({
        network,
        balances: await cryptoBackendClient.listBalances(account.id, network.id, [], signal),
      })),
  )
  const results = await Promise.all(requests)

  return results.flatMap(({ network, balances }) =>
    balances.map((balance) => ({
      symbol: balance.symbol,
      name: balance.symbol,
      chain: network.id,
      balance: formatBalance(balance.amountBaseUnits, balance.decimals),
      contractAddress: balance.asset.kind === "token" ? balance.asset.identifier : undefined,
      isNative: balance.asset.kind === "native",
      rawAmountBaseUnits: balance.amountBaseUnits,
      decimals: balance.decimals,
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
 * Reads balances through TanStack Query when the new backend flag is enabled.
 * The legacy endpoint remains the default until phases 3–7 complete.
 */
export function useWalletBalances(refreshInterval = 30_000): UseWalletBalancesReturn {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  const backendEnabled = isCryptoBackendEnabled && isLoaded && isSignedIn

  const query = useQuery({
    queryKey: backendEnabled
      ? cryptoQueryKeys.balances(userId)
      : ["legacy", "wallet-balances", userId, refreshInterval],
    queryFn: ({ signal }) => (backendEnabled ? fetchCryptoBalances(signal) : fetchLegacyBalances(signal)),
    enabled: isLoaded && isSignedIn,
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  })

  return {
    balances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : query.error ? "Failed to fetch balances" : null,
    refetch: async () => {
      await query.refetch()
    },
  }
}
