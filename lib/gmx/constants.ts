// GMX v2 constants — chain IDs, contract addresses, token addresses

/** Arbitrum One chain ID */
export const ARBITRUM_CHAIN_ID = 42161

/** Arbitrum Sepolia testnet chain ID */
export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614

/** GMX v2 ExchangeRouter on Arbitrum One */
export const GMX_EXCHANGE_ROUTER = "0x1C3fa76e6E1088bBCE750f23a5BFcffa1efEF6A41"

/** Common token addresses on Arbitrum One */
export const ARBITRUM_TOKENS = {
  USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  USDCe: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
  USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548",
  LINK: "0xf97f4df75117a78c1A5a0DBb814Af74058539F05",
  UNI: "0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0",
} as const

/** GMX-supported interval strings */
export const GMX_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const
export type GmxInterval = (typeof GMX_INTERVALS)[number]
