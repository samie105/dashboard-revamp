"use client"

import { useCallback, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type { CryptoTransactionIntent, CryptoWalletPackageDocument, SponsorshipOperation } from "@/lib/crypto-backend"
import { signEvmIntent } from "@/lib/crypto-wallet/evm-signing"
import { signSponsoredEvmOperation } from "@/lib/crypto-wallet/evm-signing"
import { signSolanaIntent, signSponsoredSolanaTransaction } from "@/lib/crypto-wallet/solana-signing"
import { signSuiIntent } from "@/lib/crypto-wallet/sui-signing"
import { signTonIntent } from "@/lib/crypto-wallet/ton-signing"
import { signTronIntent } from "@/lib/crypto-wallet/tron-signing"

type TransferInput = {
  accountId: string
  networkId: string
  asset: { kind: "native" | "token"; identifier: string }
  to: string
  amount: string
  sponsorFees?: boolean
}

export function useTransactionIntent(walletId?: string, packageValue?: CryptoWalletPackageDocument) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const [intentId, setIntentId] = useState<string>()
  const [sponsorshipId, setSponsorshipId] = useState<string>()
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

  const sponsorshipQuery = useQuery({
    queryKey: ["crypto", "sponsorship", userId, sponsorshipId ?? "none"],
    queryFn: ({ signal }) => cryptoBackendClient.getSponsorshipStatus(sponsorshipId as string, signal),
    enabled: enabled && Boolean(sponsorshipId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "submitted" || status === "prepared" ? 5_000 : false
    },
  })

  const create = useMutation({
    mutationFn: async (input: TransferInput) => {
      const { sponsorFees, ...transferInput } = input
      const intent = await cryptoBackendClient.createTransferIntent({ ...transferInput, idempotencyKey: crypto.randomUUID() })
      if (!sponsorFees) return { intent }
      const sponsorship = await cryptoBackendClient.quoteSponsorship({
        accountId: input.accountId,
        networkId: input.networkId,
        operation: input.asset.kind === "token" ? "token-transfer" : "native-transfer",
        intentId: intent.id,
      })
      const prepared = sponsorship.status === "prepared"
        ? sponsorship
        : await cryptoBackendClient.prepareSponsorship(sponsorship.id, intent.id)
      return { intent, sponsorship: prepared }
    },
    retry: false,
    onSuccess: ({ intent, sponsorship }) => {
      setIntentId(intent.id)
      setSponsorshipId(sponsorship?.id)
      if (sponsorship) queryClient.setQueryData<SponsorshipOperation>(["crypto", "sponsorship", userId, sponsorship.id], sponsorship)
    },
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
      const sponsorship = sponsorshipQuery.data ?? create.data?.sponsorship
      if (sponsorship) {
        if (!sponsorship.signingPayload) throw new Error("Sponsored signing payload is not ready")
        const signedPayload = intent.chainFamily === "solana"
          ? await signSponsoredSolanaTransaction(userId, walletId, packageValue, sponsorship.signingPayload, String(intent.accountId))
          : intent.chainFamily === "evm"
            ? await signSponsoredEvmOperation(userId, walletId, packageValue, sponsorship.signingPayload, String(intent.accountId))
            : (() => { throw new Error("Sponsored transactions are currently limited to EVM and Solana") })()
        return cryptoBackendClient.submitSponsorship(sponsorship.id, signedPayload)
      }
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
      // Spec §5: a confirmed transaction is one of the explicit triggers that
      // invalidates the balance snapshot (otherwise it stays cached).
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balanceSnapshot(userId) })
      await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.balances(userId) })
      await queryClient.invalidateQueries({ queryKey: ["crypto", "balance", userId] })
      await queryClient.invalidateQueries({ queryKey: ["crypto", "transactions", userId] })
      if ("id" in record && record.id) await queryClient.invalidateQueries({ queryKey: cryptoQueryKeys.transaction(userId, record.id) })
      await intentQuery.refetch()
      if ("operation" in record) await sponsorshipQuery.refetch()
    },
  })

  /**
   * Point the poll at an intent this hook didn't create.
   *
   * The one caller is the `DUPLICATE_REQUEST` → `view-existing` path: the
   * service says the work is already in flight under another id, and the honest
   * response is to watch THAT one rather than to show a status screen about an
   * intent that was never accepted.
   */
  const adoptIntent = useCallback((id: string) => {
    setIntentId(id)
  }, [])

  const reset = useCallback(() => {
    setIntentId(undefined)
    setSponsorshipId(undefined)
    create.reset()
    simulate.reset()
    submit.reset()
  }, [create, simulate, submit])

  return {
    intent: enabled ? intentQuery.data ?? create.data?.intent : undefined,
    sponsorship: enabled ? sponsorshipQuery.data ?? create.data?.sponsorship : undefined,
    intentId,
    isLoading: create.isPending || intentQuery.isLoading,
    isSimulating: simulate.isPending,
    isSubmitting: submit.isPending,
    error: create.error ?? simulate.error ?? submit.error ?? intentQuery.error ?? null,
    createIntent: create.mutateAsync,
    simulateIntent: simulate.mutateAsync,
    submitIntent: submit.mutateAsync,
    adoptIntent,
    reset,
  }
}
