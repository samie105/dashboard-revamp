import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

class HyperliquidClient {
  private info = new InfoClient({
    transport: new HttpTransport({ isTestnet: false }),
  })

  async getMarkets() {
    const [spotMeta, mids] = await Promise.all([
      this.info.spotMeta(),
      this.info.allMids(),
    ])

    return spotMeta.universe
      .map((u: any) => {
        const baseTokenIdx = u.tokens[0]
        const quoteTokenIdx = u.tokens[1]
        const baseToken = spotMeta.tokens[baseTokenIdx]
        const quoteToken = spotMeta.tokens[quoteTokenIdx]
        const coinName = u.name
        const price = Number(mids[coinName] ?? 0)

        const baseName = baseToken?.name ?? "UNKNOWN"
        const quoteName = quoteToken?.name ?? "USDC"

        return {
          symbol: `${baseName}/${quoteName}`,
          baseAsset: baseName,
          quoteAsset: quoteName,
          price,
          change24h: 0,
          volume24h: 0,
          high24h: 0,
          low24h: 0,
          chain: "ethereum" as const,
          szDecimals: baseToken?.szDecimals ?? 8,
          maxLeverage: 1,
          onlyIsolated: false,
        }
      })
      .filter((m: any) => m.price > 0)
  }

  async getAccount(address: string) {
    return this.info.clearinghouseState({ user: address })
  }

  async getSpotAccount(address: string) {
    return this.info.spotClearinghouseState({ user: address })
  }

  async getOrderBook(symbol: string) {
    return this.info.l2Book({ coin: symbol })
  }

  async getRecentTrades(symbol: string) {
    return this.info.recentTrades({ coin: symbol })
  }
}

export const hyperliquid = new HyperliquidClient()
