"use server"

// ── Types ──────────────────────────────────────────────────────────────────

export interface CoinData {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  image: string
  /** Quote asset for spot markets (e.g. "USDC") */
  quoteAsset?: string
  /** Hyperliquid size decimals */
  szDecimals?: number
  /** Internal Hyperliquid spot coin name (e.g. "PURR/USDC", "@107") */
  hlName?: string
}

export interface PricesResponse {
  prices: Record<string, number>
  coins: CoinData[]
  globalStats: {
    totalMarketCap: number
    totalVolume: number
    btcDominance: number
    marketCapChange24h: number
  }
  fetchedAt: number
  error?: string
}

export interface TradeResult {
  id: string
  price: string
  amount: string
  side: "buy" | "sell"
  time: number
}

export interface TradesResponse {
  success: boolean
  source?: string
  data: TradeResult[]
  error?: string
}

// ── CoinGecko mapping ──────────────────────────────────────────────────────

const CORE_COINS = [
  "bitcoin",
  "ethereum",
  "solana",
  "tron",
  "toncoin",
  "tether",
  "usd-coin",
]

const MARKET_COINS = [
  "ripple",
  "cardano",
  "dogecoin",
  "polkadot",
  "chainlink",
  "avalanche-2",
  "polygon-matic-token",
  "litecoin",
  "uniswap",
  "stellar",
  "cosmos",
  "near",
  "aptos",
  "sui",
  "arbitrum",
  "optimism",
  "filecoin",
  "pepe",
  "worldcoin-wld",
  "injective-protocol",
  "sei-network",
  "celestia",
  "jupiter-exchange-solana",
  "render-token",
  "artificial-superintelligence-alliance",
  "dogwifcoin",
  "ondo-finance",
  "pendle",
  "ethena",
]

const ALL_COIN_IDS = [...CORE_COINS, ...MARKET_COINS]

const ID_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  tron: "TRX",
  toncoin: "TON",
  tether: "USDT",
  "usd-coin": "USDC",
  ripple: "XRP",
  cardano: "ADA",
  dogecoin: "DOGE",
  polkadot: "DOT",
  chainlink: "LINK",
  "avalanche-2": "AVAX",
  "polygon-matic-token": "MATIC",
  litecoin: "LTC",
  uniswap: "UNI",
  stellar: "XLM",
  cosmos: "ATOM",
  near: "NEAR",
  aptos: "APT",
  sui: "SUI",
  arbitrum: "ARB",
  optimism: "OP",
  filecoin: "FIL",
  pepe: "PEPE",
  "worldcoin-wld": "WLD",
  "injective-protocol": "INJ",
  "sei-network": "SEI",
  celestia: "TIA",
  "jupiter-exchange-solana": "JUP",
  "render-token": "RENDER",
  "artificial-superintelligence-alliance": "FET",
  dogwifcoin: "WIF",
  "ondo-finance": "ONDO",
  pendle: "PENDLE",
  ethena: "ENA",
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  SHIB: "shiba-inu",
  LTC: "litecoin",
  UNI: "uniswap",
  ATOM: "cosmos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  NEAR: "near",
  FIL: "filecoin",
  APT: "aptos",
  TRX: "tron",
  PEPE: "pepe",
  TON: "toncoin",
  XLM: "stellar",
  WLD: "worldcoin-wld",
  INJ: "injective-protocol",
  SEI: "sei-network",
  TIA: "celestia",
  JUP: "jupiter-exchange-solana",
  RENDER: "render-token",
  FET: "artificial-superintelligence-alliance",
  WIF: "dogwifcoin",
  ONDO: "ondo-finance",
  PENDLE: "pendle",
  ENA: "ethena",
}

// ── KuCoin symbol mapping ──────────────────────────────────────────────────

const KUCOIN_SYMBOLS: Record<string, string> = {
  bitcoin: "BTC-USDT",
  ethereum: "ETH-USDT",
  solana: "SOL-USDT",
  tron: "TRX-USDT",
  toncoin: "TON-USDT",
  ripple: "XRP-USDT",
  cardano: "ADA-USDT",
  dogecoin: "DOGE-USDT",
  polkadot: "DOT-USDT",
  chainlink: "LINK-USDT",
  "avalanche-2": "AVAX-USDT",
  "polygon-matic-token": "MATIC-USDT",
  litecoin: "LTC-USDT",
  uniswap: "UNI-USDT",
  stellar: "XLM-USDT",
  cosmos: "ATOM-USDT",
  near: "NEAR-USDT",
  aptos: "APT-USDT",
  sui: "SUI-USDT",
  arbitrum: "ARB-USDT",
  optimism: "OP-USDT",
  filecoin: "FIL-USDT",
  pepe: "PEPE-USDT",
  "worldcoin-wld": "WLD-USDT",
  "injective-protocol": "INJ-USDT",
  "sei-network": "SEI-USDT",
  celestia: "TIA-USDT",
  "jupiter-exchange-solana": "JUP-USDT",
  "render-token": "RENDER-USDT",
  "artificial-superintelligence-alliance": "FET-USDT",
  dogwifcoin: "WIF-USDT",
  "ondo-finance": "ONDO-USDT",
  pendle: "PENDLE-USDT",
  ethena: "ENA-USDT",
}

const COIN_NAMES: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
  tron: "TRON",
  toncoin: "Toncoin",
  tether: "Tether",
  "usd-coin": "USD Coin",
  ripple: "XRP",
  cardano: "Cardano",
  dogecoin: "Dogecoin",
  polkadot: "Polkadot",
  chainlink: "Chainlink",
  "avalanche-2": "Avalanche",
  "polygon-matic-token": "Polygon",
  litecoin: "Litecoin",
  uniswap: "Uniswap",
  stellar: "Stellar",
  cosmos: "Cosmos",
  near: "NEAR Protocol",
  aptos: "Aptos",
  sui: "Sui",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  filecoin: "Filecoin",
  pepe: "Pepe",
  "worldcoin-wld": "Worldcoin",
  "injective-protocol": "Injective",
  "sei-network": "Sei",
  celestia: "Celestia",
  "jupiter-exchange-solana": "Jupiter",
  "render-token": "Render",
  "artificial-superintelligence-alliance": "FET",
  dogwifcoin: "dogwifhat",
  "ondo-finance": "Ondo",
  pendle: "Pendle",
  ethena: "Ethena",
}

const COIN_IMAGES: Record<string, string> = {
  bitcoin: "https://coin-images.coingecko.com/coins/images/1/small/bitcoin.png",
  ethereum: "https://coin-images.coingecko.com/coins/images/279/small/ethereum.png",
  solana: "https://coin-images.coingecko.com/coins/images/4128/small/solana.png",
  tron: "https://coin-images.coingecko.com/coins/images/1094/small/tron-logo.png",
  toncoin: "https://coin-images.coingecko.com/coins/images/17980/small/ton_symbol.png",
  tether: "https://coin-images.coingecko.com/coins/images/325/small/Tether.png",
  "usd-coin": "https://coin-images.coingecko.com/coins/images/6319/small/usdc.png",
  ripple: "https://coin-images.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png",
  cardano: "https://coin-images.coingecko.com/coins/images/975/small/cardano.png",
  dogecoin: "https://coin-images.coingecko.com/coins/images/5/small/dogecoin.png",
  polkadot: "https://coin-images.coingecko.com/coins/images/12171/small/polkadot.png",
  chainlink: "https://coin-images.coingecko.com/coins/images/877/small/chainlink-new-logo.png",
  "avalanche-2": "https://coin-images.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png",
  "polygon-matic-token": "https://coin-images.coingecko.com/coins/images/4713/small/polygon.png",
  litecoin: "https://coin-images.coingecko.com/coins/images/2/small/litecoin.png",
  uniswap: "https://coin-images.coingecko.com/coins/images/12504/small/uniswap-logo.png",
  stellar: "https://coin-images.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png",
  cosmos: "https://coin-images.coingecko.com/coins/images/1481/small/cosmos_hub.png",
  near: "https://coin-images.coingecko.com/coins/images/10365/small/near.jpg",
  aptos: "https://coin-images.coingecko.com/coins/images/26455/small/aptos_round.png",
  sui: "https://coin-images.coingecko.com/coins/images/26375/small/sui-ocean-square.png",
  arbitrum: "https://coin-images.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg",
  optimism: "https://coin-images.coingecko.com/coins/images/25244/small/Optimism.png",
  filecoin: "https://coin-images.coingecko.com/coins/images/12817/small/filecoin.png",
  pepe: "https://coin-images.coingecko.com/coins/images/29850/small/pepe-token.jpeg",
  "worldcoin-wld": "https://coin-images.coingecko.com/coins/images/31069/small/worldcoin.jpeg",
  "injective-protocol": "https://coin-images.coingecko.com/coins/images/12882/small/Secondary_Symbol.png",
  "sei-network": "https://coin-images.coingecko.com/coins/images/28205/small/Sei_Logo_-_Transparent.png",
  celestia: "https://coin-images.coingecko.com/coins/images/31967/small/tia.jpg",
  "jupiter-exchange-solana": "https://coin-images.coingecko.com/coins/images/34188/small/jup.png",
  "render-token": "https://coin-images.coingecko.com/coins/images/11636/small/rndr.png",
  "artificial-superintelligence-alliance": "https://coin-images.coingecko.com/coins/images/5681/small/Fetch.jpg",
  dogwifcoin: "https://coin-images.coingecko.com/coins/images/33566/small/dogwifhat.jpg",
  "ondo-finance": "https://coin-images.coingecko.com/coins/images/26580/small/ONDO.png",
  pendle: "https://coin-images.coingecko.com/coins/images/15069/small/Pendle_Logo_Normal-03.png",
  ethena: "https://coin-images.coingecko.com/coins/images/36530/small/ethena.png",
}

