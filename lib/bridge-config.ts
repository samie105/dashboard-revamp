// Shared bridge configuration — importable from both client and server

export const BRIDGE_CHAINS = [
  { id: 1, name: "Ethereum", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { id: 42161, name: "Arbitrum", icon: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg" },
  { id: 137, name: "Polygon", icon: "https://coin-images.coingecko.com/coins/images/4713/small/polygon.png" },
  { id: 10, name: "Optimism", icon: "https://coin-images.coingecko.com/coins/images/25244/small/Optimism.png" },
  { id: 56, name: "BSC", icon: "https://coin-images.coingecko.com/coins/images/825/small/bnb-icon2_2x.png" },
  { id: 8453, name: "Base", icon: "https://coin-images.coingecko.com/coins/images/31164/small/base.png" },
] as const

export const BRIDGE_TOKENS = [
  { symbol: "ETH", name: "Ethereum", decimals: 18, address: "0x0000000000000000000000000000000000000000", icon: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png" },
  { symbol: "USDC", name: "USD Coin", decimals: 6, address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", icon: "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png" },
  { symbol: "USDT", name: "Tether", decimals: 6, address: "0xdac17f958d2ee523a2206206994597c13d831ec7", icon: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png" },
] as const

export const CHAIN_TOKEN_MAP: Record<number, Record<string, string>> = {
  1: {
    USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    ETH: "0x0000000000000000000000000000000000000000",
  },
  42161: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    ETH: "0x0000000000000000000000000000000000000000",
  },
  137: {
    USDC: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    USDT: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f",
    ETH: "0x7ceb23fd6bc0ad59e62c25392b3204ee7007f3dd",
  },
  10: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    ETH: "0x0000000000000000000000000000000000000000",
  },
  56: {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    ETH: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
  },
  8453: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    ETH: "0x0000000000000000000000000000000000000000",
  },
}
