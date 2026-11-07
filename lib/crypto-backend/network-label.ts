import { humanizeValue } from "./fiat-display"

/** What a person calls the network, not what the backend calls it. */
const LABELS: Readonly<Record<string, string>> = {
  "ethereum-mainnet": "Ethereum",
  "solana-mainnet-beta": "Solana",
  "tron-mainnet": "Tron",
  "arbitrum-one": "Arbitrum",
  "base-mainnet": "Base",
  "polygon-mainnet": "Polygon",
  "bnb-mainnet": "BNB Chain",
  "bitcoin-mainnet": "Bitcoin",
  "ton-mainnet": "TON",
  "sui-mainnet": "Sui",
  "intertrain-mainnet": "Intertrain",
}

export function networkLabel(networkId: string): string {
  const known = LABELS[networkId]
  if (known) return known
  const trimmed = networkId.replace(/-(mainnet|beta|one|testnet|devnet)$/i, "")
  return humanizeValue(trimmed) || networkId
}

/**
 * Lower is cheaper and quicker for the user, so it is the default. Nobody
 * should have to pick a network to buy or sell a stablecoin.
 */
const COST_RANK: Readonly<Record<string, number>> = {
  "solana-mainnet-beta": 1,
  "tron-mainnet": 2,
  "base-mainnet": 3,
  "arbitrum-one": 4,
  "polygon-mainnet": 5,
  "ethereum-mainnet": 9,
}

export function networkCostRank(networkId: string): number {
  return COST_RANK[networkId] ?? 6
}

/** The route to start from: the cheapest network, keeping the original order among equals. */
export function preferredRoute<T extends { network: string }>(routes: readonly T[]): T | undefined {
  let best: T | undefined
  for (const route of routes) {
    if (!best || networkCostRank(route.network) < networkCostRank(best.network)) best = route
  }
  return best
}
