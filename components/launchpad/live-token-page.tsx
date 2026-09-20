"use client"

/**
 * The real token page — Phase 3 (read + trade).
 *
 * Every figure is served: status, SOL raised and the graduation threshold come
 * from the reconciler's read of the pool; the ticket's numbers come from the
 * backend's quote. There is deliberately no curve chart yet: the preview's
 * chart draws a constant-product curve, which is not the shape Meteora's DBC
 * builds, and a chart of the wrong curve is worse than none. It returns once
 * it can be drawn from the config's own curve points.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  CardShell,
  EmptyState,
  PageHeader,
  SectionRule,
  SkeletonRows,
} from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { ProgressBar } from "@/components/launchpad-unauth/parts"
import {
  cryptoBackendClient,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import { cn } from "@/lib/utils"
import { LiveCurveTicket, fromBaseUnits } from "./live-curve-ticket"
import { AddressRow } from "./address-row"
import { CurveChart } from "./curve-chart"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { NetworkBadge } from "./network"

const STATUS_LABEL: Record<string, string> = {
  live: "On the curve",
  graduating: "Graduating",
  graduated: "Graduated",
}

export function LiveTokenPage({ launchId }: { launchId: string }) {
  const token = useQuery({
    queryKey: ["launchpad", "token", launchId],
    queryFn: ({ signal }) =>
      cryptoBackendClient.getLaunchpadToken(launchId, signal),
    enabled: isCryptoBackendEnabled,
    // The reconciler refreshes curve state every ~30s; reading faster shows
    // nothing new.
    refetchInterval: 30_000,
  })

  const curve_ = useQuery({
    queryKey: ["launchpad", "curve", launchId],
    queryFn: ({ signal }) =>
      cryptoBackendClient.getLaunchpadCurve(launchId, signal),
    enabled: isCryptoBackendEnabled && token.data?.data.status === "live",
    refetchInterval: 30_000,
  })

  if (token.isLoading) {
    return (
      <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
        <PageHeader title="Loading…" back="/launchpad" />
        <CardShell className={cn(CARD_HUE, "h-auto p-5")}>
          <SkeletonRows rows={4} />
        </CardShell>
      </div>
    )
  }

  if (token.error || !token.data) {
    return (
      <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
        <PageHeader title="Token not found" back="/launchpad" />
        <EmptyState
          title="We couldn't find this launch"
          description="It may not have been confirmed on Solana yet, or the link is wrong."
        />
      </div>
    )
  }

  const { data: launch, platformFeeBps, tokenDecimals } = token.data
  const curve = launch.curve
  const progressBps = curve?.progressBps ?? 0

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PageHeader
        title={launch.name}
        subtitle={`$${launch.symbol} · Solana`}
        back="/launchpad"
        actions={<NetworkBadge networkId={launch.networkId} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div className="min-w-0 space-y-6">
          <CardShell className={cn(CARD_HUE, "flex h-auto flex-col gap-4 p-5")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">
                {STATUS_LABEL[launch.status] ?? launch.status}
              </span>
              {curve && (
                <span className="text-[11.5px] text-muted-foreground">
                  Updated {new Date(curve.refreshedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            {curve ? (
              <>
                <ProgressBar bps={progressBps} />
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="tabular-nums">
                    <span className="font-semibold">
                      {fromBaseUnits(curve.solRaised, 9, 3)} SOL
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      raised of {fromBaseUnits(
                        curve.graduationLamports,
                        9,
                        0
                      )}{" "}
                      SOL
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {(progressBps / 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  When the curve reaches its target, the token graduates: its
                  liquidity moves to the open market and is locked there
                  permanently.
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                Curve state appears once the launch is confirmed.
              </p>
            )}
          </CardShell>

          {launch.status === "live" && (
            <CurveChart
              points={curve_.data?.points ?? []}
              current={curve_.data?.current ?? null}
              graduationLamports={
                curve_.data?.graduationLamports ??
                launch.curve?.graduationLamports ??
                "0"
              }
              symbol={launch.symbol}
              loading={curve_.isLoading}
              error={
                curve_.error
                  ? formatWalletActionError(curve_.error, "solana")
                  : null
              }
            />
          )}

          {launch.graduation && (
            <CardShell
              className={cn(CARD_HUE, "flex h-auto flex-col gap-3 p-5")}
            >
              <span className="text-[13px] font-semibold">
                Graduated to the open market
              </span>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                The curve filled and its liquidity moved into a Meteora pool,
                where it&apos;s locked permanently: nobody, including the
                creator, can withdraw it.
                {launch.networkId === "solana-mainnet-beta"
                  ? " It trades like any other token, and appears in Markets once a price is available."
                  : " Devnet tokens aren't listed in Markets."}
              </p>
              <AddressRow
                label="Market pool"
                value={launch.graduation.ammPoolAddress}
                networkId={launch.networkId}
              />
            </CardShell>
          )}

          <SectionRule label="Token" />
          <CardShell className={cn(CARD_HUE, "flex h-auto flex-col gap-3 p-5")}>
            <dl className="flex flex-col gap-2 text-[12.5px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Creator allocation</dt>
                <dd className="font-semibold tabular-nums">
                  {(launch.allocation.creatorBps / 100).toFixed(2)}% of supply
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Vesting</dt>
                <dd className="font-medium">
                  None: the creator&apos;s tokens are free to sell
                </dd>
              </div>
            </dl>
            {launch.description && (
              <p className="text-[12.5px] leading-relaxed text-foreground/85">
                {launch.description}
              </p>
            )}
          </CardShell>

          <SectionRule
            label="Addresses"
            note="On-chain, check before you send"
          />
          <div className="flex flex-col gap-3">
            {launch.mint && (
              <AddressRow
                label="Token address"
                value={launch.mint}
                networkId={launch.networkId}
                hint="The token itself"
              />
            )}
            {launch.poolAddress && (
              <AddressRow
                label="Curve pool"
                value={launch.poolAddress}
                networkId={launch.networkId}
                hint="Holds the SOL raised so far"
              />
            )}
            <AddressRow
              label="Creator"
              value={launch.creatorAddress}
              networkId={launch.networkId}
              hint="Launched this token"
            />
          </div>
        </div>

        <div className="min-w-0 lg:self-start">
          <LiveCurveTicket
            token={launch}
            platformFeeBps={platformFeeBps}
            tokenDecimals={tokenDecimals}
          />
        </div>
      </div>
    </div>
  )
}
