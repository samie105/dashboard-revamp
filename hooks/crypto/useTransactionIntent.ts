"use client"

import { useCallback, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { CryptoBackendError } from "@/lib/crypto-backend/errors"
import type { CryptoTransactionIntent, CryptoWalletPackageDocument, SponsorshipOperation } from "@/lib/crypto-backend"
import { createIdempotencyKeyStore } from "@/lib/crypto-backend/idempotency"
import { signEvmIntent } from "@/lib/crypto-wallet/evm-signing"
import { signSponsoredEvmOperation } from "@/lib/crypto-wallet/evm-signing"
import { signSolanaIntent, signSponsoredSolanaTransaction } from "@/lib/crypto-wallet/solana-signing"
import { signSuiIntent } from "@/lib/crypto-wallet/sui-signing"
import { signTonIntent } from "@/lib/crypto-wallet/ton-signing"
import { signTronIntent } from "@/lib/crypto-wallet/tron-signing"
import { signIntertrainIntent } from "@/lib/crypto-wallet/intertrain-signing"

type TransferInput = {
  accountId: string
  networkId: string
  asset: { kind: "native" | "token"; identifier: string }
  to: string
  amount: string
  sponsorFees?: boolean
}

type CreateIntentResult = {
  intent: CryptoTransactionIntent
  sponsorship: SponsorshipOperation | undefined
  feeMode: "sponsored" | "self-paid"
}

type AdoptIntentOptions = {
  sponsorFees?: boolean
}

export function useTransactionIntent(walletId?: string, packageValue?: CryptoWalletPackageDocument) {
  const { user, isLoaded, isSignedIn } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.userId ?? "anonymous"
  const [intentId, setIntentId] = useState<string>()
  const [sponsorshipId, setSponsorshipId] = useState<string>()
  const [adoptedSponsorshipError, setAdoptedSponsorshipError] = useState<unknown>()
  const [isAdoptingSponsorship, setIsAdoptingSponsorship] = useState(false)
  const enabled = isCryptoBackendEnabled && isLoaded && isSignedIn
  const intentQuery = useQuery({
    queryKey: cryptoQueryKeys.intent(userId, intentId ?? "none"),
    queryFn: ({ signal }) => cryptoBackendClient.getIntent(intentId as string, signal),
    enabled: enabled && Boolean(intentId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "submitting" || status === "submitted" || status === "pending" || status === "unknown" ? 5_000 : false
    },
  })

  const sponsorshipQuery = useQuery({
    queryKey: ["crypto", "sponsorship", userId, sponsorshipId ?? "none"],
    queryFn: ({ signal }) => cryptoBackendClient.getSponsorshipStatus(sponsorshipId as string, signal),
    enabled: enabled && Boolean(sponsorshipId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "submitting" || status === "submitted" || status === "prepared" ? 5_000 : false
    },
  })

  // One key per distinct transfer, stable across every retry of it. See
  // lib/crypto-backend/idempotency.ts for why the per-call UUID this
  // replaces was a double-spend window wearing the costume of protection.
  const idempotency = useRef(createIdempotencyKeyStore())

  const create = useMutation({
    mutationFn: async (input: TransferInput): Promise<CreateIntentResult> => {
      const { sponsorFees, ...transferInput } = input
      const routed = await cryptoBackendClient.createTransferIntent({
        ...transferInput,
        sponsorFees,
        idempotencyKey: idempotency.current.keyFor(transferInput),
      })
      return {
        intent: routed.intent,
        sponsorship: routed.sponsorship,
        feeMode: routed.feeMode ?? (sponsorFees ? "self-paid" : "self-paid"),
      }
    },
    retry: false,
    onSuccess: ({ intent, sponsorship }) => {
      setIntentId(intent.id)
      setSponsorshipId(sponsorship?.id)
      setAdoptedSponsorshipError(undefined)
      setIsAdoptingSponsorship(false)
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
    mutationFn: async ({ useSponsorship }: { useSponsorship: boolean }) => {
      if (!intentId || !intentQuery.data || !walletId || !packageValue) throw new Error("Create an intent and unlock the wallet before signing")
      let intent = intentQuery.data
      let sponsorship = sponsorshipQuery.data ?? create.data?.sponsorship
      const sponsorshipReady = sponsorship?.status === "prepared" && Boolean(sponsorship.signingPayload) && new Date(sponsorship.expiresAt).getTime() > Date.now()

      // Re-route at the last safe point too. This covers a page-resume race
      // and a prepared relay quote expiring while the review screen is open.
      // The backend either returns a fresh prepared payload or rebuilds the
      // same intent as a normal user-paid transaction; the browser never
      // mutates a sponsored transaction into a direct one.
      if (useSponsorship && !sponsorshipReady) {
        const routed = await cryptoBackendClient.routeIntentFees(intent.id)
        intent = routed.intent
        sponsorship = routed.sponsorship
        queryClient.setQueryData<CryptoTransactionIntent>(cryptoQueryKeys.intent(userId, intent.id), intent)
        setSponsorshipId(sponsorship?.id)
        if (sponsorship) queryClient.setQueryData<SponsorshipOperation>(["crypto", "sponsorship", userId, sponsorship.id], sponsorship)
      }

      // Spec §11 edge case: branch on the user's FINAL choice, not merely on
      // whether an operation object happens to exist — an operation that
      // expired (or was quoted for a choice the user has since walked back)
      // must never be signed down the sponsored path just because it's still
      // sitting in the cache.
      const shouldSubmitSponsored = useSponsorship && sponsorship?.status === "prepared" && Boolean(sponsorship.signingPayload) && new Date(sponsorship.expiresAt).getTime() > Date.now()
      if (shouldSubmitSponsored && sponsorship) {
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
              : intent.chainFamily === "intertrain"
                ? await signIntertrainIntent(userId, walletId, packageValue, intent, String(intent.accountId))
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
    onError: async (error) => {
      // The backend durably claims before broadcasting. If another tab owns
      // that claim, refresh immediately so the status poll follows the same
      // intent instead of leaving this tab displaying awaiting_signature.
      if (error instanceof CryptoBackendError && ["SUBMISSION_IN_PROGRESS", "BROADCAST_UNKNOWN", "SUBMISSION_STATE_UNCERTAIN", "SUBMISSION_RECOVERY_REQUIRED"].includes(error.code)) {
        await intentQuery.refetch()
      }
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
  const adoptIntent = useCallback((id: string, options?: AdoptIntentOptions) => {
    setIntentId(id)
    if (!options?.sponsorFees) return

    setSponsorshipId(undefined)
    setAdoptedSponsorshipError(undefined)
    setIsAdoptingSponsorship(true)
    void (async () => {
      try {
        const routed = await cryptoBackendClient.routeIntentFees(id)
        queryClient.setQueryData<CryptoTransactionIntent>(cryptoQueryKeys.intent(userId, id), routed.intent)
        setSponsorshipId(routed.sponsorship?.id)
        if (routed.sponsorship) queryClient.setQueryData<SponsorshipOperation>(["crypto", "sponsorship", userId, routed.sponsorship.id], routed.sponsorship)
      } catch (error) {
        setAdoptedSponsorshipError(error)
      } finally {
        setIsAdoptingSponsorship(false)
      }
    })()
  }, [queryClient, userId])

  const reset = useCallback(() => {
    // Starting over is the boundary between one transfer and the next: the
    // keys must not survive it, or a deliberate repeat send would be
    // deduplicated into the transfer that just finished.
    idempotency.current.clear()
    setIntentId(undefined)
    setSponsorshipId(undefined)
    setAdoptedSponsorshipError(undefined)
    setIsAdoptingSponsorship(false)
    create.reset()
    simulate.reset()
    submit.reset()
  }, [create, simulate, submit])

  return {
    intent: enabled ? intentQuery.data ?? create.data?.intent : undefined,
    sponsorship: enabled ? sponsorshipQuery.data ?? create.data?.sponsorship : undefined,
    isSponsorshipPreparing: isAdoptingSponsorship,
    intentId,
    isLoading: create.isPending || intentQuery.isLoading,
    isSimulating: simulate.isPending,
    isSubmitting: submit.isPending,
    error: adoptedSponsorshipError ?? create.error ?? simulate.error ?? submit.error ?? intentQuery.error ?? null,
    createIntent: create.mutateAsync,
    simulateIntent: simulate.mutateAsync,
    submitIntent: submit.mutateAsync,
    adoptIntent,
    reset,
  }
}
