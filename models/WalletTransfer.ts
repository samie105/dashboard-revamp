import mongoose, { Schema, Document, Model } from "mongoose";

// ── Types ──────────────────────────────────────────────────────────────────

export type WalletTransferType = "send" | "receive" | "internal";

export type WalletTransferDirection =
  | "outgoing"
  | "incoming"
  | "spot-to-main"
  | "spot-to-futures"
  | "main-to-spot"
  | "futures-to-main"
  | "main-to-futures";

export type WalletTransferStatus = "pending" | "confirmed" | "failed";

export type WalletTransferChain =
  | "solana"
  | "ethereum"
  | "arbitrum"
  | "sui"
  | "ton"
  | "tron";

export interface IWalletTransfer extends Document {
  userId: string;
  type: WalletTransferType;
  direction: WalletTransferDirection;
  chain: WalletTransferChain;
  token: string;
  amount: number;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  status: WalletTransferStatus;
  memo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const WalletTransferSchema = new Schema<IWalletTransfer>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: ["send", "receive", "internal"] },
    direction: {
      type: String,
      required: true,
      enum: [
        "outgoing",
        "incoming",
        "spot-to-main",
        "spot-to-futures",
        "main-to-spot",
        "futures-to-main",
        "main-to-futures",
      ],
    },
    chain: {
      type: String,
      required: true,
      enum: ["solana", "ethereum", "arbitrum", "sui", "ton", "tron"],
    },
    token: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    fromAddress: { type: String },
    toAddress: { type: String },
    txHash: { type: String, sparse: true },
    status: {
      type: String,
      required: true,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
    },
    memo: { type: String },
  },
  { timestamps: true }
);

WalletTransferSchema.index({ userId: 1, createdAt: -1 });
WalletTransferSchema.index({ txHash: 1 });

const WalletTransfer: Model<IWalletTransfer> =
  mongoose.models.WalletTransfer ||
  mongoose.model<IWalletTransfer>("WalletTransfer", WalletTransferSchema);

export default WalletTransfer;
