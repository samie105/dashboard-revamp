import mongoose, { Schema, Document, Model } from "mongoose"

export type SpotV2DepositStatus =
  | "initiated"           // Deposit request created, treasury address assigned
  | "sending"             // Auto-send from Privy wallet in progress
  | "awaiting_confirmation" // Sent on-chain, waiting for admin watcher to detect
  | "verified"            // Admin detected on-chain transfer
  | "completed"           // Ledger credited
  | "failed"
  | "expired"

export interface ISpotV2Deposit extends Document {
  userId: string
  adminDepositId: string
  depositChain: "ethereum" | "solana" | "tron"
  depositToken: "USDT" | "USDC"
  depositAmount: number
  depositFromAddress: string
  treasuryAddress: string
  treasuryChain: string
  depositTxHash?: string
  status: SpotV2DepositStatus
  credited: boolean
  creditedAmount: number
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

const SpotV2DepositSchema = new Schema<ISpotV2Deposit>(
  {
    userId: { type: String, required: true, index: true },
    adminDepositId: { type: String, required: true, unique: true },
    depositChain: {
      type: String,
      required: true,
      enum: ["ethereum", "solana", "tron"],
    },
    depositToken: {
      type: String,
      required: true,
      enum: ["USDT", "USDC"],
    },
    depositAmount: { type: Number, required: true, min: 5 },
    depositFromAddress: { type: String, required: true },
    treasuryAddress: { type: String, required: true },
    treasuryChain: { type: String, required: true },
    depositTxHash: { type: String, default: null },
    status: {
      type: String,
      required: true,
      enum: [
        "initiated",
        "sending",
        "awaiting_confirmation",
        "verified",
        "completed",
        "failed",
        "expired",
      ],
      default: "initiated",
      index: true,
    },
    credited: { type: Boolean, required: true, default: false },
    creditedAmount: { type: Number, required: true, default: 0 },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
)

SpotV2DepositSchema.index({ userId: 1, status: 1 })

const SpotV2Deposit: Model<ISpotV2Deposit> =
  mongoose.models.SpotV2Deposit ??
  mongoose.model<ISpotV2Deposit>("SpotV2Deposit", SpotV2DepositSchema)

export default SpotV2Deposit
