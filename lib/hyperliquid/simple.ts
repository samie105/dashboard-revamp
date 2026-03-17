import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"

class HyperliquidClient {
  private info = new InfoClient({
    transport: new HttpTransport({ isTestnet: false }),
  })

  async getMarkets() {
    // Single call gets both metadata and 24h stats
    const [spotMeta, assetCtxs] = await this.info.spotMetaAndAssetCtxs()

    return spotMeta.universe
      .map((u: any, i: number) => {
        const baseTokenIdx = u.tokens[0]
        const quoteTokenIdx = u.tokens[1]
        const baseToken = spotMeta.tokens[baseTokenIdx]
        const quoteToken = spotMeta.tokens[quoteTokenIdx]

        const baseName = baseToken?.name ?? "UNKNOWN"
        const quoteName = quoteToken?.name ?? "USDC"

        // Get 24h stats from the parallel assetCtxs array
        const ctx = assetCtxs[i]
        const midPx = parseFloat(ctx?.midPx ?? "0")
        const prevDayPx = parseFloat(ctx?.prevDayPx ?? "0")
        const dayNtlVlm = parseFloat(ctx?.dayNtlVlm ?? "0")
        const markPx = parseFloat(ctx?.markPx ?? "0")
        const price = midPx || markPx

        // Calculate 24h change %
        const change24h = prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0

        return {
          symbol: `${baseName}/${quoteName}`,
          baseAsset: baseName,
          quoteAsset: quoteName,
          price,
          change24h,
          volume24h: dayNtlVlm,
          high24h: 0,
          low24h: 0,
          chain: "ethereum" as const,
          szDecimals: baseToken?.szDecimals ?? 8,
        }
      })
    // No filter — show all HL spot markets even if price is currently 0
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