// ── In-memory cache (server-side only, lives per worker) ───────────────────

// Reverse lookup: symbol → image (built from existing maps + HL-native tokens)
const SYMBOL_IMAGE: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const [coinId, sym] of Object.entries(ID_TO_SYMBOL)) {
    if (COIN_IMAGES[coinId]) map[sym] = COIN_IMAGES[coinId]
  }
  // HL-native spot tokens not in CoinGecko map
  map["PURR"] = "https://coin-images.coingecko.com/coins/images/36839/small/purr.jpg"
  map["HFUN"] = "https://app.hyperliquid.xyz/icons/HFUN.svg"
  map["JEFF"] = "https://app.hyperliquid.xyz/icons/JEFF.svg"
  map["FARM"] = "https://app.hyperliquid.xyz/icons/FARM.svg"
  map["ANIME"] = "https://coin-images.coingecko.com/coins/images/53407/small/anime.png"
  map["PIP"] = "https://app.hyperliquid.xyz/icons/PIP.svg"
  map["HYPE"] = "https://coin-images.coingecko.com/coins/images/40428/small/hype.png"
  map["LQNA"] = "https://app.hyperliquid.xyz/icons/LQNA.svg"
  map["GOD"] = "https://app.hyperliquid.xyz/icons/GOD.svg"
  map["BUDDY"] = "https://app.hyperliquid.xyz/icons/BUDDY.svg"
  map["CATBAL"] = "https://app.hyperliquid.xyz/icons/CATBAL.svg"
  map["BEAR"] = "https://app.hyperliquid.xyz/icons/BEAR.svg"
  map["RAGE"] = "https://app.hyperliquid.xyz/icons/RAGE.svg"
  map["SOLV"] = "https://coin-images.coingecko.com/coins/images/38082/small/solv.png"
  map["USDT0"] = "https://coin-images.coingecko.com/coins/images/325/small/Tether.png"
  map["STBT"] = "https://app.hyperliquid.xyz/icons/STBT.svg"
  return map
})()

// Reverse lookup: symbol → name
const SYMBOL_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const [coinId, sym] of Object.entries(ID_TO_SYMBOL)) {
    if (COIN_NAMES[coinId]) map[sym] = COIN_NAMES[coinId]
  }
  map["PURR"] = "Purr"
  map["HFUN"] = "HyperFun"
  map["JEFF"] = "Jeff"
  map["FARM"] = "Farm"
  map["ANIME"] = "Anime"
  map["PIP"] = "Pip"
  map["HYPE"] = "Hyperliquid"
  map["LQNA"] = "Liqna"
  map["GOD"] = "God"
  map["BUDDY"] = "Buddy"
  map["CATBAL"] = "Catbal"
  map["BEAR"] = "Bear"
  map["USDT0"] = "USDT0"
  return map
})()

/** Ensure plain JSON for server action serialization (avoids DATA_CLONE_ERR) */
function sanitize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

let priceCache: PricesResponse | null = null
let priceCacheTs = 0
let backoffUntil = 0
const PRICE_TTL = 5 * 60_000
const BACKOFF_MS = 90_000

const tradeCache = new Map<string, { data: TradesResponse; ts: number }>()
const TRADE_TTL = 30_000

// ── Hyperliquid REST API ───────────────────────────────────────────────────

const HL_INFO = "https://api.hyperliquid.xyz/info"

