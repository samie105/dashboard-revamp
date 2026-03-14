import mongoose, { Schema, type Document, type Model } from "mongoose"

export interface ITreasuryWallet extends Document {
  network: "solana" | "ethereum"
  address: string
  isActive: boolean
  label?: string
  createdAt: Date
  updatedAt: Date
}

const TreasuryWalletSchema = new Schema<ITreasuryWallet>(
  {
    network: { type: String, required: true, enum: ["solana", "ethereum"], index: true },
    address: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    label: { type: String },
  },
  { timestamps: true },
)

const TreasuryWallet: Model<ITreasuryWallet> =
  mongoose.models.TreasuryWallet ??
  mongoose.model<ITreasuryWallet>("TreasuryWallet", TreasuryWalletSchema)

export default TreasuryWallet
