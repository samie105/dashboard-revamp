import mongoose, { Schema, Document, Model } from "mongoose"

export type SpotV2WithdrawalStatus =
  | "pending"       // Ledger debited, awaiting admin send
  | "processing"    // Admin is sending tokens on-chain
  | "completed"     // Tokens sent, tx confirmed
  | "failed"        // Send failed (ledger rolled back)

export interface ISpotV2Withdrawal extends Document {
  userId: string
  amount: number
  token: string
  chain: string
  destinationAddress: string
  txHash?: string
  status: SpotV2WithdrawalStatus
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

const SpotV2WithdrawalSchema = new Schema<ISpotV2Withdrawal>(
  {
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 5 },
    token: { type: String, required: true },
    chain: { type: String, required: true },
    destinationAddress: { type: String, required: true },
    txHash: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
)

SpotV2WithdrawalSchema.index({ userId: 1, status: 1 })

const SpotV2Withdrawal: Model<ISpotV2Withdrawal> =
  mongoose.models.SpotV2Withdrawal ??
  mongoose.model<ISpotV2Withdrawal>("SpotV2Withdrawal", SpotV2WithdrawalSchema)

export default SpotV2Withdrawal