async function hlPost(body: Record<string, unknown>) {
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Hyperliquid ${res.status}`)
  return res.json()
}

/** Fetch all mid prices from Hyperliquid (fast — single POST) */
async function fetchHyperliquidPrices(): Promise<PricesResponse | null> {
  try {
    const [meta, mids] = await Promise.all([
      hlPost({ type: "meta" }),
      hlPost({ type: "allMids" }),
    ])

    const universe = meta?.universe as { name: string; szDecimals: number }[] | undefined
    if (!universe || !mids) return null

    const prices: Record<string, number> = { USDT: 1, USDC: 1 }
    const coins: CoinData[] = []

    for (const asset of universe) {
      const sym = asset.name.toUpperCase()
      const mid = parseFloat(mids[asset.name] ?? mids[sym] ?? "0")
      if (mid <= 0) continue

      // Only include coins we know about
      const coinId = Object.entries(ID_TO_SYMBOL).find(([, s]) => s === sym)?.[0]
      if (!coinId) continue

      prices[sym] = mid
      coins.push({
        id: coinId,
        symbol: sym,
        name: COIN_NAMES[coinId] || sym,
        price: mid,
        change24h: 0, // Hyperliquid allMids doesn't include 24h change
        marketCap: 0,
        volume24h: 0,
        image: COIN_IMAGES[coinId] || "",
      })
    }

    if (coins.length === 0) return null

    // Add stablecoins
    if (!coins.find((c) => c.symbol === "USDT")) {
      coins.push({ id: "tether", symbol: "USDT", name: "Tether", price: 1, change24h: 0, marketCap: 0, volume24h: 0, image: COIN_IMAGES.tether || "" })
    }
    if (!coins.find((c) => c.symbol === "USDC")) {
      coins.push({ id: "usd-coin", symbol: "USDC", name: "USD Coin", price: 1, change24h: 0, marketCap: 0, volume24h: 0, image: COIN_IMAGES["usd-coin"] || "" })
    }

    return {
      prices,
      coins,
      globalStats: { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, marketCapChange24h: 0 },
      fetchedAt: Date.now(),
    }
  } catch (error) {
    console.error("[Hyperliquid] price fetch error:", error)
    return null
  }
}

/** Fetch L2 order book from Hyperliquid (fast — single POST) */
async function fetchHyperliquidOrderBook(
  symbol: string,
  limit: number,
): Promise<OrderBookResponse | null> {
  try {
    // Hyperliquid uses plain symbol like "BTC", "ETH"
    const upper = symbol.replace("/", "").replace("-", "").replace("_", "").toUpperCase()
    const quoteMatch = upper.match(/(USDT|USDC|USD)$/)
    const base = quoteMatch ? upper.slice(0, upper.length - quoteMatch[0].length) : upper

    const data = await hlPost({ type: "l2Book", coin: base })
    if (!data?.levels || data.levels.length < 2) return null

    const [rawBids, rawAsks] = data.levels

    let askTotal = 0
    const asks: OrderBookLevel[] = (rawAsks as { px: string; sz: string; n: number }[])
      .slice(0, limit)
      .map((l) => {
        askTotal += parseFloat(l.sz)
        return { price: parseFloat(l.px), amount: parseFloat(l.sz), total: askTotal }
      })

    let bidTotal = 0
    const bids: OrderBookLevel[] = (rawBids as { px: string; sz: string; n: number }[])
      .slice(0, limit)
      .map((l) => {
        bidTotal += parseFloat(l.sz)
        return { price: parseFloat(l.px), amount: parseFloat(l.sz), total: bidTotal }
      })

    return { success: true, asks, bids, source: "hyperliquid" }
  } catch (error) {
    console.error("[Hyperliquid] orderbook error:", error)
    return null
  }
}

/** Fetch recent trades from Hyperliquid */
async function fetchHyperliquidTrades(
  symbol: string,
  limit: number,
): Promise<TradeResult[] | null> {
  try {
    const upper = symbol.replace("/", "").replace("-", "").replace("_", "").toUpperCase()
    const quoteMatch = upper.match(/(USDT|USDC|USD)$/)
    const base = quoteMatch ? upper.slice(0, upper.length - quoteMatch[0].length) : upper

    const data = await hlPost({ type: "recentTrades", coin: base })
    if (!Array.isArray(data) || data.length === 0) return null

    return data.slice(0, limit).map((t: { tid: number; px: string; sz: string; side: string; time: number }) => ({
      id: String(t.tid),
      price: t.px,
      amount: t.sz,
      side: (t.side === "B" ? "buy" : "sell") as "buy" | "sell",
      time: t.time,
    }))
  } catch {
    return null
  }
}

// ── KuCoin price fetcher (fallback) ────────────────────────────────────────

async function fetchKuCoinPrices(): Promise<PricesResponse | null> {
  try {
    const url = "https://api.kucoin.com/api/v1/market/allTickers"
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null

    const json = await res.json()
    if (json.code !== "200000" || !json.data?.ticker) return null

    const symbolToId = new Map<string, string>()
    for (const [id, sym] of Object.entries(KUCOIN_SYMBOLS)) {
      symbolToId.set(sym, id)
    }

    const prices: Record<string, number> = { USDT: 1, USDC: 1 }
    const coins: CoinData[] = []

    for (const ticker of json.data.ticker) {
      const coinId = symbolToId.get(ticker.symbol)
      if (!coinId) continue

      const symbol = ID_TO_SYMBOL[coinId]
      if (!symbol) continue

      const price = parseFloat(ticker.last) || 0
      const change24h = (parseFloat(ticker.changeRate) || 0) * 100
      const volume24h = parseFloat(ticker.volValue) || 0

      prices[symbol] = price

      coins.push({
        id: coinId,
        symbol,
        name: COIN_NAMES[coinId] || symbol,
        price,
        change24h,
        marketCap: 0,
        volume24h,
        image: COIN_IMAGES[coinId] || "",
      })
    }

    // Add stablecoins
    if (!coins.find((c) => c.symbol === "USDT")) {
      coins.push({
        id: "tether",
        symbol: "USDT",
        name: "Tether",
        price: 1,
        change24h: 0,
        marketCap: 0,
        volume24h: 0,
        image: COIN_IMAGES.tether || "",
      })
    }

    // Sort by volume
    coins.sort((a, b) => b.volume24h - a.volume24h)

    return {
      prices,
      coins,
      globalStats: { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, marketCapChange24h: 0 },
      fetchedAt: Date.now(),
    }
  } catch (error) {
    console.error("KuCoin price fetch error:", error)
    return null
  }
}

// ── getPrices ──────────────────────────────────────────────────────────────

export async function getPrices(): Promise<PricesResponse> {
  const now = Date.now()
  console.log("[getPrices] called")

  if (priceCache && now - priceCacheTs < PRICE_TTL) {
    console.log("[getPrices] returning cached data, age:", Math.round((now - priceCacheTs) / 1000), "s")
    return sanitize(priceCache)
  }

  if (now < backoffUntil && priceCache) {
    console.log("[getPrices] in backoff period, returning stale cache")
    return sanitize(priceCache)
  }

  // Try Hyperliquid first (fastest)
  console.log("[getPrices] fetching from Hyperliquid...")
  const hlResult = await fetchHyperliquidPrices()
  if (hlResult && hlResult.coins.length > 0) {
    console.log("[getPrices] Hyperliquid returned", hlResult.coins.length, "coins")

    // Enrich with 24h change from KuCoin (non-blocking — if it fails, we still have HL prices)
    try {
      const kcRes = await fetch("https://api.kucoin.com/api/v1/market/allTickers", {
        signal: AbortSignal.timeout(5_000),
      })
      if (kcRes.ok) {
        const kcJson = await kcRes.json()
        if (kcJson.code === "200000" && kcJson.data?.ticker) {
          const symbolToId = new Map<string, string>()
          for (const [id, sym] of Object.entries(KUCOIN_SYMBOLS)) {
            symbolToId.set(sym, id)
          }
          const changeMap = new Map<string, number>()
          for (const ticker of kcJson.data.ticker) {
            const coinId = symbolToId.get(ticker.symbol)
            if (!coinId) continue
            const sym = ID_TO_SYMBOL[coinId]
            if (sym) changeMap.set(sym, (parseFloat(ticker.changeRate) || 0) * 100)
          }
          for (const coin of hlResult.coins) {
            const change = changeMap.get(coin.symbol)
            if (change !== undefined) coin.change24h = change
          }
          console.log("[getPrices] enriched", changeMap.size, "coins with KuCoin 24h change")
        }
      }
    } catch (e) {
      console.warn("[getPrices] KuCoin 24h enrichment failed, continuing with HL data:", e)
    }

    priceCache = hlResult
    priceCacheTs = now
    return sanitize(hlResult)
  }

  // Fallback: KuCoin
  console.log("[getPrices] Hyperliquid failed, trying KuCoin...")
  const kucoinResult = await fetchKuCoinPrices()
  if (kucoinResult && kucoinResult.coins.length > 0) {
    console.log("[getPrices] KuCoin returned", kucoinResult.coins.length, "coins")
    // Fetch TON separately if KuCoin didn't return it
    if (!kucoinResult.prices.TON) {
      try {
        const tonRes = await fetch(
          "https://min-api.cryptocompare.com/data/price?fsym=TON&tsyms=USD",
          { signal: AbortSignal.timeout(5_000) },
        )
        if (tonRes.ok) {
          const tonData = await tonRes.json()
          const tonPrice = tonData.USD ?? 0
          if (tonPrice > 0) {
            kucoinResult.prices.TON = tonPrice
            kucoinResult.coins.push({
              id: "toncoin",
              symbol: "TON",
              name: "Toncoin",
              price: tonPrice,
              change24h: 0,
              marketCap: 0,
              volume24h: 0,
              image: COIN_IMAGES.toncoin || "",
            })
          }
        }
      } catch {
        // TON optional
      }
    }
    priceCache = kucoinResult
    priceCacheTs = now
    console.log("[getPrices] cached KuCoin result, BTC:", kucoinResult.prices.BTC)
    return sanitize(kucoinResult)
  }

  console.log("[getPrices] KuCoin failed, falling back to CoinGecko...")
  // Fallback to CoinGecko
  try {
    const coinsUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ALL_COIN_IDS.join(",")}&order=market_cap_desc&sparkline=false&price_change_percentage=24h`

    const coinsRes = await fetch(coinsUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(15_000),
    })

    if (coinsRes.status === 429) {
      backoffUntil = Date.now() + BACKOFF_MS
      throw new Error("CoinGecko rate limited (429)")
    }

    if (!coinsRes.ok) {
      throw new Error(`CoinGecko returned ${coinsRes.status}`)
    }

    const coinsData = await coinsRes.json()

    const prices: Record<string, number> = {}
    const coins: CoinData[] = []

    for (const coin of coinsData) {
      const symbol = ID_TO_SYMBOL[coin.id] || coin.symbol.toUpperCase()
      prices[symbol] = coin.current_price ?? 0

      coins.push({
        id: coin.id,
        symbol,
        name: coin.name,
        price: coin.current_price ?? 0,
        change24h: coin.price_change_percentage_24h ?? 0,
        marketCap: coin.market_cap ?? 0,
        volume24h: coin.total_volume ?? 0,
        image: coin.image ?? "",
      })
    }

    if (!prices.USDT) prices.USDT = 1
    if (!prices.USDC) prices.USDC = 1

    let globalStats = {
      totalMarketCap: 0,
      totalVolume: 0,
      btcDominance: 0,
      marketCapChange24h: 0,
    }

    try {
      const globalRes = await fetch("https://api.coingecko.com/api/v3/global", {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(5_000),
      })

      if (globalRes.ok) {
        const globalData = await globalRes.json()
        globalStats = {
          totalMarketCap: globalData.data?.total_market_cap?.usd ?? 0,
          totalVolume: globalData.data?.total_volume?.usd ?? 0,
          btcDominance: globalData.data?.market_cap_percentage?.btc ?? 0,
          marketCapChange24h:
            globalData.data?.market_cap_change_percentage_24h_usd ?? 0,
        }
      }
    } catch {
      // global stats are optional
    }

    const result: PricesResponse = { prices, coins, globalStats, fetchedAt: now }
    priceCache = result
    priceCacheTs = now
    console.log("[getPrices] CoinGecko returned", coins.length, "coins, BTC:", prices.BTC)
    return sanitize(result)
  } catch (error) {
    console.error("[getPrices] ERROR:", error)

    if (priceCache) return sanitize(priceCache)

    return {
      prices: {},
      coins: [],
      globalStats: { totalMarketCap: 0, totalVolume: 0, btcDominance: 0, marketCapChange24h: 0 },
      fetchedAt: now,
      error: "Failed to fetch market data. Please check your connection and try again.",
    }
  }
}

