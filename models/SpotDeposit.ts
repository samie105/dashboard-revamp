import mongoose, { Schema, Document, Model } from "mongoose"

export type SpotDepositStatus =
  | "initiated" // Deposit request created, treasury address assigned
  | "sending_usdt" // Server-side Privy send of USDT in progress
  | "awaiting_deposit" // USDT sent on-chain, waiting for admin watcher to detect
  | "deposit_detected" // Admin backend detected the on-chain USDT transfer
  | "disbursing" // Admin backend sending Arb USDC to trading wallet
  | "disbursed" // Arb USDC arrived in trading wallet
  | "bridging" // Trading wallet → HL Bridge2
  | "transferring" // usdClassTransfer Perps → Spot
  | "completed" // Funds ready for spot trading
  | "failed" // Any step failed
  | "expired" // No deposit within timeout period

export interface ISpotDeposit extends Document {
  userId: string
  email?: string

  depositChain: "ethereum" | "solana"
  depositToken: "USDT" | "USDC"
  depositAmount: number
  depositFromAddress?: string

  treasuryAddress: string
  treasuryChain: string

  adminDepositId?: string

  tradingWalletAddress: string
  tradingWalletId: string

  depositTxHash?: string
  disburseTxHash?: string
  bridgeTxHash?: string

  status: SpotDepositStatus
  errorMessage?: string

  disbursedAmount?: number
  bridgedAmount?: number
  spotAmount?: number

  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

const SpotDepositSchema = new Schema<ISpotDeposit>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    email: String,

    depositChain: {
      type: String,
      required: true,
      enum: ["ethereum", "solana"],
    },
    depositToken: {
      type: String,
      required: true,
      enum: ["USDT", "USDC"],
      default: "USDT",
    },
    depositAmount: {
      type: Number,
      required: true,
      min: 5,
    },
    depositFromAddress: String,

    treasuryAddress: {
      type: String,
      required: true,
    },
    treasuryChain: {
      type: String,
      required: true,
    },

    adminDepositId: {
      type: String,
      sparse: true,
    },

    tradingWalletAddress: {
      type: String,
      required: true,
    },
    tradingWalletId: {
      type: String,
      required: true,
    },

    depositTxHash: String,
    disburseTxHash: String,
    bridgeTxHash: String,

    status: {
      type: String,
      required: true,
      enum: [
        "initiated",
        "sending_usdt",
        "awaiting_deposit",
        "deposit_detected",
        "disbursing",
        "disbursed",
        "bridging",
        "transferring",
        "completed",
        "failed",
        "expired",
      ],
      default: "initiated",
      index: true,
    },
    errorMessage: String,

    disbursedAmount: Number,
    bridgedAmount: Number,
    spotAmount: Number,
    completedAt: Date,
  },
  { timestamps: true },
)

SpotDepositSchema.index({ userId: 1, status: 1 })
SpotDepositSchema.index({ adminDepositId: 1 })

const SpotDeposit: Model<ISpotDeposit> =
  mongoose.models.SpotDeposit ||
  mongoose.model<ISpotDeposit>("SpotDeposit", SpotDepositSchema)

export default SpotDeposit
