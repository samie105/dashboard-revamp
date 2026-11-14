"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { isCryptoBackendEnabled } from "@/lib/crypto-backend"
import type { LaunchpadFeedFilter, LaunchpadNetworkId } from "@/lib/crypto-backend/types"
import { launchpadMarket } from "@/lib/launchpad-market/source"
import { isMarketUnavailable, type ChartRange } from "@/lib/launchpad-market/types"

/** The mock needs no backend; the live source needs the crypto backend configured. */
const enabled = launchpadMarket.isMock || isCryptoBackendEnabled

/** "Not available yet" won't change on retry. */
const retry = (count: number, error: unknown) => !isMarketUnavailable(error) && count < 2

export const launchpadKeys = {
  networks: () => ["launchpad", "networks", launchpadMarket.isMock] as const,
  feed: (n: LaunchpadNetworkId | null, f: LaunchpadFeedFilter) => ["launchpad", "feed", n, f, launchpadMarket.isMock] as const,
  token: (id: string) => ["launchpad", "token", id, launchpadMarket.isMock] as const,
  curve: (id: string) => ["launchpad", "curve", id, launchpadMarket.isMock] as const,
  stats: (n: LaunchpadNetworkId | null) => ["launchpad", "stats", n, launchpadMarket.isMock] as const,
  candles: (id: string, r: ChartRange) => ["launchpad", "candles", id, r, launchpadMarket.isMock] as const,
  trades: (id: string) => ["launchpad", "trades", id, launchpadMarket.isMock] as const,
  holders: (id: string) => ["launchpad", "holders", id, launchpadMarket.isMock] as const,
  portfolio: (n: LaunchpadNetworkId | null) => ["launchpad", "portfolio", n, launchpadMarket.isMock] as const,
}

export function useLaunchFeed(networkId: LaunchpadNetworkId | null, filter: LaunchpadFeedFilter, active = true) {
  return useQuery({
    queryKey: launchpadKeys.feed(networkId, filter),
    queryFn: ({ signal }) => launchpadMarket.feed(networkId!, filter, { signal }),
    enabled: active && enabled && Boolean(networkId),
    refetchInterval: 30_000,
    retry,
  })
}

export function useLaunchStats(networkId: LaunchpadNetworkId | null) {
  return useQuery({
    queryKey: launchpadKeys.stats(networkId),
    queryFn: ({ signal }) => launchpadMarket.stats(networkId!, { signal }),
    enabled: enabled && Boolean(networkId),
    refetchInterval: 15_000,
    retry,
  })
}

export function useLaunchCandles(launchId: string, range: ChartRange) {
  return useQuery({
    queryKey: launchpadKeys.candles(launchId, range),
    queryFn: ({ signal }) => launchpadMarket.candles(launchId, range, { signal }),
    enabled,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
    retry,
  })
}

export function useLaunchTrades(launchId: string) {
  return useQuery({ queryKey: launchpadKeys.trades(launchId), queryFn: ({ signal }) => launchpadMarket.trades(launchId, { signal }), enabled, refetchInterval: 10_000, retry })
}

export function useLaunchHolders(launchId: string) {
  return useQuery({ queryKey: launchpadKeys.holders(launchId), queryFn: ({ signal }) => launchpadMarket.holders(launchId, { signal }), enabled, refetchInterval: 60_000, retry })
}

export function useLaunchPortfolio(networkId: LaunchpadNetworkId | null) {
  return useQuery({ queryKey: launchpadKeys.portfolio(networkId), queryFn: ({ signal }) => launchpadMarket.portfolio(networkId!, { signal }), enabled: enabled && Boolean(networkId), refetchInterval: 30_000, retry })
}
