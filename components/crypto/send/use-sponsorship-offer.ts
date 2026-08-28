"use client"

/**
 * The one place the send flow learns whether a sponsored fee is on offer, and
 * what it would cost.
 *
 * Deliberately isolated. Today the quote/prepare round-trip happens inside
 * `useTransactionIntent.createIntent`, so the review screen's fee row can only
 * report what that mutation happened to return. Task 14 moves the quote out of
 * the create mutation (a quote failure should degrade the fee row, not fail the
 * whole transfer) — when it does, this hook and `feeRowValue` are the surface
 * that changes, not the screens.
 */

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { SponsorshipConfig, SponsorshipOperation } from "@/lib/crypto-backend"
import { usd } from "@/lib/num"
import { FEE_SELF_LABEL, FEE_SPONSORED_LABEL, sponsorshipOffered } from "./send-helpers"

export function useSponsorshipOffer(input: {
  networkId: string
  family: string | undefined
  assetKind: "native" | "token"
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const query = useQuery({
    queryKey: ["crypto", "sponsorship-config"],
    queryFn: ({ signal }) => cryptoBackendClient.getSponsorshipConfig(signal),
    enabled: isCryptoBackendEnabled && isLoaded && isSignedIn,
    staleTime: 5 * 60_000,
    // A config we can't read means "no offer" — never a blocking error. The
    // self-paid path is always available, so this failing costs the user
    // nothing but the choice.
    retry: false,
  })

  const config: SponsorshipConfig | null = query.data ?? null
  return {
    config,
    offered: sponsorshipOffered({ config, networkId: input.networkId, family: input.family, assetKind: input.assetKind }),
    isLoading: query.isLoading,
  }
}

/**
 * The review screen's "Network fee" value.
 *
 * Sponsored AND prepared is the only state that may promise Worldstreet pays —
 * a quote that never reached `prepared` has no signing payload, so the submit
 * would fall back and the user would be charged after reading otherwise.
 */
export function feeRowValue(input: {
  sponsorship: SponsorshipOperation | undefined
  sponsorFees: boolean
  gasEstimate: string | undefined
}): string {
  const { sponsorship, sponsorFees, gasEstimate } = input
  const prepared =
    sponsorFees &&
    sponsorship !== undefined &&
    (sponsorship.status === "prepared" || sponsorship.status === "submitted" || sponsorship.status === "confirmed")
  if (prepared) {
    const estimate = sponsorship.estimatedCostUsd ?? sponsorship.quote?.sponsor?.estimatedCostUsd
    const cost = typeof estimate === "string" ? Number(estimate) : estimate
    return cost !== undefined && Number.isFinite(cost) && cost > 0
      ? `${FEE_SPONSORED_LABEL} · ≈ ${usd(cost)}`
      : FEE_SPONSORED_LABEL
  }
  return gasEstimate ? `${FEE_SELF_LABEL} · ${gasEstimate} gas` : FEE_SELF_LABEL
}
