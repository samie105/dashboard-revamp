import mongoose, { Schema, Document, Model } from "mongoose"

export interface ISpotV2Ledger extends Document {
  userId: string
  token: string // "USDC" | "USDT"
  available: number
  locked: number
  createdAt: Date
  updatedAt: Date
}

const SpotV2LedgerSchema = new Schema<ISpotV2Ledger>(
  {
    userId: { type: String, required: true },
    token: { type: String, required: true },
    available: { type: Number, required: true, default: 0, min: 0 },
    locked: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
)

SpotV2LedgerSchema.index({ userId: 1, token: 1 }, { unique: true })

const SpotV2Ledger: Model<ISpotV2Ledger> =
  mongoose.models.SpotV2Ledger ??
  mongoose.model<ISpotV2Ledger>("SpotV2Ledger", SpotV2LedgerSchema)

export default SpotV2Ledger
