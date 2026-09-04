/**
 * What a swap ticket is made of: the networks we route between, the tokens
 * each one can be quoted for, and the shape of the quote that comes back.
 *
 * All of this used to sit inside swap-client.tsx. It moved out when the ticket
 * grew a Pro mode, because the detail pane and the rate chart now read the
 * same constants — and a second copy of a token whitelist is a bug waiting for
 * someone to add a token to only one of them.
 */

export type SwapChainId = "ethereum" | "arbitrum" | "solana" | "sui" | "ton" | "tron"

export type SwapChain = {
  id: SwapChainId
  label: string
  icon: string
}

export const CHAINS: readonly SwapChain[] = [
  { id: "ethereum", label: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: "arbitrum", label: "Arbitrum", icon: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { id: "solana", label: "Solana", icon: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png" },
  { id: "sui", label: "Sui", icon: "https://coin-images.coingecko.com/coins/images/26375/small/sui_asset.jpeg" },
  { id: "ton", label: "Ton", icon: "https://coin-images.coingecko.com/coins/images/17980/small/toncoin.png" },
  { id: "tron", label: "Tron", icon: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png" },
]

const CHAIN_BY_ID = new Map<string, SwapChain>(CHAINS.map((chain) => [chain.id, chain]))

/**
 * A chain's display identity.
 *
 * Falls back to the raw id rather than throwing: the from/to pair can be set
 * from the query string, and an unknown value there should read oddly, not
 * blank the whole screen.
 */
export function chainMeta(id: string): SwapChain {
  return CHAIN_BY_ID.get(id) ?? { id: id as SwapChainId, label: id, icon: "" }
}

/** Swap chain → the id the balance feed files holdings under. */
export const BALANCE_NETWORK_ID: Record<string, string> = {
  ethereum: "ethereum-mainnet",
  arbitrum: "arbitrum-one",
  solana: "solana-mainnet-beta",
  sui: "sui-mainnet",
  ton: "ton-mainnet",
  tron: "tron-mainnet",
}

/**
 * The tokens each chain can be quoted for.
 *
 * A hard whitelist, not a hint. The quote endpoint is asked for a SYMBOL, and
 * a symbol it does not carry comes back as an error rather than a route — so
 * the ticket says "not available yet" up front instead of letting someone type
 * an amount into a pair that can never fill.
 */
export const SUPPORTED_SWAP_TOKENS: Record<string, string[]> = {
  ethereum: ["ETH", "USDT", "USDC"],
  arbitrum: ["ETH", "USDT", "USDC"],
  solana: ["SOL", "USDC", "USDT"],
  sui: ["SUI", "USDC", "USDT"],
  ton: ["TON", "USDT", "USDC"],
  tron: ["TRX", "USDT", "USDC"],
}

export type SwapAsset = {
  networkId: string
  chain: SwapChainId
  symbol: string
  kind: "native" | "token"
  /** Contract, mint, or chain-native sentinel. Never identify a token by symbol alone. */
  address: string
  decimals: number
  assetId: string
}

const nativeAsset = (chain: SwapChainId, symbol: string, decimals: number): SwapAsset => {
  const networkId = BALANCE_NETWORK_ID[chain]
  return { networkId, chain, symbol, kind: "native", address: "native", decimals, assetId: `${networkId}:${symbol}:native` }
}

const tokenAsset = (chain: SwapChainId, symbol: string, address: string, decimals: number): SwapAsset => {
  const networkId = BALANCE_NETWORK_ID[chain]
  return { networkId, chain, symbol, kind: "token", address, decimals, assetId: `${networkId}:${symbol}:${address.toLowerCase()}` }
}

/** Canonical chain-scoped identities shared by the swap UI and provider adapters. */
export const SWAP_ASSETS: readonly SwapAsset[] = [
  nativeAsset("ethereum", "ETH", 18),
  tokenAsset("ethereum", "USDC", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6),
  tokenAsset("ethereum", "USDT", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 6),
  nativeAsset("arbitrum", "ETH", 18),
  tokenAsset("arbitrum", "USDC", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6),
  tokenAsset("arbitrum", "USDT", "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", 6),
  nativeAsset("solana", "SOL", 9),
  tokenAsset("solana", "USDC", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 6),
  tokenAsset("solana", "USDT", "Es9vMFrzaCERmJfrF4H2FYD4QfTQJw5u9M8S1jJfV8", 6),
  nativeAsset("sui", "SUI", 9),
  nativeAsset("ton", "TON", 9),
  tokenAsset("ton", "USDT", "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", 6),
  nativeAsset("tron", "TRX", 6),
  tokenAsset("tron", "USDT", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", 6),
]

const SWAP_ASSET_BY_KEY = new Map(SWAP_ASSETS.map((asset) => [`${asset.networkId}:${asset.symbol.toUpperCase()}`, asset]))

export function swapAssetForToken(chain: string, symbol: string): SwapAsset | undefined {
  const networkId = BALANCE_NETWORK_ID[chain]
  return networkId ? SWAP_ASSET_BY_KEY.get(`${networkId}:${symbol.toUpperCase()}`) : undefined
}

/** Return only assets that belong to the selected chain. */
export function tokensForChain<T extends { symbol: string }>(chain: string, coins: readonly T[]): T[] {
  const supported = new Set((SUPPORTED_SWAP_TOKENS[chain] ?? []).map((symbol) => symbol.toUpperCase()))
  return coins.filter((coin) => supported.has(coin.symbol.toUpperCase()))
}

/**
 * The chains a swap can actually execute on.
 *
 * TON is intentionally excluded because the configured swap router does not
 * support it. TRON is included because LI.FI supports TRON routes.
 */
export const ROUTABLE_CHAINS = ["ethereum", "arbitrum", "solana", "sui", "tron"] as const
export type RoutableChain = (typeof ROUTABLE_CHAINS)[number]

export type ModernNetworkId =
  | "ethereum-mainnet"
  | "arbitrum-one"
  | "solana-mainnet-beta"
  | "sui-mainnet"
  | "ton-mainnet"
  | "tron-mainnet"

export function isRoutable(chain: string): chain is RoutableChain {
  return (ROUTABLE_CHAINS as readonly string[]).includes(chain)
}

export type SwapRouterId = "lifi" | "0x" | "omniston" | null

/**
 * UI capability must match an executable backend route. TON remains visible
 * for balances, but it must never be sent through the LI.FI quote path.
 */
export function routerForPair(from: string, to: string): SwapRouterId {
  if (isRoutable(from) && isRoutable(to)) return "lifi"
  return null
}

export function unavailablePairMessage(from: string, to: string): string {
  const fromLabel = chainMeta(from).label
  const toLabel = chainMeta(to).label
  if (from === "ton" || to === "ton") return `${fromLabel} → ${toLabel} is not available yet. TON swaps are not supported.`
  return `${fromLabel} → ${toLabel} is not available yet.`
}

export function networkIdFor(chain: SwapChainId): ModernNetworkId {
  switch (chain) {
    case "ethereum":
      return "ethereum-mainnet"
    case "arbitrum":
      return "arbitrum-one"
    case "solana":
      return "solana-mainnet-beta"
    case "sui":
      return "sui-mainnet"
    case "ton":
      return "ton-mainnet"
    case "tron":
      return "tron-mainnet"
  }
}

/** Which signing family a chain belongs to, for the intent the wallet approves. */
export function familyFor(chain: SwapChainId): "evm" | "solana" | "sui" | "ton" | "tron" {
  return chain === "solana" ? "solana" : chain === "sui" ? "sui" : chain === "ton" ? "ton" : chain === "tron" ? "tron" : "evm"
}

/**
 * The quote, exactly as the routing service returns it.
 *
 * Everything Pro shows is a field on this object or arithmetic over two of
 * them. Nothing on the detail pane is estimated on the client — a made-up
 * route or a guessed price impact on a money screen is worse than a blank.
 */
export interface QuoteData {
  toAmount: string
  toAmountMin: string
  toAmountUSD: string
  fromAmountUSD: string
  /**
   * Price impact, as a PERCENT.
   *
   * The unit is the frontend's long-standing reading of this field — the dev
   * mock encodes 0.12 as "0.12%" and the ticket has always rendered it that
   * way. If the live service ever switches to a fraction this is the one line
   * to change, and the row would read 0.00% until it is.
   */
  priceImpact: number
  gasCostUSD: string
  /** The venue the swap fills on, e.g. "1inch", "jupiter". */
  tool: string
  toolLogoURI?: string
  executionData: Record<string, unknown> | null
  fromToken: { chainId: number; address: string; symbol: string; decimals: number }
  toToken: { chainId: number; address: string; symbol: string; decimals: number }
}

/**
 * A base-unit integer string as a human quantity.
 *
 * Returns null rather than NaN when the feed hands back something unusable, so
 * callers omit the row instead of printing a broken figure — the rule lib/num
 * encodes, applied at the edge where the string arrives.
 */
export function fromBaseUnits(raw: string | undefined | null, decimals: number): number | null {
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isFinite(decimals)) return null
  const value = n / 10 ** decimals
  return Number.isFinite(value) ? value : null
}

/**
 * How long a quote is trusted before it is fetched again.
 *
 * Thirty seconds is short enough that the number on screen is the number that
 * fills, and long enough that someone reading the detail pane is not chasing a
 * figure that moves while they read it. Both modes refresh on this clock; only
 * Pro is shown the countdown.
 */
export const QUOTE_TTL_SECONDS = 30

/**
 * The slippage Simple swaps at.
 *
 * Simple has no slippage control, which is not the same as having no slippage
 * protection. Half a percent is the house default, it is sent with every quote
 * and every intent, and the ticket says in plain words what it does.
 */
export const HOUSE_SLIPPAGE = 0.5
