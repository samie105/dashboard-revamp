import mongoose, { Schema, Document, Model } from "mongoose"

export type SpotV2OrderType = "MARKET" | "LIMIT" | "STOP_LIMIT"
export type SpotV2OrderSide = "BUY" | "SELL"
export type SpotV2OrderStatus =
  | "OPEN"
  | "FILLED"
  | "CANCELLED"
  | "STOP_TRIGGERED"
  | "FAILED"

export interface ISpotV2Order extends Document {
  userId: string
  pair: string // "BTC/USDC"
  token: string // "BTC"
  side: SpotV2OrderSide
  orderType: SpotV2OrderType
  quantity: number
  limitPrice?: number // limit & stop-limit
  stopPrice?: number // stop-limit only
  fillPrice?: number // actual fill price
  quoteAmount: number // USDC amount of the fill (quantity × fillPrice or locked amount)
  lockedAmount: number // USDC locked for open buy orders, or token qty locked for sells
  status: SpotV2OrderStatus
  realizedPnl?: number
  fee: number
  filledAt?: Date
  cancelledAt?: Date
  createdAt: Date
  updatedAt: Date
}

const SpotV2OrderSchema = new Schema<ISpotV2Order>(
  {
    userId: { type: String, required: true, index: true },
    pair: { type: String, required: true },
    token: { type: String, required: true },
    side: { type: String, required: true, enum: ["BUY", "SELL"] },
    orderType: { type: String, required: true, enum: ["MARKET", "LIMIT", "STOP_LIMIT"] },
    quantity: { type: Number, required: true, min: 0 },
    limitPrice: { type: Number },
    stopPrice: { type: Number },
    fillPrice: { type: Number },
    quoteAmount: { type: Number, required: true, default: 0 },
    lockedAmount: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      required: true,
      enum: ["OPEN", "FILLED", "CANCELLED", "STOP_TRIGGERED", "FAILED"],
      default: "OPEN",
    },
    realizedPnl: { type: Number },
    fee: { type: Number, required: true, default: 0 },
    filledAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
)

SpotV2OrderSchema.index({ userId: 1, status: 1 })
SpotV2OrderSchema.index({ userId: 1, createdAt: -1 })
SpotV2OrderSchema.index({ status: 1, orderType: 1 }) // for cron scanning

const SpotV2Order: Model<ISpotV2Order> =
  mongoose.models.SpotV2Order ??
  mongoose.model<ISpotV2Order>("SpotV2Order", SpotV2OrderSchema)

export default SpotV2Order
