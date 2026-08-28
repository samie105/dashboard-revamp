"use client"

/**
 * The one place the send flow learns whether a sponsored fee is on offer, and
 * what it would cost.
 *
 * Deliberately isolated. `useTransactionIntent.create` catches its own
 * `quoteSponsorship`/`prepareSponsorship` failures (spec §11: an outage there
 * must never fail the whole transfer) and hands back `{ sponsorship,
 * sponsorshipError }`; `resolveFeePresentation` (lib/crypto-backend/
 * sponsorship.ts) turns that pair into the truth the review screen renders.
 * `feeRowValue` here is only presentation — formatting that decision into the
 * fee row's string — so this file, not the screens, is what changes if the
 * formatting ever needs to.
 */

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/components/auth-provider"
import { cryptoBackendClient, isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { SponsorshipConfig } from "@/lib/crypto-backend"
import type { FeePresentation } from "@/lib/crypto-backend/sponsorship"
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
 * Pure formatting over `resolveFeePresentation`'s verdict — `self-paid` and
 * `self-paid-fallback` read identically here (both are honestly "you pay the
 * network fee"); the fallback's REASON is a separate warning notice next to
 * this row, not folded into the value itself.
 */
export function feeRowValue(presentation: FeePresentation, gasEstimate: string | undefined): string {
  if (presentation.kind === "sponsored") {
    return presentation.costUsd !== undefined
      ? `${FEE_SPONSORED_LABEL} · ≈ ${usd(presentation.costUsd)}`
      : FEE_SPONSORED_LABEL
  }
  return gasEstimate ? `${FEE_SELF_LABEL} · ${gasEstimate} gas` : FEE_SELF_LABEL
}
