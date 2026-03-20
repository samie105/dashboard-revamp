import { NextResponse } from "next/server"

interface CoingeckoMarket {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number | null
  market_cap: number
  total_volume: number
  image: string
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

let cachedPairs: SpotV2Pair[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function resolveChain(symbol: string): { chain: string; address: string | null } {
  const mapping = TOKEN_CHAIN_MAP[symbol.toLowerCase()]
  if (mapping) return mapping
  return { chain: "ethereum", address: null }
}

export async function GET() {
  const now = Date.now()

  if (cachedPairs && now - cacheTimestamp < CACHE_TTL) {
    return NextResponse.json({ success: true, pairs: cachedPairs })
  }

  try {
    const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1&sparkline=false&price_change_percentage=24h"
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(process.env.COINGECKO_API_KEY
          ? { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY }
          : {}),
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      if (cachedPairs) {
        return NextResponse.json({ success: true, pairs: cachedPairs, stale: true })
      }
      return NextResponse.json(
        { success: false, error: "Failed to fetch market data" },
        { status: 502 },
      )
    }

    const markets: CoingeckoMarket[] = await res.json()

    const pairs: SpotV2Pair[] = markets
      .filter((c) => !STABLECOINS.has(c.symbol.toLowerCase()))
      .slice(0, 100)
      .map((c) => {
        const { chain, address } = resolveChain(c.symbol)
        return {
          id: c.id,
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          price: c.current_price,
          change24h: c.price_change_percentage_24h ?? 0,
          marketCap: c.market_cap,
          volume24h: c.total_volume,
          image: c.image,
          displaySymbol: `${c.symbol.toUpperCase()}/USDC`,
          chain,
          contractAddress: address,
        }
      })

    cachedPairs = pairs
    cacheTimestamp = now

    return NextResponse.json({ success: true, pairs })
  } catch (error) {
    if (cachedPairs) {
      return NextResponse.json({ success: true, pairs: cachedPairs, stale: true })
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    )
  }
}
