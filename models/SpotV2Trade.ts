import mongoose, { Schema, Document, Model } from "mongoose"

export interface ISpotV2Trade extends Document {
  userId: string
  orderId: mongoose.Types.ObjectId
  pair: string // "BTC/USDC"
  token: string // "BTC"
  side: "BUY" | "SELL"
  quantity: number
  price: number
  quoteAmount: number // quantity × price
  realizedPnl: number // 0 for buys, computed for sells
  fee: number
  createdAt: Date
}

const SpotV2TradeSchema = new Schema<ISpotV2Trade>(
  {
    userId: { type: String, required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "SpotV2Order" },
    pair: { type: String, required: true },
    token: { type: String, required: true },
    side: { type: String, required: true, enum: ["BUY", "SELL"] },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    quoteAmount: { type: Number, required: true },
    realizedPnl: { type: Number, required: true, default: 0 },
    fee: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
)

SpotV2TradeSchema.index({ userId: 1, createdAt: -1 })
SpotV2TradeSchema.index({ userId: 1, pair: 1, createdAt: -1 })

const SpotV2Trade: Model<ISpotV2Trade> =
  mongoose.models.SpotV2Trade ??
  mongoose.model<ISpotV2Trade>("SpotV2Trade", SpotV2TradeSchema)

export default SpotV2Trade
