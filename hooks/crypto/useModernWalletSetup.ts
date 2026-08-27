"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoQueryKeys, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import { createSelfCustodialWallet } from "@/lib/crypto-wallet/wallet-setup"

export function useModernWalletSetup() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId

  const mutation = useMutation({
    mutationFn: async ({ passphrase }: { passphrase: string }) => {
      if (!isCryptoBackendEnabled) throw new Error("The modern crypto wallet flow is disabled")
      if (!userId || !isLoaded || !isSignedIn) throw new Error("Sign in before creating a crypto wallet")
      return createSelfCustodialWallet(userId, { walletPassphrase: passphrase })
    },
    onSuccess: async (result) => {
      if (!userId) return
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.wallet(userId) })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.walletPackage(userId) })
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
