type ChainType = "ethereum" | "solana" | "tron" | "sui" | "ton"

const SPONSORED_CHAINS: Set<ChainType> = new Set(["ethereum", "solana"])

/**
 * Determines whether a transaction on the given chain should be gas-sponsored.
 * Respects the GAS_SPONSORSHIP_ENABLED env var as a global kill switch.
 */
export function shouldSponsor(chainType: ChainType): boolean {
  if (process.env.GAS_SPONSORSHIP_ENABLED === "false") return false
  return SPONSORED_CHAINS.has(chainType)
}