// ── getSpotMarkets (Hyperliquid spotMeta) ──────────────────────────────────

let spotMarketCache: CoinData[] | null = null
let spotMarketCacheTs = 0
const SPOT_MARKET_TTL = 30_000

async function fetchHyperliquidSpotMarkets(): Promise<CoinData[] | null> {
  try {
    const [spotMeta, mids] = await Promise.all([
      hlPost({ type: "spotMeta" }),
      hlPost({ type: "allMids" }),
    ])

    if (!spotMeta?.universe || !spotMeta?.tokens || !mids) return null

    const markets: CoinData[] = []

    for (const entry of spotMeta.universe) {
      const baseTokenIdx = entry.tokens[0]
      const quoteTokenIdx = entry.tokens[1]
      const baseToken = spotMeta.tokens[baseTokenIdx]
      const quoteToken = spotMeta.tokens[quoteTokenIdx]

      if (!baseToken) continue

      const coinName = entry.name as string
      const price = parseFloat(mids[coinName] ?? "0")
      if (price <= 0) continue

      const baseName: string = baseToken.name ?? "UNKNOWN"
      const quoteName: string = quoteToken?.name ?? "USDC"

      const coinId =
        Object.entries(ID_TO_SYMBOL).find(([, s]) => s === baseName)?.[0] ||
        baseName.toLowerCase()

      markets.push({
        id: coinId,
        symbol: baseName,
        name: SYMBOL_NAME[baseName] || COIN_NAMES[coinId] || baseName,
        price,
        change24h: 0,
        marketCap: 0,
        volume24h: 0,
        image: SYMBOL_IMAGE[baseName] || COIN_IMAGES[coinId] || "",
        quoteAsset: quoteName,
        szDecimals: baseToken.szDecimals ?? 8,
        hlName: coinName,
      })
    }

    return markets.length > 0 ? markets : null
  } catch (error) {
    console.error("[SpotMarkets] fetch error:", error)
    return null
  }
}

export async function getSpotMarkets(): Promise<{
  markets: CoinData[]
  prices: Record<string, number>
  error?: string
}> {
  const now = Date.now()

  if (spotMarketCache && now - spotMarketCacheTs < SPOT_MARKET_TTL) {
    const prices: Record<string, number> = { USDT: 1, USDC: 1 }
    for (const m of spotMarketCache) prices[m.symbol] = m.price
    return sanitize({ markets: spotMarketCache, prices })
  }

  const markets = await fetchHyperliquidSpotMarkets()
  if (!markets || markets.length === 0) {
    if (spotMarketCache) {
      const prices: Record<string, number> = { USDT: 1, USDC: 1 }
      for (const m of spotMarketCache) prices[m.symbol] = m.price
      return sanitize({ markets: spotMarketCache, prices })
    }
    return { markets: [], prices: {}, error: "Failed to fetch spot markets" }
  }

  // Enrich with KuCoin 24h change + volume
  try {
    const kcRes = await fetch("https://api.kucoin.com/api/v1/market/allTickers", {
      signal: AbortSignal.timeout(5_000),
    })
    if (kcRes.ok) {
      const kcJson = await kcRes.json()
      if (kcJson.code === "200000" && kcJson.data?.ticker) {
        const kcMap = new Map<string, { change: number; volume: number }>()
        for (const ticker of kcJson.data.ticker) {
          const sym = ticker.symbol.replace(/-USDT$/, "").replace(/-USDC$/, "")
          kcMap.set(sym, {
            change: (parseFloat(ticker.changeRate) || 0) * 100,
            volume: parseFloat(ticker.volValue) || 0,
          })
        }
        for (const m of markets) {
          const kc = kcMap.get(m.symbol)
          if (kc) {
            m.change24h = kc.change
            m.volume24h = kc.volume
          }
        }
      }
    }
  } catch {
    // KuCoin enrichment is optional
  }

  markets.sort((a, b) => b.volume24h - a.volume24h)

  spotMarketCache = markets
  spotMarketCacheTs = now

  const prices: Record<string, number> = { USDT: 1, USDC: 1 }
  for (const m of markets) prices[m.symbol] = m.price

  return sanitize({ markets, prices })
}

// ── getTrades ──────────────────────────────────────────────────────────────

function parseSymbol(raw: string) {
  const upper = raw.replace("/", "").toUpperCase()
  const quoteMatch = upper.match(/(USDT|USDC|BUSD|USD)$/)
  const quote = quoteMatch ? quoteMatch[0] : "USDT"
  const base = upper.slice(0, upper.length - quote.length) || "BTC"
  return { base, quote, kucoin: `${base}-${quote}` }
}

async function fetchKuCoinTrades(
  kucoinSymbol: string,
  limit: string,
): Promise<TradeResult[] | null> {
  const url = `https://api.kucoin.com/api/v1/market/histories?symbol=${encodeURIComponent(kucoinSymbol)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null
  const json = await res.json()
  if (!json.data) return null
  return json.data
    .slice(0, Number(limit))
    .map((t: Record<string, unknown>) => ({
      id: (t.sequence as string) || String(t.time),
      price: t.price,
      amount: t.size,
      side: t.side,
      time: Math.floor((t.time as number) / 1000000),
    }))
}

export async function getTrades(
  symbol = "BTCUSDT",
  limit = 50,
): Promise<TradesResponse> {
  const { base, kucoin } = parseSymbol(symbol)
  const cacheKey = `${kucoin}:${limit}`
  console.log(`[getTrades] called for ${symbol} (limit: ${limit})`)

  const cached = tradeCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < TRADE_TTL) {
    console.log(`[getTrades] returning cached ${symbol}, age:`, Math.round((Date.now() - cached.ts) / 1000), "s")
    return sanitize(cached.data)
  }

  // Hyperliquid first
  try {
    const hlTrades = await fetchHyperliquidTrades(base, limit)
    if (hlTrades && hlTrades.length > 0) {
      console.log(`[getTrades] ${symbol} got ${hlTrades.length} trades from Hyperliquid`)
      const payload: TradesResponse = { success: true, source: "hyperliquid", data: hlTrades }
      tradeCache.set(cacheKey, { data: payload, ts: Date.now() })
      return sanitize(payload)
    }
  } catch { /* fall through */ }

  // KuCoin fallback
  try {
    const trades = await fetchKuCoinTrades(kucoin, String(limit))
    if (trades && trades.length > 0) {
      console.log(`[getTrades] ${symbol} got ${trades.length} trades from KuCoin`)
      const payload: TradesResponse = {
        success: true,
        source: "kucoin",
        data: trades,
      }
      tradeCache.set(cacheKey, { data: payload, ts: Date.now() })
      return sanitize(payload)
    }
  } catch {
    // fall through
  }

  const stale = tradeCache.get(cacheKey)
  if (stale) return sanitize(stale.data)

  console.log(`[getTrades] ${symbol} all sources failed, returning empty`)
  return { success: false, data: [], error: "Trade data unavailable" }
}

// ── getOrderBook ───────────────────────────────────────────────────────────

export interface OrderBookLevel {
  price: number
  amount: number
  total: number
}

export interface OrderBookResponse {
  success: boolean
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
  source?: string
  error?: string
}

const orderBookCache = new Map<string, { data: OrderBookResponse; ts: number }>()
const ORDERBOOK_TTL = 1_000

function toGatePair(symbol: string): string {
  const upper = symbol.replace("/", "").replace("-", "").toUpperCase()
  const quoteMatch = upper.match(/(USDT|USDC|USD)$/)
  const quote = quoteMatch ? quoteMatch[0] : "USDT"
  const base = upper.slice(0, upper.length - quote.length) || "BTC"
  return `${base}_${quote}`
}

async function fetchGateOrderBook(
  pair: string,
  limit: number,
): Promise<OrderBookResponse | null> {
  const url = `https://api.gateio.ws/api/v4/spot/order_book?currency_pair=${encodeURIComponent(pair)}&limit=${limit}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null

  const data = await res.json()
  if (!data.asks || !data.bids) return null

  let askTotal = 0
  const asks: OrderBookLevel[] = (data.asks as [string, string][])
    .map(([p, a]: [string, string]) => {
      askTotal += parseFloat(a)
      return { price: parseFloat(p), amount: parseFloat(a), total: askTotal }
    })

  let bidTotal = 0
  const bids: OrderBookLevel[] = (data.bids as [string, string][])
    .map(([p, a]: [string, string]) => {
      bidTotal += parseFloat(a)
      return { price: parseFloat(p), amount: parseFloat(a), total: bidTotal }
    })

  return { success: true, asks, bids, source: "gate" }
}

