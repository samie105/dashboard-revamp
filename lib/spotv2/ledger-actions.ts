"use server"

import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import SpotV2Ledger from "@/models/SpotV2Ledger"
import SpotV2Position from "@/models/SpotV2Position"
import SpotV2Order from "@/models/SpotV2Order"
import SpotV2Trade from "@/models/SpotV2Trade"
import { fetchSpotV2Pairs } from "./pairs"

// ── CoinGecko ID mapping (fallback price source) ────────────────────────

const COINGECKO_IDS: Record<string, string> = {
  btc: "bitcoin", eth: "ethereum", sol: "solana", bnb: "binancecoin",
  xrp: "ripple", ada: "cardano", doge: "dogecoin", dot: "polkadot",
  avax: "avalanche-2", link: "chainlink", matic: "matic-network",
  pol: "matic-network", shib: "shiba-inu", ltc: "litecoin", uni: "uniswap",
  atom: "cosmos", xlm: "stellar", near: "near", apt: "aptos", sui: "sui",
  arb: "arbitrum", op: "optimism", fil: "filecoin", hbar: "hedera-hashgraph",
  trx: "tron", ton: "the-open-network", pepe: "pepe", wif: "dogwifcoin",
}

// ── Types ────────────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  token: string // "BTC"
  side: "BUY" | "SELL"
  orderType: "MARKET" | "LIMIT" | "STOP_LIMIT"
  quantity: number
  limitPrice?: number
  stopPrice?: number
}

export interface PlaceOrderResult {
  success: boolean
  orderId?: string
  fillPrice?: number
  error?: string
}

export interface LedgerBalance {
  token: string
  available: number
  locked: number
}

export interface PositionInfo {
  token: string
  quantity: number
  avgEntryPrice: number
}

// ── Price fetch (CoinMarketCap primary, CoinGecko fallback) ──────────────

async function getTokenPrice(token: string): Promise<number | null> {
  // Primary: CoinMarketCap via cached pair data
  try {
    const pairs = await fetchSpotV2Pairs()
    const pair = pairs.find(
      (p) => p.symbol.toUpperCase() === token.toUpperCase(),
    )
    if (pair && pair.price > 0) return pair.price
  } catch {
    // CMC failed — try fallback
  }

  // Fallback: CoinGecko simple price
  try {
    const cgId = COINGECKO_IDS[token.toLowerCase()]
    if (cgId) {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(cgId)}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(5_000), cache: "no-store" },
      )
      if (res.ok) {
        const data = await res.json()
        const price = data[cgId]?.usd
        if (typeof price === "number" && price > 0) return price
      }
    }
  } catch {
    // All sources failed
  }

  console.error(`[SpotV2] Failed to fetch price for ${token} from all sources`)
  return null
}

// ── Auth helper ──────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error("Authentication required")
  return userId
}

// ── Constants ────────────────────────────────────────────────────────────

const MIN_ORDER_VALUE = 3
const QUOTE_TOKEN = "USDC"

// ── Place Order (market, limit, stop-limit) ──────────────────────────────

