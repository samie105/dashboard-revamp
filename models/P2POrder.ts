import mongoose, { Schema, Document, Model } from "mongoose";

export type P2POrderType = "buy" | "sell";
export type P2POrderStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_sent"
  | "completed"
  | "cancelled"
  | "expired";

export type FiatCurrency = "NGN" | "USD" | "GBP";

export interface IBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  sortCode?: string;
  routingNumber?: string;
}

export interface IP2POrder extends Document {
  authUserId: string;
  email: string;
  orderType: P2POrderType;
  usdtAmount: number;
  fiatAmount: number;
  fiatCurrency: FiatCurrency;
  exchangeRate: number;
  platformMarkup: number;
  userSolanaAddress: string;
  userBankDetails?: IBankDetails;
  status: P2POrderStatus;
  statusHistory: Array<{ status: P2POrderStatus; timestamp: Date; note?: string }>;
  paymentReference?: string;
  txHash?: string;
  adminNote?: string;
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const P2POrderSchema = new Schema<IP2POrder>(
  {
    authUserId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    orderType: { type: String, enum: ["buy", "sell"], required: true },
    usdtAmount: { type: Number, required: true },
    fiatAmount: { type: Number, required: true },
    fiatCurrency: { type: String, enum: ["NGN", "USD", "GBP"], required: true },
    exchangeRate: { type: Number, required: true },
    platformMarkup: { type: Number, required: true },
    userSolanaAddress: { type: String, required: true },
    userBankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      accountName: { type: String },
      sortCode: { type: String },
      routingNumber: { type: String },
    },
    status: {
      type: String,
      enum: ["pending", "awaiting_payment", "payment_sent", "completed", "cancelled", "expired"],
      default: "pending",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    paymentReference: { type: String },
    txHash: { type: String },
    adminNote: { type: String },
    expiresAt: { type: Date, required: true },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

P2POrderSchema.index({ status: 1, createdAt: -1 });
P2POrderSchema.index({ authUserId: 1, createdAt: -1 });

const P2POrder: Model<IP2POrder> =
  mongoose.models.P2POrder || mongoose.model<IP2POrder>("P2POrder", P2POrderSchema);

export default P2POrder;