async function fetchKuCoinOrderBook(
  symbol: string,
  limit: number,
): Promise<OrderBookResponse | null> {
  const upper = symbol.replace("/", "").replace("_", "").toUpperCase()
  const quoteMatch = upper.match(/(USDT|USDC|USD)$/)
  const quote = quoteMatch ? quoteMatch[0] : "USDT"
  const base = upper.slice(0, upper.length - quote.length) || "BTC"
  const kucoinSymbol = `${base}-${quote}`

  const url = `https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=${encodeURIComponent(kucoinSymbol)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null

  const json = await res.json()
  if (json.code !== "200000" || !json.data?.asks || !json.data?.bids) return null

  let askTotal = 0
  const asks: OrderBookLevel[] = (json.data.asks as [string, string][])
    .slice(0, limit)
    .map(([p, a]: [string, string]) => {
      askTotal += parseFloat(a)
      return { price: parseFloat(p), amount: parseFloat(a), total: askTotal }
    })

  let bidTotal = 0
  const bids: OrderBookLevel[] = (json.data.bids as [string, string][])
    .slice(0, limit)
    .map(([p, a]: [string, string]) => {
      bidTotal += parseFloat(a)
      return { price: parseFloat(p), amount: parseFloat(a), total: bidTotal }
    })

  return { success: true, asks, bids, source: "kucoin" }
}

export async function getOrderBook(
  symbol = "BTCUSDT",
  limit = 20,
): Promise<OrderBookResponse> {
  const cacheKey = `${symbol}:${limit}`
  console.log(`[getOrderBook] called for ${symbol}, limit: ${limit}`)
  const cached = orderBookCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < ORDERBOOK_TTL) {
    console.log(`[getOrderBook] returning cached ${symbol}, age:`, Math.round((Date.now() - cached.ts) / 1000), "s")
    return sanitize(cached.data)
  }

  // Try Hyperliquid first (fastest)
  try {
    console.log(`[getOrderBook] fetching ${symbol} from Hyperliquid...`)
    const hl = await fetchHyperliquidOrderBook(symbol, limit)
    if (hl) {
      console.log(`[getOrderBook] Hyperliquid returned ${hl.asks.length} asks, ${hl.bids.length} bids for ${symbol}`)
      orderBookCache.set(cacheKey, { data: hl, ts: Date.now() })
      return sanitize(hl)
    }
  } catch { /* fall through */ }

  // KuCoin fallback
  try {
    console.log(`[getOrderBook] Hyperliquid failed, trying KuCoin for ${symbol}...`)
    const kucoin = await fetchKuCoinOrderBook(symbol, limit)
    if (kucoin) {
      console.log(`[getOrderBook] KuCoin returned ${kucoin.asks.length} asks, ${kucoin.bids.length} bids for ${symbol}`)
      orderBookCache.set(cacheKey, { data: kucoin, ts: Date.now() })
      return sanitize(kucoin)
    }
  } catch { /* fall through */ }

  // Fallback to Gate.io
  try {
    console.log(`[getOrderBook] KuCoin failed, trying Gate.io for ${symbol}...`)
    const gate = await fetchGateOrderBook(toGatePair(symbol), limit)
    if (gate) {
      console.log(`[getOrderBook] Gate.io returned ${gate.asks.length} asks, ${gate.bids.length} bids for ${symbol}`)
      orderBookCache.set(cacheKey, { data: gate, ts: Date.now() })
      return sanitize(gate)
    }
  } catch { /* fall through */ }

  const stale = orderBookCache.get(cacheKey)
  if (stale) {
    console.log(`[getOrderBook] all sources failed for ${symbol}, returning stale cache`)
    return sanitize(stale.data)
  }

  console.log(`[getOrderBook] ${symbol} completely unavailable`)
  return { success: false, asks: [], bids: [], error: "Order book unavailable" }
}

// ── getChartData ───────────────────────────────────────────────────────────

export interface ChartDataPoint {
  timestamp: number
  price: number
}

export interface ChartResponse {
  data: ChartDataPoint[]
  high: number
  low: number
  volume: string
  currentPrice: number
  change: number
  error?: string
}

// Reuse COINGECKO_IDS for chart data lookups
const SYMBOL_TO_COINGECKO_ID = COINGECKO_IDS

const TIMEFRAME_TO_DAYS: Record<string, string> = {
  "1M": "0.02",
  "5M": "0.04",
  "15M": "0.05",
  "1H": "0.05",
  "4H": "0.17",
  "1D": "1",
  "1W": "7",
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(0)}M`
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(0)}K`
  return vol.toFixed(0)
}

const chartCache = new Map<string, { data: ChartResponse; ts: number }>()
const CHART_TTL = 60_000

export async function getChartData(
  symbol = "BTC",
  timeframe = "1D",
): Promise<ChartResponse> {
  const coinId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()]
  if (!coinId) {
    return { data: [], high: 0, low: 0, volume: "0", currentPrice: 0, change: 0, error: `Unsupported symbol: ${symbol}` }
  }

  const days = TIMEFRAME_TO_DAYS[timeframe] || "1"
  const cacheKey = `${coinId}-${days}`
  console.log(`[getChartData] called for ${symbol} (${coinId}), timeframe: ${timeframe}, days: ${days}`)

  const cached = chartCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CHART_TTL) {
    console.log(`[getChartData] returning cached ${symbol}, age:`, Math.round((Date.now() - cached.ts) / 1000), "s")
    return cached.data
  }

  try {
    console.log(`[getChartData] fetching ${symbol} from CoinGecko...`)
    const chartUrl = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`
    const chartRes = await fetch(chartUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })

    if (!chartRes.ok) throw new Error(`CoinGecko chart returned ${chartRes.status}`)

    const chartJson = await chartRes.json()

    const prices: ChartDataPoint[] = (chartJson.prices || []).map(
      ([timestamp, price]: [number, number]) => ({ timestamp, price }),
    )

    if (prices.length === 0) throw new Error("No price data returned")

    const priceValues = prices.map((p) => p.price)
    const high = Math.max(...priceValues)
    const low = Math.min(...priceValues)
    const currentPrice = priceValues[priceValues.length - 1]
    const firstPrice = priceValues[0]
    const change = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0

    const volumes: number[] = (chartJson.total_volumes || []).map(
      ([, vol]: [number, number]) => vol,
    )
    const totalVolume = volumes.length > 0 ? volumes[volumes.length - 1] : 0

    const result: ChartResponse = {
      data: prices,
      high,
      low,
      volume: formatVolume(totalVolume),
      currentPrice,
      change,
    }

    chartCache.set(cacheKey, { data: result, ts: Date.now() })
    console.log(`[getChartData] ${symbol}: ${prices.length} data points, price: ${currentPrice}, change: ${change.toFixed(2)}%`)
    return result
  } catch (error) {
    console.error(`[getChartData] ERROR for ${symbol}:`, error)

    if (cached) return cached.data

    return { data: [], high: 0, low: 0, volume: "0", currentPrice: 0, change: 0, error: "Failed to fetch chart data" }
  }
}

// ── getSpotKlines (CoinGecko OHLC primary, KuCoin fallback) ────────────────

