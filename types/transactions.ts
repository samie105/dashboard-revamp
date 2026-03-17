// ── Unified Transaction Types ──────────────────────────────────────────────
// Shared interface for normalizing all transaction types into a single shape.

export type UnifiedTransactionType =
  | "p2p"           // P2P buy/sell orders
  | "deposit"       // GlobalPay fiat→USDT deposits
  | "withdrawal"    // USDT→fiat bank withdrawals
  | "spot_deposit"  // Spot trading deposits
  | "spot_trade"    // Executed spot trades (LI.FI swaps)
  | "spot_order"    // Spot market/limit orders
  | "swap"          // Cross-chain bridge swaps
  | "transfer";     // Wallet sends & internal transfers

export type UnifiedTransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface UnifiedTransaction {
  id: string;
  type: UnifiedTransactionType;
  subType?: string; // e.g. "buy"/"sell", "send"/"receive"/"internal", "market"/"limit"

  // Amount
  amount: number;
  token: string;     // "USDT", "ETH", "SOL", "USDC", etc.
  chain?: string;    // "solana", "ethereum", "arbitrum", etc.

  // Status
  status: UnifiedTransactionStatus;

  // Fiat info (for deposits/withdrawals/p2p)
  fiatAmount?: number;
  fiatCurrency?: string;
  exchangeRate?: number;

  // Addresses
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;

  // Trade-specific
  pair?: string;                // "BTC/USDT", etc.
  side?: "buy" | "sell" | "BUY" | "SELL";
  price?: number;

  // Swap-specific
  fromToken?: string;
  toToken?: string;
  toAmount?: number | string;
  fromChain?: string;
  toChain?: string;

  // Bank details (withdrawals)
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };

  // Transfer direction
  direction?: string;

  // Dates
  createdAt: string;
  completedAt?: string;
}

export interface UnifiedTransactionsResponse {
  success: boolean;
  transactions: UnifiedTransaction[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;     // Base64-encoded cursor for infinite scroll
    total: number;
  };
  stats: TransactionStats;
}

export interface TransactionStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalTrades: number;
  totalSwaps: number;
  totalTransfers: number;
  depositVolume: number;    // Total USDT deposited
  withdrawalVolume: number; // Total USDT withdrawn
  netVolume: number;
}

export interface TransactionFilters {
  type?: UnifiedTransactionType;
  status?: UnifiedTransactionStatus;
  search?: string;
  dateFrom?: string;  // ISO date string
  dateTo?: string;    // ISO date string
  cursor?: string;    // For pagination
  limit?: number;
}
