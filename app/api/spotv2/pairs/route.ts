import { NextResponse } from "next/server"

// ── CoinMarketCap response types ─────────────────────────────────────────

interface CMCListing {
  id: number
  name: string
  symbol: string
  slug: string
  quote: {
    USD: {
      price: number
      percent_change_24h: number
      market_cap: number
      volume_24h: number
    }
  }
}

export interface SpotV2Pair {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  image: string
  displaySymbol: string
  chain: string
  contractAddress: string | null
}

const STABLECOINS = new Set([
  "usdt", "usdc", "dai", "busd", "tusd", "usdp", "usdd", "frax",
  "gusd", "lusd", "susd", "eur", "pyusd", "fdusd", "usde", "usds",
])

/**
 * Maps token symbol → best chain for trading (deepest liquidity).
 * Tokens not listed here default to "ethereum".
 */
const TOKEN_CHAIN_MAP: Record<string, { chain: string; address: string | null }> = {
  btc:  { chain: "ethereum", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" }, // WBTC
  eth:  { chain: "ethereum", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  sol:  { chain: "solana",   address: "So11111111111111111111111111111111111111112" },
  bnb:  { chain: "bsc",      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  xrp:  { chain: "bsc",      address: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE" },
  ada:  { chain: "bsc",      address: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" },
  doge: { chain: "bsc",      address: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  avax: { chain: "avalanche", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  dot:  { chain: "bsc",      address: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402" },
  link: { chain: "ethereum",  address: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  shib: { chain: "ethereum",  address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE" },
  trx:  { chain: "bsc",      address: "0xCE7de646e7208a4Ef112cb6ed5038FA6cC6b12e3" },
  ton:  { chain: "bsc",      address: "0x76A797A59Ba2C17726896976B7B3747BfD1d220f" },
  uni:  { chain: "ethereum",  address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
  matic: { chain: "polygon",  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  pol:  { chain: "polygon",   address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  arb:  { chain: "arbitrum",  address: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
  op:   { chain: "optimism",  address: "0x4200000000000000000000000000000000000042" },
  atom: { chain: "bsc",      address: "0x0Eb3a705fc54725037CC9e008bDede697f62F335" },
  near: { chain: "ethereum",  address: "0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4" },
  apt:  { chain: "bsc",      address: "0x0b079b33B6e72311c6BE245F9f660CC385029fc3" },
  fil:  { chain: "bsc",      address: "0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153" },
  aave: { chain: "ethereum",  address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
  mkr:  { chain: "ethereum",  address: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2" },
  crv:  { chain: "ethereum",  address: "0xD533a949740bb3306d119CC777fa900bA034cd52" },
  ldo:  { chain: "ethereum",  address: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32" },
  snx:  { chain: "ethereum",  address: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F" },
  comp: { chain: "ethereum",  address: "0xc00e94Cb662C3520282E6f5717214004A7f26888" },
  ape:  { chain: "ethereum",  address: "0x4d224452801ACEd8B2F0aebE155379bb5D594381" },
  pepe: { chain: "ethereum",  address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933" },
  wif:  { chain: "solana",    address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  bonk: { chain: "solana",    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  jup:  { chain: "solana",    address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  ray:  { chain: "solana",    address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
  aero: { chain: "base",      address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631" },
  gmx:  { chain: "arbitrum",  address: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a" },
}

// ── Hardcoded fallback (page never loads empty) ──────────────────────────

const FALLBACK_PAIRS: SpotV2Pair[] = [
  { id: "bitcoin",   symbol: "BTC",  name: "Bitcoin",   price: 87000,  change24h: 1.2,  marketCap: 1700e9, volume24h: 30e9,  image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png",    displaySymbol: "BTC/USDC",  chain: "ethereum",  contractAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
  { id: "ethereum",  symbol: "ETH",  name: "Ethereum",  price: 3200,   change24h: 0.8,  marketCap: 385e9,  volume24h: 15e9,  image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png", displaySymbol: "ETH/USDC",  chain: "ethereum",  contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "solana",    symbol: "SOL",  name: "Solana",    price: 140,    change24h: 2.5,  marketCap: 65e9,   volume24h: 3e9,   image: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png", displaySymbol: "SOL/USDC",  chain: "solana",    contractAddress: "So11111111111111111111111111111111111111112" },
  { id: "bnb",       symbol: "BNB",  name: "BNB",       price: 600,    change24h: 0.3,  marketCap: 90e9,   volume24h: 1.5e9, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png", displaySymbol: "BNB/USDC",  chain: "bsc",       contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "xrp",       symbol: "XRP",  name: "XRP",       price: 0.62,   change24h: -0.5, marketCap: 34e9,   volume24h: 1.2e9, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png",   displaySymbol: "XRP/USDC",  chain: "bsc",       contractAddress: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE" },
  { id: "cardano",   symbol: "ADA",  name: "Cardano",   price: 0.45,   change24h: 1.0,  marketCap: 16e9,   volume24h: 500e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png", displaySymbol: "ADA/USDC",  chain: "bsc",       contractAddress: "0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47" },
  { id: "dogecoin",  symbol: "DOGE", name: "Dogecoin",  price: 0.08,   change24h: -1.2, marketCap: 11e9,   volume24h: 600e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png",   displaySymbol: "DOGE/USDC", chain: "bsc",       contractAddress: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43" },
  { id: "avalanche", symbol: "AVAX", name: "Avalanche", price: 35,     change24h: 1.8,  marketCap: 14e9,   volume24h: 400e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/5805.png", displaySymbol: "AVAX/USDC", chain: "avalanche", contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "polkadot",  symbol: "DOT",  name: "Polkadot",  price: 7.5,    change24h: 0.6,  marketCap: 10e9,   volume24h: 300e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/6636.png", displaySymbol: "DOT/USDC",  chain: "bsc",       contractAddress: "0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink",  price: 15,     change24h: 2.1,  marketCap: 9e9,    volume24h: 500e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png", displaySymbol: "LINK/USDC", chain: "ethereum",  contractAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu",  price: 0.000012, change24h: -0.3, marketCap: 7e9, volume24h: 200e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/5994.png", displaySymbol: "SHIB/USDC", chain: "ethereum",  contractAddress: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE" },
  { id: "uniswap",   symbol: "UNI",  name: "Uniswap",   price: 9.5,    change24h: 1.5,  marketCap: 7e9,    volume24h: 200e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/7083.png", displaySymbol: "UNI/USDC",  chain: "ethereum",  contractAddress: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" },
  { id: "polygon",   symbol: "MATIC", name: "Polygon",   price: 0.55,   change24h: 0.4,  marketCap: 5e9,    volume24h: 300e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png", displaySymbol: "MATIC/USDC", chain: "polygon", contractAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
  { id: "arbitrum",  symbol: "ARB",  name: "Arbitrum",  price: 1.1,    change24h: 0.9,  marketCap: 4e9,    volume24h: 300e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png", displaySymbol: "ARB/USDC", chain: "arbitrum",  contractAddress: "0x912CE59144191C1204E64559FE8253a0e49E6548" },
  { id: "optimism",  symbol: "OP",   name: "Optimism",  price: 2.3,    change24h: 1.3,  marketCap: 3e9,    volume24h: 200e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png", displaySymbol: "OP/USDC",  chain: "optimism",  contractAddress: "0x4200000000000000000000000000000000000042" },
  { id: "cosmos",    symbol: "ATOM", name: "Cosmos",    price: 9.0,    change24h: -0.8, marketCap: 3.5e9,  volume24h: 150e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/3794.png", displaySymbol: "ATOM/USDC", chain: "bsc",       contractAddress: "0x0Eb3a705fc54725037CC9e008bDede697f62F335" },
  { id: "near",      symbol: "NEAR", name: "NEAR",      price: 5.5,    change24h: 2.0,  marketCap: 5.5e9,  volume24h: 250e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/6535.png", displaySymbol: "NEAR/USDC", chain: "ethereum",  contractAddress: "0x85F17Cf997934a597031b2E18a9aB6ebD4B9f6a4" },
  { id: "aptos",     symbol: "APT",  name: "Aptos",     price: 8.5,    change24h: 1.4,  marketCap: 3.5e9,  volume24h: 150e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/21794.png", displaySymbol: "APT/USDC", chain: "bsc",      contractAddress: "0x0b079b33B6e72311c6BE245F9f660CC385029fc3" },
  { id: "pepe",      symbol: "PEPE", name: "Pepe",      price: 0.0000012, change24h: 3.5, marketCap: 5e9,  volume24h: 800e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png", displaySymbol: "PEPE/USDC", chain: "ethereum", contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933" },
  { id: "aave",      symbol: "AAVE", name: "Aave",      price: 95,     change24h: 0.7,  marketCap: 1.4e9,  volume24h: 150e6, image: "https://s2.coinmarketcap.com/static/img/coins/64x64/7278.png", displaySymbol: "AAVE/USDC", chain: "ethereum",  contractAddress: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9" },
]

let cachedPairs: SpotV2Pair[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function resolveChain(symbol: string): { chain: string; address: string | null } {
  const mapping = TOKEN_CHAIN_MAP[symbol.toLowerCase()]
  if (mapping) return mapping
  return { chain: "ethereum", address: null }
}

/** Build CMC logo URL from their numeric coin ID */
function cmcImageUrl(cmcId: number): string {
  return `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`
}

export async function GET() {
  const now = Date.now()

  if (cachedPairs && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, pairs: cachedPairs })
  }

  try {
    const apiKey = process.env.CMC_API_KEY
    if (!apiKey) {
      // No API key — serve fallback
      return NextResponse.json({ success: true, pairs: FALLBACK_PAIRS, fallback: true })
    }

    const url = "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=150&convert=USD"
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-CMC_PRO_API_KEY": apiKey,
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      if (cachedPairs) {
        return NextResponse.json({ success: true, pairs: cachedPairs, stale: true })
      }
      return NextResponse.json({ success: true, pairs: FALLBACK_PAIRS, fallback: true })
    }

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

    return NextResponse.json({ success: true, pairs })
  } catch {
    if (cachedPairs) {
      return NextResponse.json({ success: true, pairs: cachedPairs, stale: true })
    }
    return NextResponse.json({ success: true, pairs: FALLBACK_PAIRS, fallback: true })
  }
}