const SPOT_INTERVAL_MAP: Record<string, { type: string; seconds: number; cgDays: number }> = {
  "1m":  { type: "1min",   seconds: 60,      cgDays: 1   },
  "3m":  { type: "3min",   seconds: 180,     cgDays: 1   },
  "5m":  { type: "5min",   seconds: 300,     cgDays: 1   },
  "15m": { type: "15min",  seconds: 900,     cgDays: 2   },
  "30m": { type: "30min",  seconds: 1800,    cgDays: 3   },
  "1H":  { type: "1hour",  seconds: 3600,    cgDays: 7   },
  "2H":  { type: "2hour",  seconds: 7200,    cgDays: 14  },
  "4H":  { type: "4hour",  seconds: 14400,   cgDays: 30  },
  "12H": { type: "12hour", seconds: 43200,   cgDays: 60  },
  "1D":  { type: "1day",   seconds: 86400,   cgDays: 90  },
  "1W":  { type: "1week",  seconds: 604800,  cgDays: 180 },
  "3M":  { type: "1day",   seconds: 86400,   cgDays: 90  },
  "6M":  { type: "1day",   seconds: 86400,   cgDays: 180 },
  "1Y":  { type: "1week",  seconds: 604800,  cgDays: 365 },
}

const spotKlinesCache = new Map<string, { data: KlinesResponse; ts: number }>()
const SPOT_KLINES_TTL = 30_000 // 30s cache — reduces server action round-trips

async function fetchCoinGeckoOHLC(coinId: string, days: number): Promise<Kline[] | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null

  // CoinGecko OHLC: [timestamp_ms, open, high, low, close]
  return data.map((c: number[]) => ({
    time: c[0],
    open: c[1],
    high: c[2],
    low: c[3],
    close: c[4],
    volume: 0, // CoinGecko OHLC doesn't include volume
  }))
}

async function fetchKuCoinKlines(kucoinSymbol: string, type: string, seconds: number): Promise<Kline[] | null> {
  const endAt = Math.floor(Date.now() / 1000)
  const startAt = endAt - seconds * 200
  const url = `https://api.kucoin.com/api/v1/market/candles?type=${type}&symbol=${encodeURIComponent(kucoinSymbol)}&startAt=${startAt}&endAt=${endAt}`

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) return null

  const json = await res.json()
  if (json.code !== "200000" || !Array.isArray(json.data)) return null

  // KuCoin candles: [time, open, close, high, low, volume, turnover] — NEWEST first
  return json.data
    .map((c: string[]) => ({
      time: Number(c[0]) * 1000,
      open: Number(c[1]),
      close: Number(c[2]),
      high: Number(c[3]),
      low: Number(c[4]),
      volume: Number(c[5]),
    }))
    .reverse()
}

export async function getSpotKlines(
  symbol = "BTC",
  interval = "1H",
): Promise<KlinesResponse> {
  const mapped = SPOT_INTERVAL_MAP[interval] || SPOT_INTERVAL_MAP["1H"]
  const sym = symbol.toUpperCase()
  const cacheKey = `${sym}:${mapped.type}`

  const cached = spotKlinesCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SPOT_KLINES_TTL) return sanitize(cached.data)

  // CoinGecko OHLC — fast, free
  const coinId = COINGECKO_IDS[sym]
  if (coinId) {
    try {
      console.log(`[getSpotKlines] fetching ${sym} from CoinGecko OHLC (days=${mapped.cgDays})...`)
      const data = await fetchCoinGeckoOHLC(coinId, mapped.cgDays)
      if (data && data.length > 0) {
        const result: KlinesResponse = { success: true, data }
        spotKlinesCache.set(cacheKey, { data: result, ts: Date.now() })
        console.log(`[getSpotKlines] CoinGecko: ${data.length} candles for ${sym}`)
        return sanitize(result)
      }
    } catch (e) {
      console.error(`[getSpotKlines] CoinGecko OHLC failed for ${sym}:`, e)
    }
  }

  // KuCoin fallback
  try {
    const kucoinSymbol = `${sym}-USDT`
    console.log(`[getSpotKlines] trying KuCoin ${kucoinSymbol} ${mapped.type}...`)
    const data = await fetchKuCoinKlines(kucoinSymbol, mapped.type, mapped.seconds)
    if (data && data.length > 0) {
      const result: KlinesResponse = { success: true, data }
      spotKlinesCache.set(cacheKey, { data: result, ts: Date.now() })
      console.log(`[getSpotKlines] KuCoin: ${data.length} candles for ${sym}`)
      return sanitize(result)
    }
  } catch (error) {
    console.error(`[getSpotKlines] KuCoin ERROR for ${sym}:`, error)
  }

  const stale = spotKlinesCache.get(cacheKey)
  if (stale) return sanitize(stale.data)
  return { success: false, data: [], error: "Failed to fetch klines" }
}

// ── getQuote (LI.FI) ──────────────────────────────────────────────────────

export interface QuoteResponse {
  success: boolean
  expectedOutput?: string
  toAmountMin?: string
  priceImpact?: number
  gasEstimate?: string
  route?: {
    tool: string
    type: string
    fromChainId: number
    toChainId: number
  }
  executionData?: Record<string, unknown>
  error?: string
}

export async function getQuote(params: {
  fromChain: number
  toChain?: number
  tokenIn: string
  tokenOut: string
  amountIn: string
  fromAddress: string
  slippage?: number
}): Promise<QuoteResponse> {
  console.log(`[getQuote] called:`, {
    fromChain: params.fromChain,
    toChain: params.toChain,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    fromAddress: params.fromAddress?.slice(0, 10) + "...",
    slippage: params.slippage,
  })
  try {
    if (!params.tokenIn || !params.tokenOut || !params.amountIn || !params.fromChain) {
      console.log("[getQuote] missing required fields")
      return { success: false, error: "Missing required fields" }
    }
    if (!params.fromAddress || params.fromAddress === "0x0000000000000000000000000000000000000000") {
      return { success: false, error: "Please connect your wallet first" }
    }

    const queryParams = new URLSearchParams({
      fromChain: String(params.fromChain),
      toChain: String(params.toChain || params.fromChain),
      fromToken: params.tokenIn,
      toToken: params.tokenOut,
      fromAmount: params.amountIn,
      fromAddress: params.fromAddress,
      toAddress: params.fromAddress,
      slippage: String(params.slippage ?? 0.005),
      integrator: "worldstreet",
      allowSwitchChain: "false",
    })

    const res = await fetch(`https://li.quest/v1/quote?${queryParams}`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text()
      let msg = `LI.FI API error: ${res.status}`
      try { msg = JSON.parse(text).message || msg } catch {}
      return { success: false, error: msg }
    }

    const quote = await res.json()

    const result = {
      success: true,
      expectedOutput: quote.estimate?.toAmount,
      toAmountMin: quote.estimate?.toAmountMin,
      priceImpact: quote.estimate?.data?.priceImpact || 0,
      gasEstimate: quote.estimate?.gasCosts?.[0]?.amount || "0",
      route: {
        tool: quote.tool,
        type: "lifi",
        fromChainId: params.fromChain,
        toChainId: params.toChain || params.fromChain,
      },
      executionData: quote.transactionRequest,
    }
    console.log(`[getQuote] success: expectedOutput=${result.expectedOutput}, tool=${quote.tool}, priceImpact=${result.priceImpact}`)
    return result
  } catch (error) {
    console.error("[getQuote] ERROR:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch quote" }
  }
}

// ── Trade History / User Balances ──────────────────────────────────────────

export interface TradeHistoryItem {
  id: string
  pair: string
  side: "BUY" | "SELL"
  amount: string
  price: string
  total: string
  status: "PENDING" | "CONFIRMED" | "FAILED"
  txHash?: string
  createdAt: string
}

export async function getTradeHistory(
  userId: string,
  limit = 50,
): Promise<{ success: boolean; data: TradeHistoryItem[]; error?: string }> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/trades/${encodeURIComponent(userId)}?limit=${limit}`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 0 } },
    )
    if (!res.ok) return { success: false, data: [], error: `HTTP ${res.status}` }
    const json = await res.json()
    const trades: TradeHistoryItem[] = (json.data ?? json.trades ?? json ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => ({
        id: t.id || t._id || t.txHash || String(Math.random()),
        pair: t.pair || `${t.token_in || t.fromTokenSymbol || "?"}-${t.token_out || t.toTokenSymbol || "?"}`,
        side: (t.side || (t.token_out === "USDT" ? "SELL" : "BUY")).toUpperCase(),
        amount: String(t.amount_in || t.fromAmount || t.amountIn || "0"),
        price: String(t.price || t.executionPrice || "0"),
        total: String(t.amount_out || t.toAmount || "0"),
        status: (t.status || "CONFIRMED").toUpperCase(),
        txHash: t.txHash || t.tx_hash || "",
        createdAt: t.createdAt || t.created_at || new Date().toISOString(),
      }),
    )
    return sanitize({ success: true, data: trades })
  } catch (error) {
    console.error("[getTradeHistory] ERROR:", error)
    return { success: false, data: [], error: error instanceof Error ? error.message : "Failed" }
  }
}

export interface UserBalance {
  asset: string
  chain: string
  available: number
  locked: number
}

export async function getUserBalances(
  userId: string,
): Promise<{ success: boolean; balances: UserBalance[]; totalUsd: number; error?: string }> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/users/${encodeURIComponent(userId)}/balances`,
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 0 } },
    )
    if (!res.ok) return { success: false, balances: [], totalUsd: 0, error: `HTTP ${res.status}` }
    const json = await res.json()
    const arr = json.data ?? json.balances ?? json ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balances: UserBalance[] = arr.map((b: any) => ({
      asset: b.asset || b.coin || "?",
      chain: b.chain || "ethereum",
      available: Number(b.available_balance ?? b.available ?? 0),
      locked: Number(b.locked_balance ?? b.locked ?? 0),
    }))
    const totalUsd = balances.reduce((sum, b) => sum + b.available + b.locked, 0)
    return sanitize({ success: true, balances, totalUsd })
  } catch (error) {
    console.error("[getUserBalances] ERROR:", error)
    return { success: false, balances: [], totalUsd: 0, error: error instanceof Error ? error.message : "Failed" }
  }
}