export async function placeSpotV2Order(
  params: PlaceOrderParams,
): Promise<PlaceOrderResult> {
  const userId = await requireUserId()
  await connectDB()

  const { token, side, orderType, quantity, limitPrice, stopPrice } = params
  const pair = `${token}/${QUOTE_TOKEN}`

  if (quantity <= 0) return { success: false, error: "Quantity must be positive" }

  // ── Market orders fill instantly ─────────────────────────────────────
  if (orderType === "MARKET") {
    const price = await getTokenPrice(token)
    if (!price) return { success: false, error: "Unable to fetch current price" }

    if (side === "BUY") {
      return executeBuy(userId, token, pair, quantity, price)
    } else {
      return executeSell(userId, token, pair, quantity, price)
    }
  }

  // ── Limit orders ─────────────────────────────────────────────────────
  if (orderType === "LIMIT") {
    if (!limitPrice || limitPrice <= 0)
      return { success: false, error: "Limit price required" }

    if (side === "BUY") {
      // Lock USDC for buy limit
      const lockAmount = quantity * limitPrice
      if (lockAmount < MIN_ORDER_VALUE)
        return { success: false, error: `Min order $${MIN_ORDER_VALUE}` }

      const ledger = await SpotV2Ledger.findOneAndUpdate(
        { userId, token: QUOTE_TOKEN, available: { $gte: lockAmount } },
        { $inc: { available: -lockAmount, locked: lockAmount } },
        { new: true },
      )
      if (!ledger)
        return { success: false, error: "Insufficient USDC balance" }

      const order = await SpotV2Order.create({
        userId,
        pair,
        token,
        side,
        orderType,
        quantity,
        limitPrice,
        quoteAmount: lockAmount,
        lockedAmount: lockAmount,
        status: "OPEN",
        fee: 0,
      })

      return { success: true, orderId: order._id.toString() }
    } else {
      // Sell limit: lock token quantity from position
      const position = await SpotV2Position.findOneAndUpdate(
        { userId, token, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true },
      )
      if (!position)
        return { success: false, error: `Insufficient ${token} balance` }

      const order = await SpotV2Order.create({
        userId,
        pair,
        token,
        side,
        orderType,
        quantity,
        limitPrice,
        quoteAmount: quantity * limitPrice,
        lockedAmount: quantity,
        status: "OPEN",
        fee: 0,
      })

      return { success: true, orderId: order._id.toString() }
    }
  }

  // ── Stop-limit orders ────────────────────────────────────────────────
  if (orderType === "STOP_LIMIT") {
    if (!stopPrice || stopPrice <= 0)
      return { success: false, error: "Stop price required" }
    if (!limitPrice || limitPrice <= 0)
      return { success: false, error: "Limit price required" }

    if (side === "BUY") {
      const lockAmount = quantity * limitPrice
      if (lockAmount < MIN_ORDER_VALUE)
        return { success: false, error: `Min order $${MIN_ORDER_VALUE}` }

      const ledger = await SpotV2Ledger.findOneAndUpdate(
        { userId, token: QUOTE_TOKEN, available: { $gte: lockAmount } },
        { $inc: { available: -lockAmount, locked: lockAmount } },
        { new: true },
      )
      if (!ledger)
        return { success: false, error: "Insufficient USDC balance" }

      const order = await SpotV2Order.create({
        userId,
        pair,
        token,
        side,
        orderType,
        quantity,
        limitPrice,
        stopPrice,
        quoteAmount: lockAmount,
        lockedAmount: lockAmount,
        status: "OPEN",
        fee: 0,
      })

      return { success: true, orderId: order._id.toString() }
    } else {
      const position = await SpotV2Position.findOneAndUpdate(
        { userId, token, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true },
      )
      if (!position)
        return { success: false, error: `Insufficient ${token} balance` }

      const order = await SpotV2Order.create({
        userId,
        pair,
        token,
        side,
        orderType,
        quantity,
        limitPrice,
        stopPrice,
        quoteAmount: quantity * limitPrice,
        lockedAmount: quantity,
        status: "OPEN",
        fee: 0,
      })

      return { success: true, orderId: order._id.toString() }
    }
  }

  return { success: false, error: "Invalid order type" }
}

// ── Execute Buy (instant market fill) ────────────────────────────────────

