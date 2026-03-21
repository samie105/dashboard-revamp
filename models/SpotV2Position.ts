import mongoose, { Schema, Document, Model } from "mongoose"

export interface ISpotV2Position extends Document {
  userId: string
  token: string // e.g. "BTC", "ETH", "SOL"
  quantity: number
  avgEntryPrice: number
  createdAt: Date
  updatedAt: Date
}

const SpotV2PositionSchema = new Schema<ISpotV2Position>(
  {
    userId: { type: String, required: true },
    token: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    avgEntryPrice: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
)

SpotV2PositionSchema.index({ userId: 1, token: 1 }, { unique: true })
SpotV2PositionSchema.index({ userId: 1 })

const SpotV2Position: Model<ISpotV2Position> =
  mongoose.models.SpotV2Position ??
  mongoose.model<ISpotV2Position>("SpotV2Position", SpotV2PositionSchema)

export default SpotV2Position
