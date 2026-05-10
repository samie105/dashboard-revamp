import mongoose from "mongoose"

const UserWalletSchema = new mongoose.Schema(
  {
    clerkUserId: { type: String, index: true },
    email: { type: String, required: true, unique: true, index: true },
    privyUserId: { type: String, required: true, unique: true },
    privy_type: { type: Number, enum: [0, 1], default: 1 }, // 0 = old privy, 1 = new privy
    wallets: {
      ethereum: { walletId: String, address: String, publicKey: String },
      solana: { walletId: String, address: String, publicKey: String },
      sui: { walletId: String, address: String, publicKey: String },
      ton: { walletId: String, address: String, publicKey: String },
      tron: { walletId: String, address: String, publicKey: String },
    },
    tradingWallet: {
      walletId: String,
      address: String,
      chainType: String,
      initialized: { type: Boolean, default: false },
      timestamp: Date,
    },
  },
  { timestamps: true },
)

export const UserWallet =
  mongoose.models.UserWallet ?? mongoose.model("UserWallet", UserWalletSchema)
