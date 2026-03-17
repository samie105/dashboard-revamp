import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISwapToken {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface ISwapTransaction extends Document {
  userId: string;
  txHash: string;
  receivingTxHash?: string;
  fromChain: string;
  toChain: string;
  fromChainId: number;
  toChainId: number;
  fromToken: ISwapToken;
  toToken: ISwapToken;
  fromAmount: string;
  toAmount: string;
  toAmountMin?: string;
  status: "PENDING" | "DONE" | "FAILED" | "NOT_FOUND";
  substatus?: string;
  substatusMessage?: string;
  gasCostUSD?: string;
  feeCostUSD?: string;
  tool?: string;
  toolLogoURI?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const SwapTokenSchema = new Schema<ISwapToken>(
  {
    chainId: { type: Number, required: true },
    address: { type: String, required: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    decimals: { type: Number, required: true },
    logoURI: { type: String },
  },
  { _id: false }
);

const SwapTransactionSchema = new Schema<ISwapTransaction>(
  {
    userId: { type: String, required: true, index: true },
    txHash: { type: String, required: true, unique: true },
    receivingTxHash: { type: String, sparse: true },
    fromChain: { type: String, required: true },
    toChain: { type: String, required: true },
    fromChainId: { type: Number, required: true },
    toChainId: { type: Number, required: true },
    fromToken: { type: SwapTokenSchema, required: true },
    toToken: { type: SwapTokenSchema, required: true },
    fromAmount: { type: String, required: true },
    toAmount: { type: String, required: true },
    toAmountMin: { type: String },
    status: { type: String, required: true, enum: ["PENDING", "DONE", "FAILED", "NOT_FOUND"], default: "PENDING" },
    substatus: String,
    substatusMessage: String,
    gasCostUSD: String,
    feeCostUSD: String,
    tool: String,
    toolLogoURI: String,
    completedAt: Date,
  },
  { timestamps: true }
);

SwapTransactionSchema.index({ userId: 1, createdAt: -1 });
SwapTransactionSchema.index({ userId: 1, status: 1 });

const SwapTransaction: Model<ISwapTransaction> =
  mongoose.models.SwapTransaction ||
  mongoose.model<ISwapTransaction>("SwapTransaction", SwapTransactionSchema);

export default SwapTransaction;
