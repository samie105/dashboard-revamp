"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { createSelfCustodialWallet, type WalletSetupStage } from "@/lib/crypto-wallet/wallet-setup"

export function useModernWalletSetup() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId

  const mutation = useMutation({
    // `onStage` rides along with the passphrase rather than living on the hook:
    // the callback belongs to the screen that's watching THIS attempt, and a
    // retry supplies a fresh one. Optional, so existing callers are unaffected.
    mutationFn: async ({ passphrase, onStage }: { passphrase: string; onStage?: (stage: WalletSetupStage) => void }) => {
      if (!isCryptoBackendEnabled) throw new Error("The modern crypto wallet flow is disabled")
      if (!userId || !isLoaded || !isSignedIn) throw new Error("Sign in before creating a crypto wallet")
      return createSelfCustodialWallet(userId, { walletPassphrase: passphrase, onStage })
    },
    onSuccess: async (result) => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.wallet(userId) })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
      // BOTH balance keys, the way every other call site does it. The wallet
      // page reads `balanceSnapshot`, and that query has already failed with
      // WALLET_NOT_FOUND by the time setup runs — invalidating only `balances`
      // left the snapshot holding that error, so a wallet finished successfully
      // and then sat behind a red "No wallet yet" with no balances until the
      // page was reloaded.
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
      if (!result.existing) await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.networks() })
    },
  })

  return {
    ...mutation,
    createWallet: mutation.mutateAsync,
    isReady: Boolean(isLoaded && isSignedIn && userId),
  }
}
