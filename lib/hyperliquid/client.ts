import { HttpTransport, InfoClient, ExchangeClient } from "@nktkas/hyperliquid"

export interface HyperliquidConfig {
  testnet?: boolean
}

export class HyperliquidService {
  private transport: HttpTransport
  private info: InfoClient

  constructor(config: HyperliquidConfig = {}) {
    const isTestnet = config.testnet ?? false

    this.transport = new HttpTransport({ isTestnet })
    this.info = new InfoClient({ transport: this.transport })
  }

  createExchangeClient(wallet: any) {
    return new ExchangeClient({ transport: this.transport, wallet })
  }

  isTestnet(): boolean {
    return false
  }

  async getAllMidPrices() {
    return this.info.allMids()
  }

  async getMarketData(symbol: string) {
    const mids = await this.info.allMids()
    const meta = await this.info.meta()
    const asset = meta.universe.find((a: any) => a.name === symbol)

    return {
      asset: symbol,
      midPrice: mids[symbol] || "0",
      szDecimals: asset?.szDecimals,
      orderBook: await this.getOrderBook(symbol),
    }
  }

  async getAccount(address: string) {
    return this.info.clearinghouseState({ user: address })
  }

  async getSpotAccount(address: string) {
    return this.info.spotClearinghouseState({ user: address })
  }

  async getMarkets() {
    const meta = await this.info.meta()
    const mids = await this.info.allMids()

    return meta.universe.map((asset: any) => ({
      symbol: asset.name,
      price: Number(mids[asset.name] || 0),
      szDecimals: asset.szDecimals,
      maxLeverage: asset.maxLeverage ?? null,
      isolatedOnly: asset.onlyIsolated ?? false,
    }))
  }

  async getSpotMarkets() {
    const meta = await this.info.meta()
    const mids = await this.info.allMids()

    return meta.universe
      .filter((a: any) => !a.name.includes("-PERP"))
      .map((asset: any) => ({
        symbol: asset.name,
        price: Number(mids[asset.name] || 0),
        base: asset.name.split("/")[0] || asset.name,
        quote: asset.name.split("/")[1] || "USD",
        szDecimals: asset.szDecimals,
      }))
  }

  async getOrderBook(symbol: string) {
    return this.info.l2Book({ coin: symbol })
  }

  async placeOrder(wallet: any, params: any) {
    const exchange = this.createExchangeClient(wallet)
    return exchange.order(params)
  }

  async cancelOrder(wallet: any, params: any) {
    const exchange = this.createExchangeClient(wallet)
    return exchange.cancel(params)
  }

  async initializeTradingWallet(walletInfo: any, viemAccount: any) {
    try {
      const exchange = this.createExchangeClient(viemAccount)
      const state = await this.getAccount(walletInfo.address)

      return {
        success: true,
        initialized: true,
        address: walletInfo.address,
        timestamp: new Date().toISOString(),
      }
    } catch (error: any) {
      console.error("[Hyperliquid] Failed to initialize trading wallet:", error)
      return {
        success: false,
        initialized: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }
}

export const hyperliquidService = new HyperliquidService()