// ── executeTrade ───────────────────────────────────────────────────────────

export interface TradeExecutionResponse {
  success: boolean
  txHash?: string
  position?: Record<string, unknown>
  error?: string
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://trading.watchup.site"

export async function executeTrade(params: {
  userId: string
  fromChain: number
  toChain?: number
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage?: number
}): Promise<TradeExecutionResponse> {
  console.log(`[executeTrade] called:`, {
    userId: params.userId?.slice(0, 10) + "...",
    fromChain: params.fromChain,
    toChain: params.toChain,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    slippage: params.slippage,
  })
  try {
    if (!params.userId || !params.tokenIn || !params.tokenOut || !params.amountIn) {
      console.log("[executeTrade] missing required fields")
      return { success: false, error: "Missing required fields" }
    }

    const res = await fetch(`${BACKEND_URL}/api/execute-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.userId,
        fromChain: params.fromChain,
        toChain: params.toChain || params.fromChain,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
        slippage: params.slippage ?? 0.005,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error(`[executeTrade] backend error: ${res.status}`, data)
      return { success: false, error: data.message || data.error || "Trade execution failed" }
    }

    console.log(`[executeTrade] success: txHash=${data.txHash}`)
    return { success: true, txHash: data.txHash, position: data.position }
  } catch (error) {
    console.error("[executeTrade] ERROR:", error)
    return { success: false, error: error instanceof Error ? error.message : "Trade execution failed" }
  }
}

// ── Futures: Hyperliquid Markets ───────────────────────────────────────────

export interface FuturesMarket {
  symbol: string
  baseAsset: string
  quoteAsset: string
  markPrice: number
  change24h: number
  volume24h: number
  high24h: number
  low24h: number
  fundingRate: number
  openInterest: number
  maxLeverage: number
  image: string
}

export interface FuturesMarketsResponse {
  success: boolean
  markets: FuturesMarket[]
  error?: string
}

const futuresMarketsCache = new Map<string, { data: FuturesMarketsResponse; ts: number }>()
const FUTURES_MARKETS_TTL = 10_000

export async function getFuturesMarkets(): Promise<FuturesMarketsResponse> {
  console.log("[getFuturesMarkets] called")
  const cached = futuresMarketsCache.get("markets")
  if (cached && Date.now() - cached.ts < FUTURES_MARKETS_TTL) {
    console.log("[getFuturesMarkets] returning cached data, age:", Math.round((Date.now() - cached.ts) / 1000), "s")
    return cached.data
  }

  try {
    console.log("[getFuturesMarkets] fetching from Hyperliquid...")
    // Fetch meta + mid prices from Hyperliquid info API
    const [metaRes, midsRes] = await Promise.all([
      fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "meta" }),
        signal: AbortSignal.timeout(10_000),
      }),
      fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "allMids" }),
        signal: AbortSignal.timeout(10_000),
      }),
    ])

    if (!metaRes.ok || !midsRes.ok) throw new Error("Hyperliquid API failed")

    const meta = await metaRes.json()
    const mids: Record<string, string> = await midsRes.json()

    // Also fetch 24h context for volume/change
    let ctxMap: Record<string, { dayNtlVlm?: string; prevDayPx?: string; funding?: string; openInterest?: string }> = {}
    try {
      const ctxRes = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "metaAndAssetCtxs" }),
        signal: AbortSignal.timeout(10_000),
      })
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json()
        if (Array.isArray(ctxData) && ctxData.length >= 2) {
          const assetCtxs = ctxData[1] as Array<Record<string, string>>
          const universe = ctxData[0]?.universe ?? meta.universe
          universe.forEach((a: { name: string }, i: number) => {
            if (assetCtxs[i]) ctxMap[a.name] = assetCtxs[i]
          })
        }
      }
    } catch { /* non-critical */ }

    const markets: FuturesMarket[] = (meta.universe as Array<{
      name: string; szDecimals: number; maxLeverage: number
    }>).map((asset) => {
      const mid = Number(mids[asset.name] ?? 0)
      const ctx = ctxMap[asset.name] || {}
      const prevPrice = Number(ctx.prevDayPx ?? 0)
      const change = prevPrice > 0 ? ((mid - prevPrice) / prevPrice) * 100 : 0

      return {
        symbol: asset.name,
        baseAsset: asset.name,
        quoteAsset: "USD",
        markPrice: mid,
        change24h: change,
        volume24h: Number(ctx.dayNtlVlm ?? 0),
        high24h: 0,
        low24h: 0,
        fundingRate: Number(ctx.funding ?? 0),
        openInterest: Number(ctx.openInterest ?? 0),
        maxLeverage: asset.maxLeverage ?? 50,
        image: SYMBOL_IMAGE[asset.name] || "",
      }
    }).filter((m) => m.markPrice > 0)

    markets.sort((a, b) => b.volume24h - a.volume24h)

    const result: FuturesMarketsResponse = { success: true, markets }
    futuresMarketsCache.set("markets", { data: result, ts: Date.now() })
    console.log(`[getFuturesMarkets] got ${markets.length} markets, top: ${markets[0]?.symbol}`)
    return result
  } catch (error) {
    console.error("[getFuturesMarkets] ERROR:", error)
    const stale = futuresMarketsCache.get("markets")
    if (stale) return stale.data
    return { success: false, markets: [], error: "Failed to fetch futures markets" }
  }
}

// ── Futures: Klines (Candlestick) ──────────────────────────────────────────

export interface Kline {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface KlinesResponse {
  success: boolean
  data: Kline[]
  error?: string
}

const klinesCache = new Map<string, { data: KlinesResponse; ts: number }>()
const KLINES_TTL = 5_000

// Hyperliquid supported intervals
const FUTURES_INTERVAL_MAP: Record<string, string> = {
  "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "1h", "2h": "2h", "4h": "4h", "12h": "12h",
  "1d": "1d", "3d": "3d", "1w": "1w", "1M": "1M",
  // legacy formats from old chart
  "1min": "1m", "5min": "5m", "15min": "15m",
}

async function fetchHyperliquidCandles(
  coin: string,
  interval: string,
): Promise<Kline[] | null> {
  const hlInterval = FUTURES_INTERVAL_MAP[interval] || "1h"

  // Count candles to cover approximately 1 year
  const countByInterval: Record<string, number> = {
    "1m": 500, "3m": 500, "5m": 500, "15m": 500, "30m": 500,
    "1h": 500, "2h": 500, "4h": 500, "12h": 500,
    "1d": 365, "3d": 200, "1w": 100, "1M": 36,
  }
  const count = countByInterval[hlInterval] ?? 500

  // Calculate start time based on interval
  const intervalMs: Record<string, number> = {
    "1m": 60_000, "3m": 180_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
    "1h": 3_600_000, "2h": 7_200_000, "4h": 14_400_000, "12h": 43_200_000,
    "1d": 86_400_000, "3d": 259_200_000, "1w": 604_800_000, "1M": 2_592_000_000,
  }
  const ms = intervalMs[hlInterval] || 3_600_000
  const startTime = Date.now() - ms * count

  // Strip -PERP suffix for Hyperliquid — it expects just the coin name like "BTC"
  const cleanCoin = coin.replace(/-PERP$/, "").replace(/USDT$/, "").replace(/USD$/, "")

  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: {
        coin: cleanCoin,
        interval: hlInterval,
        startTime,
        endTime: Date.now(),
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) return null

  return data.map((c: { t: number; o: string; h: string; l: string; c: string; v: string }) => ({
    time: Number(c.t),
    open: Number(c.o),
    high: Number(c.h),
    low: Number(c.l),
    close: Number(c.c),
    volume: Number(c.v),
  }))
}

export async function getFuturesKlines(
  symbol: string,
  interval = "1h",
): Promise<KlinesResponse> {
  const perpSymbol = symbol.includes("-PERP") ? symbol : `${symbol}-PERP`
  const mappedInterval = FUTURES_INTERVAL_MAP[interval] || interval
  const cacheKey = `${perpSymbol}:${mappedInterval}`

  const cached = klinesCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < KLINES_TTL) return cached.data

  // Try backend first
  try {
    const url = `${BACKEND_URL}/api/futures/market/${encodeURIComponent(perpSymbol)}/klines?interval=${encodeURIComponent(mappedInterval)}`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    })

    if (res.ok) {
      const json = await res.json()
      const raw = Array.isArray(json) ? json : (json.data ?? json.klines ?? [])
      const data: Kline[] = raw.map((k: Record<string, unknown>) => ({
        time: Number(k.t ?? k.time ?? k.timestamp ?? 0),
        open: Number(k.o ?? k.open ?? 0),
        high: Number(k.h ?? k.high ?? 0),
        low: Number(k.l ?? k.low ?? 0),
        close: Number(k.c ?? k.close ?? 0),
        volume: Number(k.v ?? k.volume ?? 0),
      }))
      if (data.length > 0) {
        const result: KlinesResponse = { success: true, data }
        klinesCache.set(cacheKey, { data: result, ts: Date.now() })
        return result
      }
    }
  } catch {
    // fall through to Hyperliquid direct
  }

  // Direct Hyperliquid fallback
  try {
    const data = await fetchHyperliquidCandles(perpSymbol, mappedInterval)
    if (data && data.length > 0) {
      const result: KlinesResponse = { success: true, data }
      klinesCache.set(cacheKey, { data: result, ts: Date.now() })
      return result
    }
  } catch (error) {
    console.error("Hyperliquid candle fetch error:", error)
  }

  const stale = klinesCache.get(cacheKey)
  if (stale) return stale.data
  return { success: false, data: [], error: "Failed to fetch kline data" }
}

// ── Forex types & actions ─────────────────────────────────────────────────

export interface ForexPair {
  base: string
  quote: string
  symbol: string       // e.g. "EUR/USD"
  rate: number
  prevRate: number
  change24h: number    // % change
  high: number
  low: number
  spread: number       // typical spread in pips
}

export interface ForexRatesResponse {
  pairs: ForexPair[]
  error?: string
}

// Typical daily range in % per pair
const FOREX_DAILY_RANGE: Record<string, number> = {
  "EURUSD": 0.35, "GBPUSD": 0.45, "USDJPY": 0.40, "AUDUSD": 0.40,
  "USDCHF": 0.35, "USDCAD": 0.38, "NZDUSD": 0.42, "EURGBP": 0.30,
  "EURJPY": 0.55, "GBPJPY": 0.65,
}
const FOREX_SPREADS: Record<string, number> = {
  "EURUSD": 0.8, "GBPUSD": 1.0, "USDJPY": 0.9, "AUDUSD": 1.2,
  "USDCHF": 1.5, "USDCAD": 1.4, "NZDUSD": 1.8, "EURGBP": 1.2,
  "EURJPY": 1.5, "GBPJPY": 2.0,
}

const forexCache = new Map<string, { data: ForexRatesResponse; ts: number }>()
const FOREX_TTL = 30_000

export async function getForexRates(): Promise<ForexRatesResponse> {
  const cached = forexCache.get("rates")
  if (cached && Date.now() - cached.ts < FOREX_TTL) return cached.data

  const PAIRS = [
    { base: "EUR", quote: "USD" },
    { base: "GBP", quote: "USD" },
    { base: "USD", quote: "JPY" },
    { base: "AUD", quote: "USD" },
    { base: "USD", quote: "CHF" },
    { base: "USD", quote: "CAD" },
    { base: "NZD", quote: "USD" },
    { base: "EUR", quote: "GBP" },
    { base: "EUR", quote: "JPY" },
    { base: "GBP", quote: "JPY" },
  ]

  try {
    // Frankfurter API — free, no key
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD`,
      { signal: AbortSignal.timeout(5_000) },
    )
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
    const json = await res.json() as { rates: Record<string, number>; base: string }

    // Build lookup: USD rate → each currency
    const usdRates: Record<string, number> = { USD: 1, ...json.rates }

    const pairs: ForexPair[] = PAIRS.map(({ base, quote }) => {
      // Convert via USD
      const baseInUsd = base === "USD" ? 1 : (1 / (usdRates[base] ?? 1))
      const quoteInUsd = quote === "USD" ? 1 : (1 / (usdRates[quote] ?? 1))
      const rate = baseInUsd / quoteInUsd

      const sym = `${base}${quote}`
      const dailyRange = FOREX_DAILY_RANGE[sym] ?? 0.35
      // Synthetic prev rate — realistic ±range shuffle based on symbol seed
      const seed = sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      const rng = Math.sin(seed * 127.1) * 43758.5453
      const noise = (rng - Math.floor(rng) - 0.5) * 2 * (dailyRange / 100)
      const prevRate = rate / (1 + noise)
      const change24h = ((rate - prevRate) / prevRate) * 100
      const highFactor = 1 + (dailyRange * 0.6) / 100
      const lowFactor = 1 - (dailyRange * 0.6) / 100

      return {
        base, quote,
        symbol: `${base}/${quote}`,
        rate,
        prevRate,
        change24h,
        high: rate * highFactor,
        low: rate * lowFactor,
        spread: FOREX_SPREADS[sym] ?? 1.5,
      }
    })

    const result: ForexRatesResponse = { pairs }
    forexCache.set("rates", { data: result, ts: Date.now() })
    return result
  } catch (e) {
    console.error("[getForexRates] error:", e)
    const stale = forexCache.get("rates")
    if (stale) return stale.data
    return { pairs: [], error: "Failed to fetch forex rates" }
  }
}

const forexKlinesCache = new Map<string, { data: KlinesResponse; ts: number }>()
const FOREX_KLINES_TTL = 60_000

export async function getForexKlines(
  base: string,
  quote: string,
  days = 90,
): Promise<KlinesResponse> {
  const cacheKey = `${base}${quote}:${days}`
  const cached = forexKlinesCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < FOREX_KLINES_TTL) return cached.data

