import type { QueryClient } from "@tanstack/react-query"

import { cryptoQueryKeys } from "@/lib/crypto-backend"

/**
 * Refetch every wallet balance view after fiat money lands in the wallet
 * (guide §11 line 961, §13 lines 1177-1178).
 */
export function refreshWalletBalances(queryClient: QueryClient, userId: string) {
  void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
  void queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
  void queryClient.invalidateQueries({ queryKey: ["crypto", "balance", userId] })
}