async function executeBuy(
  userId: string,
  token: string,
  pair: string,
  quantity: number,
  price: number,
): Promise<PlaceOrderResult> {
  const cost = quantity * price
  if (cost < MIN_ORDER_VALUE)
    return { success: false, error: `Min order $${MIN_ORDER_VALUE}. Yours: $${cost.toFixed(2)}` }

  // Debit USDC atomically
  const ledger = await SpotV2Ledger.findOneAndUpdate(
    { userId, token: QUOTE_TOKEN, available: { $gte: cost } },
    { $inc: { available: -cost } },
    { new: true },
  )
  if (!ledger)
    return { success: false, error: "Insufficient USDC balance" }

  // Update position: atomically increment quantity, then update avgEntryPrice
  const oldPosition = await SpotV2Position.findOneAndUpdate(
    { userId, token },
    { $inc: { quantity: quantity } },
    { upsert: true, setDefaultsOnInsert: true },
  )

  const oldQty = oldPosition?.quantity ?? 0
  const oldAvg = oldPosition?.avgEntryPrice ?? 0
  const newQty = oldQty + quantity
  const newAvg = newQty > 0 ? (oldQty * oldAvg + cost) / newQty : price
  await SpotV2Position.updateOne(
    { userId, token },
    { $set: { avgEntryPrice: newAvg } },
  )

  // Create order record
  const order = await SpotV2Order.create({
    userId,
    pair,
    token,
    side: "BUY",
    orderType: "MARKET",
    quantity,
    fillPrice: price,
    quoteAmount: cost,
    lockedAmount: 0,
    status: "FILLED",
    fee: 0,
    filledAt: new Date(),
  })

  // Create trade record
  await SpotV2Trade.create({
    userId,
    orderId: order._id,
    pair,
    token,
    side: "BUY",
    quantity,
    price,
    quoteAmount: cost,
    realizedPnl: 0,
    fee: 0,
  })

  return { success: true, orderId: order._id.toString(), fillPrice: price }
}

// ── Execute Sell (instant market fill) ───────────────────────────────────

