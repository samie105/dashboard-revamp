/**
 * Binance symbol mapping + DEXScreener URL helpers for SpotV2.
 */

// ── Binance symbol mapping ───────────────────────────────────────────────

const SYMBOL_OVERRIDES: Record<string, string> = {
  pol: "polusdt",
}

/** Convert a SpotV2 symbol (e.g. "BTC") to a Binance lowercase stream symbol ("btcusdt"). */
export function toBinanceSymbol(symbol: string): string {
  const lower = symbol.toLowerCase()
  return SYMBOL_OVERRIDES[lower] ?? `${lower}usdt`
}

// ── DEXScreener embed URL ────────────────────────────────────────────────

const DEXSCREENER_CHAINS: Record<string, string> = {
  ethereum: "ethereum",
  bsc: "bsc",
  solana: "solana",
  polygon: "polygon",
  avalanche: "avalanche",
  arbitrum: "arbitrum",
  base: "base",
  optimism: "optimism",
}

/** Native gas-token address → wrapped-token address, per chain. */
const NATIVE_TO_WRAPPED: Record<string, Record<string, string>> = {
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE": {
    ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    avalanche: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  },
}

/**
 * Build a DEXScreener embed URL for a given chain + contract.
 * Returns `null` when insufficient data to build a valid URL.
 */
export function getDexScreenerUrl(
  chain: string,
  contractAddress: string | null,
): string | null {
  if (!contractAddress) return null

  const chainSlug = DEXSCREENER_CHAINS[chain]
  if (!chainSlug) return null

  let address = contractAddress
  const nativeMapping = NATIVE_TO_WRAPPED[contractAddress]
  if (nativeMapping?.[chain]) {
    address = nativeMapping[chain]
  }

  return `https://dexscreener.com/${chainSlug}/${address}?embed=1&theme=dark&trades=0&info=0`
}