  try {
    const end = new Date()
    const start = new Date(end.getTime() - days * 86400_000)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const url = `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${base}&to=${quote}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`Frankfurter klines ${res.status}`)

    const json = await res.json() as { rates: Record<string, Record<string, number>> }
    const entries = Object.entries(json.rates).sort(([a], [b]) => a.localeCompare(b))

    const sym = `${base}${quote}`
    const dailyRange = FOREX_DAILY_RANGE[sym] ?? 0.35

    const data: Kline[] = entries.map(([date, rateMap]) => {
      const close = rateMap[quote] ?? 1
      const seed = date.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
      const rng1 = Math.sin(seed * 127.1) * 43758.5453 - Math.floor(Math.sin(seed * 127.1) * 43758.5453)
      const rng2 = Math.sin(seed * 311.7) * 43758.5453 - Math.floor(Math.sin(seed * 311.7) * 43758.5453)
      const rng3 = Math.sin(seed * 517.3) * 43758.5453 - Math.floor(Math.sin(seed * 517.3) * 43758.5453)
      const spread = dailyRange / 100
      const open = close * (1 + (rng1 - 0.5) * spread * 0.4)
      const high = Math.max(open, close) * (1 + rng2 * spread * 0.5)
      const low = Math.min(open, close) * (1 - rng3 * spread * 0.5)
      const ts = Math.floor(new Date(date).getTime() / 1000)
      return { time: ts, open, high, low, close, volume: 0 }
    })

    const result: KlinesResponse = { success: true, data }
    forexKlinesCache.set(cacheKey, { data: result, ts: Date.now() })
    return result
  } catch (e) {
    console.error("[getForexKlines] error:", e)
    const stale = forexKlinesCache.get(cacheKey)
    if (stale) return stale.data
    return { success: false, data: [], error: "Failed to fetch forex klines" }
  }
}
