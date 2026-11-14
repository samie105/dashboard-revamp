/**
 * THE ONE FILE TO CHANGE as the backend adds launchpad market data.
 *
 * `launchpadMarket` is what every launchpad screen reads. The launch list,
 * one launch and its curve come from the real backend today
 * (cryptoBackendClient). Stats, candles, trades, holders and portfolio
 * aren't served yet: they throw MarketUnavailableError, and the screens show
 * "coming soon" in their place. When an endpoint lands, replace its throw
 * with the call and map the response onto lib/launchpad-market/types.ts.
 *
 * In `next dev` with NEXT_PUBLIC_LAUNCHPAD_MOCKS=true everything comes from
 * the mock instead. The mock's import sits behind process.env.NODE_ENV (a
 * literal at build time), so production bundles don't include it at all.
 */

import { cryptoBackendClient } from "@/lib/crypto-backend"
import { LAUNCHPAD_MOCKS_ENABLED } from "@/lib/launchpad-mocks"
import { MarketUnavailableError, type LaunchpadMarketSource } from "@/lib/launchpad-market/types"

const unavailable = (what: string) => async (): Promise<never> => {
  throw new MarketUnavailableError(what)
}

const live: LaunchpadMarketSource = {
  isMock: false,
  networks: (o) => cryptoBackendClient.getLaunchpadNetworks(o?.signal),
  feed: (networkId, filter, o) => cryptoBackendClient.listLaunchpadTokens(networkId, filter, o?.signal),
  token: async (launchId, o) => {
    const r = await cryptoBackendClient.getLaunchpadToken(launchId, o?.signal)
    return { token: r.data, platformFeeBps: r.platformFeeBps, tokenDecimals: r.tokenDecimals }
  },
  curve: (launchId, o) => cryptoBackendClient.getLaunchpadCurve(launchId, o?.signal),
  stats: unavailable("Market stats"),
  candles: unavailable("Price history"),
  trades: unavailable("The trade feed"),
  holders: unavailable("Holders"),
  portfolio: unavailable("Your launches and holdings"),
}

const loadMock: () => Promise<LaunchpadMarketSource> =
  process.env.NODE_ENV === "development"
    ? () => import("@/lib/launchpad-market/mock").then((m) => m.mockLaunchpadMarket)
    : () => Promise.reject(new MarketUnavailableError("Demo data"))

const mock: LaunchpadMarketSource = {
  isMock: true,
  networks: async (o) => (await loadMock()).networks(o),
  feed: async (n, f, o) => (await loadMock()).feed(n, f, o),
  token: async (id, o) => (await loadMock()).token(id, o),
  curve: async (id, o) => (await loadMock()).curve(id, o),
  stats: async (n, o) => (await loadMock()).stats(n, o),
  candles: async (id, r, o) => (await loadMock()).candles(id, r, o),
  trades: async (id, o) => (await loadMock()).trades(id, o),
  holders: async (id, o) => (await loadMock()).holders(id, o),
  portfolio: async (n, o) => (await loadMock()).portfolio(n, o),
}

export const launchpadMarket: LaunchpadMarketSource = LAUNCHPAD_MOCKS_ENABLED ? mock : live
