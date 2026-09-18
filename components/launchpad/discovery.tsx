"use client"

/**
 * Launchpad Phase 5 — the discovery feed, for real.
 *
 * Every row is a launch that exists on-chain, served by /launchpad/tokens and
 * refreshed by the reconciler. Ranked by curve progress by default: the one
 * ordering that can't be bought with a label. No price, no market cap and no
 * USD figures yet — those need a price source per token, and a feed that
 * invents them is the thing this redesign keeps removing.
 */

import * as React from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  CardShell,
  EmptyState,
  PageHeader,
  Segmented,
  SkeletonRows,
} from "@/components/ui/system"
import { CARD_HUE } from "@/components/ui/surface"
import { ProgressBar } from "@/components/launchpad-unauth/parts"
import {
  cryptoBackendClient,
  isCryptoBackendEnabled,
} from "@/lib/crypto-backend"
import type {
  LaunchpadFeedFilter,
  LaunchpadToken,
} from "@/lib/crypto-backend/types"
import { formatWalletActionError } from "@/lib/crypto-wallet/action-errors"
import { cn } from "@/lib/utils"
import { fromBaseUnits } from "./live-curve-ticket"
import { isDevnet, NetworkSwitch, useLaunchNetwork } from "./network"

const FILTERS: Array<{ key: LaunchpadFeedFilter; label: string }> = [
  { key: "all", label: "On the curve" },
  { key: "new", label: "New" },
  { key: "near", label: "Near graduation" },
  { key: "graduated", label: "Graduated" },
]

const EMPTY_COPY: Record<LaunchpadFeedFilter, string> = {
  all: "Nothing is on the curve here yet. Be the first to launch.",
  new: "No new launches yet.",
  near: "No launch is past 75% of its target yet.",
  graduated: "Nothing has graduated here yet.",
}

export function LaunchpadDiscovery() {
  const network = useLaunchNetwork()
  const networkId = network.networkId
  const [filter, setFilter] = React.useState<LaunchpadFeedFilter>("all")

  const availability = useQuery({
    queryKey: ["launchpad", "availability"],
    queryFn: ({ signal }) =>
      cryptoBackendClient.getLaunchpadAvailability(signal),
    enabled: isCryptoBackendEnabled,
    refetchInterval: 60_000,
  })
  const paused = availability.data?.solana.state === "paused"

  const feed = useQuery({
    queryKey: ["launchpad", "feed", networkId, filter],
    queryFn: ({ signal }) =>
      cryptoBackendClient.listLaunchpadTokens(networkId!, filter, signal),
    enabled: isCryptoBackendEnabled && Boolean(networkId),
    refetchInterval: 30_000,
  })

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Launchpad"
        subtitle="Tokens start on a bonding curve and graduate to the open market when the curve fills."
        actions={
          <NetworkSwitch
            networks={network.networks}
            networkId={networkId}
            onChange={network.setNetworkId}
          />
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none min-w-0 overflow-x-auto">
          <Segmented
            options={FILTERS}
            value={filter}
            onChange={(next) => setFilter(next as LaunchpadFeedFilter)}
          />
        </div>
        {paused ? (
          <span
            aria-disabled="true"
            className="inline-flex h-11 items-center rounded-full bg-foreground/[0.08] px-5 text-[13.5px] font-bold text-muted-foreground"
          >
            Launches are paused
          </span>
        ) : (
          <Link
            href="/launchpad/create"
            className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-[13.5px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Launch a token
          </Link>
        )}
      </div>

      {paused && (
        <div
          role="status"
          className="rounded-2xl border border-warning/30 bg-warning-chip px-4 py-3"
        >
          <p className="text-[13px] font-semibold text-warning">
            Solana launches are paused
          </p>
          <p className="text-[12.5px] leading-relaxed text-foreground/85">
            {availability.data?.solana.reason ?? "No reason was given."}
          </p>
        </div>
      )}

      {isDevnet(networkId) && (
        <p className="text-[12px] text-muted-foreground">
          You&apos;re viewing devnet: test tokens with no value.
        </p>
      )}

      {network.error ? (
        <CardShell className={cn(CARD_HUE, "p-5 text-[13px] text-debit")}>
          {formatWalletActionError(network.error, "solana")}
        </CardShell>
      ) : feed.isLoading || !networkId ? (
        <CardShell className={cn(CARD_HUE, "p-5")}>
          <SkeletonRows rows={4} />
        </CardShell>
      ) : feed.error ? (
        <CardShell className={cn(CARD_HUE, "p-5 text-[13px] text-debit")}>
          {formatWalletActionError(feed.error, "solana")}
        </CardShell>
      ) : !feed.data?.length ? (
        <EmptyState title="No launches" description={EMPTY_COPY[filter]} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {feed.data.map((launch) => (
            <FeedCard key={launch.launchId} launch={launch} />
          ))}
        </div>
      )}
    </div>
  )
}

function FeedCard({ launch }: { launch: LaunchpadToken }) {
  const curve = launch.curve
  const graduated =
    launch.status === "graduated" || launch.status === "graduating"
  return (
    <Link
      href={`/launchpad/${encodeURIComponent(launch.launchId)}`}
      className="block min-w-0 rounded-3xl focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
    >
      <CardShell
        className={cn(
          CARD_HUE,
          "flex h-full flex-col gap-3 p-4 transition-colors hover:bg-accent/30"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary"
          >
            {launch.symbol.slice(0, 2)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-semibold">
              {launch.name}
            </span>
            <span className="text-[12px] text-muted-foreground">
              ${launch.symbol}
            </span>
          </span>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-[0.06em] uppercase",
              graduated
                ? "bg-primary/15 text-primary"
                : "bg-foreground/[0.07] text-muted-foreground"
            )}
          >
            {launch.status === "graduated"
              ? "Graduated"
              : launch.status === "graduating"
                ? "Graduating"
                : "On curve"}
          </span>
        </div>
        {curve && (
          <>
            <ProgressBar bps={curve.progressBps} />
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="text-muted-foreground tabular-nums">
                {fromBaseUnits(curve.solRaised, 9, 2)} /{" "}
                {fromBaseUnits(curve.graduationLamports, 9, 0)} SOL
              </span>
              <span className="font-semibold tabular-nums">
                {(curve.progressBps / 100).toFixed(1)}%
              </span>
            </div>
          </>
        )}
        <span className="text-[11.5px] text-muted-foreground">
          Creator holds {(launch.allocation.creatorBps / 100).toFixed(1)}% ·
          launched {new Date(launch.createdAt).toLocaleDateString()}
        </span>
      </CardShell>
    </Link>
  )
}
