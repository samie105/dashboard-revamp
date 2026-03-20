import type { SpotV2Pair } from "@/components/spotv2/spotv2-types"

// ── Static fallback data (page never loads empty) ────────────────────────

const STABLECOINS = new Set([
  "usdt", "usdc", "dai", "busd", "tusd", "usdp", "usdd", "frax",
  "gusd", "lusd", "susd", "eur", "pyusd", "fdusd", "usde", "usds",
])

const TOKEN_CHAIN_MAP: Record<string, { chain: string; address: string | null }> = {
  btc:  { chain: "ethereum", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  eth:  { chain: "ethereum", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  sol:  { chain: "solana",   address: "So11111111111111111111111111111111111111112" },
  bnb:  { chain: "bsc",      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  xrp:  { chain: "bsc",      address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE" },
  ada:  { chain: "bsc",      address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" },
  doge: { chain: "bsc",      address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  avax: { chain: "avalanche", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  link: { chain: "ethereum",  address: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  shib: { chain: "ethereum",  address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE" },
  uni:  { chain: "ethereum",  address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
  matic: { chain: "polygon",  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  pol:  { chain: "polygon",   address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  arb:  { chain: "arbitrum",  address: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
  op:   { chain: "optimism",  address: "0x4200000000000000000000000000000000000042" },
  pepe: { chain: "ethereum",  address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933" },
  aave: { chain: "ethereum",  address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
}

function resolveChain(symbol: string): { chain: string; address: string | null } {
  return TOKEN_CHAIN_MAP[symbol.toLowerCase()] ?? { chain: "ethereum", address: null }
}

function cmcImageUrl(cmcId: number): string {
  return `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`
}

export const FALLBACK_PAIRS: SpotV2Pair[] = [
  { id: "bitcoin",   symbol: "BTC",  name: "Bitcoin",   price: 87000,  change24h: 1.2,  marketCap: 1700e9, volume24h: 30e9,  image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",    displaySymbol: "BTC/USDC",  chain: "ethereum",  contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  { id: "ethereum",  symbol: "ETH",  name: "Ethereum",  price: 3200,   change24h: 0.8,  marketCap: 385e9,  volume24h: 15e9,  image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png", displaySymbol: "ETH/USDC",  chain: "ethereum",  contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "solana",    symbol: "SOL",  name: "Solana",    price: 140,    change24h: 2.5,  marketCap: 65e9,   volume24h: 3e9,   image: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png", displaySymbol: "SOL/USDC",  chain: "solana",    contractAddress: "So11111111111111111111111111111111111111112" },
  { id: "bnb",       symbol: "BNB",  name: "BNB",       price: 600,    change24h: 0.3,  marketCap: 90e9,   volume24h: 1.5e9, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png", displaySymbol: "BNB/USDC",  chain: "bsc",       contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "xrp",       symbol: "XRP",  name: "XRP",       price: 0.62,   change24h: -0.5, marketCap: 34e9,   volume24h: 1.2e9, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png",   displaySymbol: "XRP/USDC",  chain: "bsc",       contractAddress: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE" },
  { id: "cardano",   symbol: "ADA",  name: "Cardano",   price: 0.45,   change24h: 1.0,  marketCap: 16e9,   volume24h: 500e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png", displaySymbol: "ADA/USDC",  chain: "bsc",       contractAddress: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" },
  { id: "dogecoin",  symbol: "DOGE", name: "Dogecoin",  price: 0.08,   change24h: -1.2, marketCap: 11e9,   volume24h: 600e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png",   displaySymbol: "DOGE/USDC", chain: "bsc",       contractAddress: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  { id: "avalanche", symbol: "AVAX", name: "Avalanche", price: 35,     change24h: 1.8,  marketCap: 14e9,   volume24h: 400e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png", displaySymbol: "AVAX/USDC", chain: "avalanche", contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink",  price: 15,     change24h: 2.1,  marketCap: 9e9,    volume24h: 500e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png", displaySymbol: "LINK/USDC", chain: "ethereum",  contractAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu",  price: 0.000012, change24h: -0.3, marketCap: 7e9, volume24h: 200e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/5994.png", displaySymbol: "SHIB/USDC", chain: "ethereum",  contractAddress: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE" },
  { id: "uniswap",   symbol: "UNI",  name: "Uniswap",   price: 9.5,    change24h: 1.5,  marketCap: 7e9,    volume24h: 200e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/7083.png", displaySymbol: "UNI/USDC",  chain: "ethereum",  contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
  { id: "polygon",   symbol: "MATIC", name: "Polygon",   price: 0.55,   change24h: 0.4,  marketCap: 5e9,    volume24h: 300e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png", displaySymbol: "MATIC/USDC", chain: "polygon", contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "arbitrum",  symbol: "ARB",  name: "Arbitrum",  price: 1.1,    change24h: 0.9,  marketCap: 4e9,    volume24h: 300e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png", displaySymbol: "ARB/USDC", chain: "arbitrum",  contractAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
  { id: "optimism",  symbol: "OP",   name: "Optimism",  price: 2.3,    change24h: 1.3,  marketCap: 3e9,    volume24h: 200e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png", displaySymbol: "OP/USDC",  chain: "optimism",  contractAddress: "0x4200000000000000000000000000000000000042" },
  { id: "pepe",      symbol: "PEPE", name: "Pepe",      price: 0.0000012, change24h: 3.5, marketCap: 5e9,  volume24h: 800e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png", displaySymbol: "PEPE/USDC", chain: "ethereum", contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933" },
  { id: "aave",      symbol: "AAVE", name: "Aave",      price: 95,     change24h: 0.7,  marketCap: 1.4e9,  volume24h: 150e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/7278.png", displaySymbol: "AAVE/USDC", chain: "ethereum",  contractAddress: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
]

// ── Server-side cache ────────────────────────────────────────────────────

interface CMCListing {
  id: number
  name: string
  symbol: string
  slug: string
  quote: { USD: { price: number; percent_change_24h: number; market_cap: number; volume_24h: number } }
}

let cachedPairs: SpotV2Pair[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Fetch pairs directly from CoinMarketCap API.
 * Can be called from server components or API routes without self-fetch.
 */
export async function fetchSpotV2Pairs(): Promise<SpotV2Pair[]> {
  const now = Date.now()
  if (cachedPairs && now - cacheTimestamp < CACHE_TTL) {
    return cachedPairs
  }

  const apiKey = process.env.CMC_API_KEY
  if (!apiKey) return FALLBACK_PAIRS

  try {
    const res = await fetch(
      "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=150&convert=USD",
      {
        headers: { Accept: "application/json", "X-CMC_PRO_API_KEY": apiKey },
        signal: AbortSignal.timeout(8_000),
      },
    )

    if (!res.ok) return cachedPairs ?? FALLBACK_PAIRS

    const json = await res.json()
    const listings: CMCListing[] = json.data ?? []

    const pairs: SpotV2Pair[] = listings
      .filter((c) => !STABLECOINS.has(c.symbol.toLowerCase()))
      .slice(0, 100)
      .map((c) => {
        const { chain, address } = resolveChain(c.symbol)
        return {
          id: c.slug,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          price: c.quote.USD.price,
          change24h: c.quote.USD.percent_change_24h ?? 0,
          marketCap: c.quote.USD.market_cap,
          volume24h: c.quote.USD.volume_24h,
          image: cmcImageUrl(c.id),
          displaySymbol: `${c.symbol.toUpperCase()}/USDC`,
          chain,
          contractAddress: address,
        }
      })

    cachedPairs = pairs
    cacheTimestamp = now
    return pairs
  } catch {
    return cachedPairs ?? FALLBACK_PAIRS
  }
}