async function executeSell(
  userId: string,
  token: string,
  pair: string,
  quantity: number,
  price: number,
): Promise<PlaceOrderResult> {
  const proceeds = quantity * price
  if (proceeds < MIN_ORDER_VALUE)
    return { success: false, error: `Min order $${MIN_ORDER_VALUE}. Yours: $${proceeds.toFixed(2)}` }

  // Atomically debit position (returns OLD doc for PnL calculation)
  const position = await SpotV2Position.findOneAndUpdate(
    { userId, token, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity } },
  )
  if (!position)
    return { success: false, error: `Insufficient ${token} balance` }

  // Compute realized PnL from pre-debit avgEntryPrice
  const realizedPnl = (price - position.avgEntryPrice) * quantity

  // If position is now fully closed, reset avgEntryPrice
  const remainingQty = position.quantity - quantity
  if (remainingQty < 1e-12) {
    await SpotV2Position.updateOne(
      { userId, token },
      { $set: { quantity: 0, avgEntryPrice: 0 } },
    )
  }

  // Credit USDC
  const ledger = await SpotV2Ledger.findOneAndUpdate(
    { userId, token: QUOTE_TOKEN },
    { $inc: { available: proceeds } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Create order record
  const order = await SpotV2Order.create({
    userId,
    pair,
    token,
    side: "SELL",
    orderType: "MARKET",
    quantity,
    fillPrice: price,
    quoteAmount: proceeds,
    lockedAmount: 0,
    status: "FILLED",
    realizedPnl,
    fee: 0,
    filledAt: new Date(),
  })

  // Create trade record
  await SpotV2Trade.create({
    userId,
    orderId: order._id,
    pair,
    token,
    side: "SELL",
    quantity,
    price,
    quoteAmount: proceeds,
    realizedPnl,
    fee: 0,
  })

  return { success: true, orderId: order._id.toString(), fillPrice: price }
}

// ── Cancel Order ─────────────────────────────────────────────────────────

export async function cancelSpotV2Order(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  const userId = await requireUserId()
  await connectDB()

  const order = await SpotV2Order.findById(orderId)
  if (!order) return { success: false, error: "Order not found" }
  if (order.userId !== userId) return { success: false, error: "Unauthorized" }
  if (order.status !== "OPEN" && order.status !== "STOP_TRIGGERED")
    return { success: false, error: "Order cannot be cancelled" }

  if (order.side === "BUY") {
    // Unlock USDC
    await SpotV2Ledger.findOneAndUpdate(
      { userId, token: QUOTE_TOKEN },
      { $inc: { available: order.lockedAmount, locked: -order.lockedAmount } },
    )
  } else {
    // Return token quantity to position
    await SpotV2Position.findOneAndUpdate(
      { userId, token: order.token },
      { $inc: { quantity: order.lockedAmount } },
      { upsert: true, setDefaultsOnInsert: true },
    )
  }

  order.status = "CANCELLED"
  order.cancelledAt = new Date()
  await order.save()

  return { success: true }
}

// ── Get Ledger Balance ───────────────────────────────────────────────────

export async function getSpotV2Balance(): Promise<LedgerBalance[]> {
  const userId = await requireUserId()
  await connectDB()

  const entries = await SpotV2Ledger.find({ userId }).lean()
  return (entries as Array<{ token: string; available: number; locked: number }>).map((e) => ({
    token: e.token,
    available: e.available,
    locked: e.locked,
  }))
}

// ── Get Positions ────────────────────────────────────────────────────────

export async function getSpotV2Positions(): Promise<PositionInfo[]> {
  const userId = await requireUserId()
  await connectDB()

  const positions = await SpotV2Position.find({ userId, quantity: { $gt: 0 } }).lean()
  return (positions as Array<{ token: string; quantity: number; avgEntryPrice: number }>).map((p) => ({
    token: p.token,
    quantity: p.quantity,
    avgEntryPrice: p.avgEntryPrice,
  }))
}

// ── Get Open Orders ──────────────────────────────────────────────────────

export async function getSpotV2OpenOrders() {
  const userId = await requireUserId()
  await connectDB()

  const orders = await SpotV2Order.find({
    userId,
    status: { $in: ["OPEN", "STOP_TRIGGERED"] },
  })
    .sort({ createdAt: -1 })
    .lean()

  return (orders as Array<{ _id: unknown; pair: string; token: string; side: string; orderType: string; quantity: number; limitPrice?: number; stopPrice?: number; lockedAmount: number; status: string; createdAt: Date }>).map((o) => ({
    id: String(o._id),
    pair: o.pair,
    token: o.token,
    side: o.side,
    orderType: o.orderType,
    quantity: o.quantity,
    limitPrice: o.limitPrice,
    stopPrice: o.stopPrice,
    lockedAmount: o.lockedAmount,
    status: o.status,
    createdAt: o.createdAt,
  }))
}

// ── Fill limit BUY (used by cron + future manual fills) ──────────────────

export async function fillLimitBuy(
  orderId: string,
  fillPrice: number,
): Promise<{ success: boolean; error?: string }> {
  await connectDB()

  // Atomically claim the order (prevents double-fill from concurrent cron runs)
  const order = await SpotV2Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ["OPEN", "STOP_TRIGGERED"] } },
    { $set: { status: "FILLED", fillPrice, filledAt: new Date() } },
    { new: true },
  )
  if (!order) return { success: false, error: "Order already filled or cancelled" }

  const { userId, token, pair, quantity, lockedAmount } = order

  // Unlock USDC (move from locked → spent, no refund of difference for better fills)
  // If fill is cheaper than locked, refund the difference
  const actualCost = quantity * fillPrice
  const refund = lockedAmount - actualCost

  if (refund > 0) {
    await SpotV2Ledger.findOneAndUpdate(
      { userId, token: QUOTE_TOKEN },
      { $inc: { locked: -lockedAmount, available: refund } },
    )
  } else {
    await SpotV2Ledger.findOneAndUpdate(
      { userId, token: QUOTE_TOKEN },
      { $inc: { locked: -lockedAmount } },
    )
  }

  // Update order with final quote amount
  order.quoteAmount = actualCost
  await order.save()

  // Update position: atomically increment quantity, then update avgEntryPrice
  const oldPosition = await SpotV2Position.findOneAndUpdate(
    { userId, token },
    { $inc: { quantity: quantity } },
    { upsert: true, setDefaultsOnInsert: true },
  )

  const oldQty = oldPosition?.quantity ?? 0
  const oldAvg = oldPosition?.avgEntryPrice ?? 0
  const newQty = oldQty + quantity
  const newAvg = newQty > 0 ? (oldQty * oldAvg + actualCost) / newQty : fillPrice
  await SpotV2Position.updateOne(
    { userId, token },
    { $set: { avgEntryPrice: newAvg } },
  )

  // Create trade record
  await SpotV2Trade.create({
    userId,
    orderId: order._id,
    pair,
    token,
    side: "BUY",
    quantity,
    price: fillPrice,
    quoteAmount: actualCost,
    realizedPnl: 0,
    fee: 0,
  })

  return { success: true }
}

