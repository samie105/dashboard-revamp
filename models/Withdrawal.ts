import mongoose, { Schema, type Document, type Model } from "mongoose"

// ── Types ──────────────────────────────────────────────────────────────────

export type WithdrawalStatus =
  | "pending"
  | "usdt_sent"
  | "tx_verified"
  | "processing"
  | "ngn_sent"
  | "completed"
  | "failed"
  | "cancelled"

export type WithdrawalChain = "solana" | "ethereum"

export interface IWithdrawalBankDetails {
  bankName: string
  accountNumber: string
  accountName: string
}

export interface IWithdrawal extends Document {
  userId: string
  email: string
  usdtAmount: number
  fiatAmount: number
  fiatCurrency: string
  exchangeRate: number
  chain: WithdrawalChain
  userWalletAddress: string
  treasuryWalletAddress: string
  txHash?: string
  txVerified: boolean
  txVerifiedAt?: Date
  bankDetails: IWithdrawalBankDetails
  status: WithdrawalStatus
  payoutReference?: string
  adminNote?: string
  adminActions: Array<{
    action: string
    adminEmail: string
    note?: string
    timestamp: Date
  }>
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

// ── Schema ─────────────────────────────────────────────────────────────────

const WithdrawalSchema = new Schema<IWithdrawal>(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    usdtAmount: { type: Number, required: true, min: 1, max: 5000 },
    fiatAmount: { type: Number, required: true },
    fiatCurrency: { type: String, required: true, default: "NGN" },
    exchangeRate: { type: Number, required: true },
    chain: { type: String, required: true, enum: ["solana", "ethereum"] },
    userWalletAddress: { type: String, required: true },
    treasuryWalletAddress: { type: String, required: true },
    txHash: { type: String, sparse: true },
    txVerified: { type: Boolean, default: false },
    txVerifiedAt: { type: Date },
    bankDetails: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountName: { type: String, required: true },
    },
    status: {
      type: String,
      required: true,
      enum: [
        "pending",
        "usdt_sent",
        "tx_verified",
        "processing",
        "ngn_sent",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    payoutReference: { type: String },
    adminNote: { type: String },
    adminActions: [
      {
        action: { type: String, required: true },
        adminEmail: { type: String, required: true },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    completedAt: { type: Date },
  },
  { timestamps: true },
)

WithdrawalSchema.index({ userId: 1, createdAt: -1 })
WithdrawalSchema.index({ status: 1, createdAt: -1 })

const Withdrawal: Model<IWithdrawal> =
  mongoose.models.Withdrawal ??
  mongoose.model<IWithdrawal>("Withdrawal", WithdrawalSchema)

export default Withdrawal
