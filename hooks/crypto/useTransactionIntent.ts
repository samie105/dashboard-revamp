"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionIntent, CryptoWalletPackageDocument } from "@/lib/crypto-backend"
import { signEvmIntent } from "@/lib/crypto-wallet/evm-signing"
import { signSolanaIntent } from "@/lib/crypto-wallet/solana-signing"
import { signSuiIntent } from "@/lib/crypto-wallet/sui-signing"
import { signTonIntent } from "@/lib/crypto-wallet/ton-signing"
import { signTronIntent } from "@/lib/crypto-wallet/tron-signing"

type TransferInput = {
  accountId: string
  networkId: string
  asset: { kind: "native" | "token"; identifier: string }
  to: string
  amount: string
}

export function useTransactionIntent(walletId?: string, packageValue?: CryptoWalletPackageDocument) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const [intentId, setIntentId] = useState<string>()
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  const intentQuery = useQuery({
    queryKey: cryptoQueryKeys.intent(userId, intentId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getIntent(intentId as string, signal),
    enabled: enabled && Boolean(intentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "submitted" || status === "pending" || status === "unknown" ? 5_000 : false
    },
  })

  const create = useMutation({
    mutationFn: (input: TransferInput) => cryptoBackendClient.createTransferIntent({ ...input, idempotencyKey: crypto.randomUUID() }),
    retry: false,
    onSuccess: (intent) => setIntentId(intent.id),
  })

  const simulate = useMutation({
    mutationFn: () => {
      if (!intentId) throw new Error("Create an intent before simulating")
      return cryptoBackendClient.simulateIntent(intentId)
    },
    retry: false,
    onSuccess: (result) => {
      if (!intentId) return
      queryClient.setQueryData<CryptoTransactionIntent>(cryptoQueryKeys.intent(userId, intentId), (current) => current ? {
        ...current,
        validationResult: result.validation,
        simulationResult: result.simulation,
      } : current)
    },
  })

  const submit = useMutation({
    mutationFn: async () => {
      if (!intentId || !intentQuery.data || !walletId || !packageValue) throw new Error("Create an intent and unlock the wallet before signing")
      const intent = intentQuery.data
      const signed = intent.chainFamily === "solana"
        ? await signSolanaIntent(userId, walletId, packageValue, intent, String(intent.accountId))
        : intent.chainFamily === "sui"
          ? await signSuiIntent(userId, walletId, packageValue, intent, String(intent.accountId))
          : intent.chainFamily === "ton"
            ? await signTonIntent(userId, walletId, packageValue, intent, String(intent.accountId))
            : intent.chainFamily === "tron"
              ? await signTronIntent(userId, walletId, packageValue, intent, String(intent.accountId))
              : await signEvmIntent(userId, walletId, packageValue, intent, String(intent.accountId))
      return cryptoBackendClient.submitIntent(intentId, signed)
    },
    retry: false,
    onSuccess: async (record) => {
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
      await queryClient.invalidateQueries({ queryKey: ["crypto", "balance", userId] })
      await queryClient.invalidateQueries({ queryKey: ["crypto", "transactions", userId] })
      if (record.id) await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.transaction(userId, record.id) })
      await intentQuery.refetch()
    },
  })

  const reset = useCallback(() => {
    setIntentId(undefined)
    create.reset()
    simulate.reset()
    submit.reset()
  }, [create, simulate, submit])

  return {
    intent: enabled ? intentQuery.data ?? create.data : undefined,
    intentId,
    isLoading: create.isPending || intentQuery.isLoading,
    isSimulating: simulate.isPending,
    isSubmitting: submit.isPending,
    error: create.error ?? simulate.error ?? submit.error ?? intentQuery.error ?? null,
    createIntent: create.mutateAsync,
    simulateIntent: simulate.mutateAsync,
    submitIntent: submit.mutateAsync,
    reset,
  }
}
