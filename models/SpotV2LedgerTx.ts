import mongoose, { Schema, Document, Model } from "mongoose"

export interface ISpotV2LedgerTx extends Document {
  userId: string
  type: "deposit" | "withdraw" | "trade_buy" | "trade_sell" | "fee"
  token: string
  amount: number // positive = credit, negative = debit
  balanceAfter: number
  ref: string // adminDepositId, withdrawalId, or tradeId
  refModel: string // "SpotV2Deposit" | "SpotV2Withdrawal" | "SpotV2Trade"
  createdAt: Date
}

const SpotV2LedgerTxSchema = new Schema<ISpotV2LedgerTx>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["deposit", "withdraw", "trade_buy", "trade_sell", "fee"],
    },
    token: { type: String, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    ref: { type: String, required: true },
    refModel: { type: String, required: true },
  },
  { timestamps: true },
)

SpotV2LedgerTxSchema.index({ userId: 1, createdAt: -1 })
SpotV2LedgerTxSchema.index({ ref: 1, type: 1 }, { unique: true })

const SpotV2LedgerTx: Model<ISpotV2LedgerTx> =
  mongoose.models.SpotV2LedgerTx ??
  mongoose.model<ISpotV2LedgerTx>("SpotV2LedgerTx", SpotV2LedgerTxSchema)

export default SpotV2LedgerTx
