"use client"

/**
 * Compliance hooks (CP4, guide §7). Reads use the guide §12.3 retry policy;
 * mutations never auto-retry: a user-initiated retry goes back through
 * runIdempotentMutation, which reuses the key after an uncertain failure.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import {
  cryptoBackendClient,
  cryptoQueryKeys,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import {
  createOnswitchCustomer,
  finishBridgeKyc,
  startBridgeKyc,
  type BridgeKycInput,
  type OnswitchProfileInput,
} from "@/lib/crypto-backend/fiat-compliance"
import { fiatReadRetry } from "@/lib/crypto-backend/fiat-errors"

function useComplianceKey() {
  const { user, isLoaded, isSignedIn } = useAuth()
  const userId = user?.userId ?? "anonymous"
  return {
    key: cryptoQueryKeys.fiatCompliance(userId),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
  }
}

/** GET /fiat/compliance (guide §7 lines 434-460). */
export function useFiatCompliance() {
  const { key, enabled } = useComplianceKey()
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => cryptoBackendClient.getFiatCompliance(signal),
    enabled,
    retry: fiatReadRetry,
  })
}

/** POST /fiat/compliance/bridge/kyc-link (guide §7 lines 461-501). */
export function useStartBridgeKyc() {
  const queryClient = useQueryClient()
  const { key } = useComplianceKey()
  return useMutation({
    mutationFn: (input: BridgeKycInput) => startBridgeKyc(cryptoBackendClient, input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** "I've finished" → POST /fiat/compliance/bridge/sync, then refetch (guide lines 499-501). */
export function useFinishBridgeKyc() {
  const queryClient = useQueryClient()
  const { key } = useComplianceKey()
  return useMutation({
    mutationFn: () => finishBridgeKyc(cryptoBackendClient),
    retry: false,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** POST /fiat/compliance/customer for OnSwitch (guide §7 lines 503-524). */
export function useCreateOnswitchCustomer() {
  const queryClient = useQueryClient()
  const { key } = useComplianceKey()
  return useMutation({
    mutationFn: (input: OnswitchProfileInput) => createOnswitchCustomer(cryptoBackendClient, input),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