// ── Fill limit SELL (used by cron + future manual fills) ─────────────────

export async function fillLimitSell(
  orderId: string,
  fillPrice: number,
): Promise<{ success: boolean; error?: string }> {
  await connectDB()

  // Atomically claim the order
  const order = await SpotV2Order.findOneAndUpdate(
    { _id: orderId, status: { $in: ["OPEN", "STOP_TRIGGERED"] } },
    { $set: { status: "FILLED", fillPrice, filledAt: new Date() } },
    { new: true },
  )
  if (!order) return { success: false, error: "Order already filled or cancelled" }

  const { userId, token, pair, quantity } = order
  const proceeds = quantity * fillPrice

  // Compute realized PnL from position's avg entry price
  const position = await SpotV2Position.findOne({ userId, token })
  const avgEntry = position?.avgEntryPrice ?? 0
  const realizedPnl = (fillPrice - avgEntry) * quantity

  // Token qty was already deducted from position at order placement time (locked).
  // No position update needed — tokens were removed when the limit sell was placed.

  // Credit USDC
  await SpotV2Ledger.findOneAndUpdate(
    { userId, token: QUOTE_TOKEN },
    { $inc: { available: proceeds } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  // Update order with PnL
  order.quoteAmount = proceeds
  order.realizedPnl = realizedPnl
  await order.save()

  // Create trade record
  await SpotV2Trade.create({
    userId,
    orderId: order._id,
    pair,
    token,
    side: "SELL",
    quantity,
    price: fillPrice,
    quoteAmount: proceeds,
    realizedPnl,
    fee: 0,
  })

  return { success: true }
}

// ── Batch fetch token prices ─────────────────────────────────────────────

export async function getTokenPrices(
  tokens: string[],
): Promise<Map<string, number>> {
  // Bulk fetch from CMC pairs cache first
  const prices = new Map<string, number>()
  try {
    const pairs = await fetchSpotV2Pairs()
    for (const token of tokens) {
      const pair = pairs.find(
        (p) => p.symbol.toUpperCase() === token.toUpperCase(),
      )
      if (pair && pair.price > 0) prices.set(token, pair.price)
    }
  } catch {
    // CMC failed — fall through to individual CoinGecko lookups
  }

  // Fill any missing tokens from CoinGecko
  const missing = tokens.filter((t) => !prices.has(t))
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.map(async (token) => {
        const price = await getTokenPrice(token)
        if (price !== null) prices.set(token, price)
      }),
    )
  }

  return prices
}

/** @deprecated Use getTokenPrices instead */
export const getBinancePrices = getTokenPrices

// ── Get Trade History ────────────────────────────────────────────────────

export async function getSpotV2TradeHistory(limit = 50) {
  const userId = await requireUserId()
  await connectDB()

  const trades = await SpotV2Trade.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return (trades as Array<{ _id: unknown; pair: string; token: string; side: string; quantity: number; price: number; quoteAmount: number; realizedPnl: number; fee: number; createdAt: Date }>).map((t) => ({
    id: String(t._id),
    pair: t.pair,
    token: t.token,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    quoteAmount: t.quoteAmount,
    realizedPnl: t.realizedPnl,
    fee: t.fee,
    createdAt: t.createdAt,
  }))
}
