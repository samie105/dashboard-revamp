import { NETWORKS, type NetworkMeta } from "@/lib/networks"
import type { CryptoNetwork } from "./types"

/** Known backend network ids → display registry keys. Unknown ids stay unknown
 *  (render no explorer link) rather than guessing a wrong chain. */
const BACKEND_NETWORK_KEY: Record<string, string> = {
  "ethereum-mainnet": "ethereum",
  "arbitrum-one": "arbitrum",
  "solana-mainnet-beta": "solana",
  "sui-mainnet": "sui",
  "ton-mainnet": "ton",
  "tron-mainnet": "tron",
}

const CHAIN_ID_KEY: Record<number, string> = { 1: "ethereum", 42161: "arbitrum" }

export function networkMetaFor(backendNetworkId: string, networks?: CryptoNetwork[]): NetworkMeta | null {
  let key: string | undefined = BACKEND_NETWORK_KEY[backendNetworkId]
  if (!key && networks) {
    const live = networks.find((n) => n.id === backendNetworkId)
    if (live?.family === "evm" && live.chainId != null) key = CHAIN_ID_KEY[live.chainId]
    else if (live?.family === "solana") key = "solana"
    else if (live?.family === "sui") key = "sui"
    else if (live?.family === "ton") key = "ton"
    else if (live?.family === "tron") key = "tron"
  }
  return key ? NETWORKS.find((n) => n.key === key) ?? null : null
}

export function explorerTxUrl(backendNetworkId: string, txHash: string, networks?: CryptoNetwork[]): string | null {
  const meta = networkMetaFor(backendNetworkId, networks)
  return meta ? meta.txUrl(txHash) : null
}
