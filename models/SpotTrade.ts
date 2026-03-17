import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISpotTrade extends Document {
  userId: string;
  txHash: string;
  chainId: number;
  pair: string;
  side: "BUY" | "SELL";
  fromTokenAddress: string;
  fromTokenSymbol: string;
  fromAmount: string;
  toTokenAddress: string;
  toTokenSymbol: string;
  toAmount: string;
  executionPrice: string;
  slippagePercent: number;
  gasUsed?: string;
  gasPriceGwei?: string;
  totalFeeUsd?: number;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  createdAt: Date;
  confirmedAt?: Date;
}

const SpotTradeSchema = new Schema<ISpotTrade>(
  {
    userId: { type: String, required: true, index: true },
    txHash: { type: String, required: true, unique: true, index: true },
    chainId: { type: Number, required: true },
    pair: { type: String, required: true, index: true },
    side: { type: String, required: true, enum: ["BUY", "SELL"] },
    fromTokenAddress: { type: String, required: true },
    fromTokenSymbol: { type: String, required: true },
    fromAmount: { type: String, required: true },
    toTokenAddress: { type: String, required: true },
    toTokenSymbol: { type: String, required: true },
    toAmount: { type: String, required: true },
    executionPrice: { type: String, required: true },
    slippagePercent: { type: Number, required: true },
    gasUsed: String,
    gasPriceGwei: String,
    totalFeeUsd: Number,
    status: { type: String, required: true, enum: ["PENDING", "CONFIRMED", "FAILED"], default: "PENDING" },
    confirmedAt: Date,
  },
  { timestamps: true }
);

SpotTradeSchema.index({ userId: 1, createdAt: -1 });
SpotTradeSchema.index({ pair: 1, createdAt: -1 });
SpotTradeSchema.index({ userId: 1, pair: 1, createdAt: -1 });

const SpotTrade: Model<ISpotTrade> =
  mongoose.models.SpotTrade || mongoose.model<ISpotTrade>("SpotTrade", SpotTradeSchema);

export default SpotTrade;
