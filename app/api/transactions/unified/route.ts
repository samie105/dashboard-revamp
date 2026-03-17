import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectDB } from "@/lib/mongodb";
import P2POrder from "@/models/P2POrder";
import Deposit from "@/models/Deposit";
import Withdrawal from "@/models/Withdrawal";
import SpotDeposit from "@/models/SpotDeposit";
import SpotTrade from "@/models/SpotTrade";
import SwapTransaction from "@/models/SwapTransaction";
import WalletTransfer from "@/models/WalletTransfer";
import type {
  UnifiedTransaction,
  UnifiedTransactionType,
  UnifiedTransactionStatus,
  TransactionStats,
} from "@/types/transactions";

// ── Status normalizers ─────────────────────────────────────────────────────

function normalizeP2PStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    case "expired": return "expired";
    case "pending": return "pending";
    default: return "processing";
  }
}

function normalizeDepositStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "completed": return "completed";
    case "payment_failed": case "delivery_failed": return "failed";
    case "cancelled": return "cancelled";
    case "pending": return "pending";
    default: return "processing";
  }
}

function normalizeWithdrawalStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "completed": return "completed";
    case "failed": return "failed";
    case "cancelled": return "cancelled";
    case "pending": return "pending";
    default: return "processing";
  }
}

function normalizeSpotDepositStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "completed": return "completed";
    case "failed": return "failed";
    case "expired": return "expired";
    case "initiated": return "pending";
    default: return "processing";
  }
}

function normalizeSpotTradeStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "CONFIRMED": return "completed";
    case "FAILED": return "failed";
    case "PENDING": return "pending";
    default: return "processing";
  }
}

function normalizeSwapStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "DONE": return "completed";
    case "FAILED": return "failed";
    case "NOT_FOUND": return "failed";
    case "PENDING": return "pending";
    default: return "processing";
  }
}

function normalizeTransferStatus(status: string): UnifiedTransactionStatus {
  switch (status) {
    case "confirmed": return "completed";
    case "failed": return "failed";
    default: return "pending";
  }
}

// ── Normalizers per model ──────────────────────────────────────────────────

function normalizeP2P(doc: Record<string, unknown>): UnifiedTransaction {
  return {
    id: String(doc._id),
    type: "p2p",
    subType: doc.orderType as string,
    amount: doc.usdtAmount as number,
    token: "USDT",
    chain: "solana",
    status: normalizeP2PStatus(doc.status as string),
    fiatAmount: doc.fiatAmount as number,
    fiatCurrency: doc.fiatCurrency as string,
    exchangeRate: doc.exchangeRate as number,
    txHash: doc.txHash as string | undefined,
    fromAddress: doc.userSolanaAddress as string | undefined,
    side: (doc.orderType === "buy" ? "buy" : "sell"),
    bankDetails: doc.userBankDetails as UnifiedTransaction["bankDetails"],
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    completedAt: doc.completedAt ? ((doc.completedAt as Date)?.toISOString?.() ?? String(doc.completedAt)) : undefined,
  };
}

function normalizeDeposit(doc: Record<string, unknown>): UnifiedTransaction {
  return {
    id: String(doc._id),
    type: "deposit",
    subType: "fiat_deposit",
    amount: doc.usdtAmount as number,
    token: "USDT",
    chain: (doc.network as string) || "solana",
    status: normalizeDepositStatus(doc.status as string),
    fiatAmount: doc.fiatAmount as number,
    fiatCurrency: doc.fiatCurrency as string,
    exchangeRate: doc.exchangeRate as number,
    txHash: doc.txHash as string | undefined,
    toAddress: doc.userWalletAddress as string | undefined,
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    completedAt: doc.completedAt ? ((doc.completedAt as Date)?.toISOString?.() ?? String(doc.completedAt)) : undefined,
  };
}

function normalizeWithdrawal(doc: Record<string, unknown>): UnifiedTransaction {
  return {
    id: String(doc._id),
    type: "withdrawal",
    subType: "fiat_withdrawal",
    amount: doc.usdtAmount as number,
    token: "USDT",
    chain: doc.chain as string,
    status: normalizeWithdrawalStatus(doc.status as string),
    fiatAmount: doc.fiatAmount as number,
    fiatCurrency: doc.fiatCurrency as string,
    exchangeRate: doc.exchangeRate as number,
    txHash: doc.txHash as string | undefined,
    fromAddress: doc.userWalletAddress as string | undefined,
    toAddress: doc.treasuryWalletAddress as string | undefined,
    bankDetails: doc.bankDetails as UnifiedTransaction["bankDetails"],
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    completedAt: doc.completedAt ? ((doc.completedAt as Date)?.toISOString?.() ?? String(doc.completedAt)) : undefined,
  };
}

function normalizeSpotDeposit(doc: Record<string, unknown>): UnifiedTransaction {
  return {
    id: String(doc._id),
    type: "spot_deposit",
    subType: "spot",
    amount: doc.depositAmount as number,
    token: (doc.depositToken as string) || "USDT",
    chain: doc.depositChain as string,
    status: normalizeSpotDepositStatus(doc.status as string),
    txHash: doc.depositTxHash as string | undefined,
    toAddress: doc.treasuryAddress as string | undefined,
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    completedAt: doc.completedAt ? ((doc.completedAt as Date)?.toISOString?.() ?? String(doc.completedAt)) : undefined,
  };
}

function normalizeSpotTrade(doc: Record<string, unknown>): UnifiedTransaction {
  return {
    id: String(doc._id),
    type: "spot_trade",
    subType: (doc.side as string)?.toLowerCase(),
    amount: parseFloat(doc.fromAmount as string) || 0,
    token: doc.fromTokenSymbol as string,
    chain: "arbitrum",
    status: normalizeSpotTradeStatus(doc.status as string),
    txHash: doc.txHash as string | undefined,
    pair: doc.pair as string,
    side: doc.side as "BUY" | "SELL",
    price: parseFloat(doc.executionPrice as string) || undefined,
    fromToken: doc.fromTokenSymbol as string,
    toToken: doc.toTokenSymbol as string,
    toAmount: doc.toAmount as string,
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    completedAt: doc.confirmedAt ? ((doc.confirmedAt as Date)?.toISOString?.() ?? String(doc.confirmedAt)) : undefined,
  };
}

function normalizeSwap(doc: Record<string, unknown>): UnifiedTransaction {
  const fromToken = doc.fromToken as Record<string, unknown> | undefined;
  const toToken = doc.toToken as Record<string, unknown> | undefined;
  return {
    id: String(doc._id),
    type: "swap",
    subType: "bridge",
    amount: parseFloat(doc.fromAmount as string) || 0,
    token: (fromToken?.symbol as string) || "unknown",
    chain: doc.fromChain as string,
    status: normalizeSwapStatus(doc.status as string),
    txHash: doc.txHash as string | undefined,
    fromToken: fromToken?.symbol as string | undefined,
    toToken: toToken?.symbol as string | undefined,
    toAmount: doc.toAmount as string,
    fromChain: doc.fromChain as string,
    toChain: doc.toChain as string,
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    completedAt: doc.completedAt ? ((doc.completedAt as Date)?.toISOString?.() ?? String(doc.completedAt)) : undefined,
  };
}

function normalizeTransfer(doc: Record<string, unknown>): UnifiedTransaction {
  return {
    id: String(doc._id),
    type: "transfer",
    subType: doc.type as string,
    amount: doc.amount as number,
    token: doc.token as string,
    chain: doc.chain as string,
    status: normalizeTransferStatus(doc.status as string),
    txHash: doc.txHash as string | undefined,
    fromAddress: doc.fromAddress as string | undefined,
    toAddress: doc.toAddress as string | undefined,
    direction: doc.direction as string,
    createdAt: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
  };
}

// ── Cursor helpers ─────────────────────────────────────────────────────────

function encodeCursor(date: string, id: string): string {
  return Buffer.from(`${date}|${id}`).toString("base64");
}

function decodeCursor(cursor: string): { date: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [date, id] = decoded.split("|");
    if (!date || !id) return null;
    return { date, id };
  } catch {
    return null;
  }
}

// ── Search filter ──────────────────────────────────────────────────────────

function matchesSearch(tx: UnifiedTransaction, search: string): boolean {
  const q = search.toLowerCase();
  if (tx.txHash?.toLowerCase().includes(q)) return true;
  if (tx.token?.toLowerCase().includes(q)) return true;
  if (tx.pair?.toLowerCase().includes(q)) return true;
  if (tx.fromToken?.toLowerCase().includes(q)) return true;
  if (tx.toToken?.toLowerCase().includes(q)) return true;
  if (tx.chain?.toLowerCase().includes(q)) return true;
  if (tx.fromAddress?.toLowerCase().includes(q)) return true;
  if (tx.toAddress?.toLowerCase().includes(q)) return true;
  if (String(tx.amount).includes(q)) return true;
  if (tx.fiatAmount != null && String(tx.fiatAmount).includes(q)) return true;
  if (tx.bankDetails?.bankName?.toLowerCase().includes(q)) return true;
  if (tx.bankDetails?.accountName?.toLowerCase().includes(q)) return true;
  if (tx.direction?.toLowerCase().includes(q)) return true;
  return false;
}

// ── GET handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get("type") as UnifiedTransactionType | null;
    const statusFilter = searchParams.get("status") as UnifiedTransactionStatus | null;
    const search = searchParams.get("search") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const statsOnly = searchParams.get("statsOnly") === "true";

    const dateQuery: Record<string, unknown> = {};
    if (dateFrom) dateQuery.$gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      dateQuery.$lte = to;
    }

    let cursorDate: Date | null = null;
    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (parsed) cursorDate = new Date(parsed.date);
    }

    function buildQuery(userField: string) {
      const q: Record<string, unknown> = { [userField]: userId };
      if (Object.keys(dateQuery).length > 0) q.createdAt = dateQuery;
      if (cursorDate) q.createdAt = { ...((q.createdAt as Record<string, unknown>) || {}), $lt: cursorDate };
      return q;
    }

    const shouldQuery = (type: UnifiedTransactionType) => !typeFilter || typeFilter === type;
    const fetchLimit = limit + 50;

    const [p2pDocs, depositDocs, withdrawalDocs, spotDepositDocs, spotTradeDocs, swapDocs, transferDocs] =
      await Promise.all([
        shouldQuery("p2p")
          ? P2POrder.find(buildQuery("authUserId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
        shouldQuery("deposit")
          ? Deposit.find(buildQuery("userId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
        shouldQuery("withdrawal")
          ? Withdrawal.find(buildQuery("userId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
        shouldQuery("spot_deposit")
          ? SpotDeposit.find(buildQuery("userId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
        shouldQuery("spot_trade")
          ? SpotTrade.find(buildQuery("userId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
        shouldQuery("swap")
          ? SwapTransaction.find(buildQuery("userId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
        shouldQuery("transfer")
          ? WalletTransfer.find(buildQuery("userId")).sort({ createdAt: -1 }).limit(fetchLimit).lean()
          : Promise.resolve([]),
      ]);

    const all: UnifiedTransaction[] = [
      ...(p2pDocs as Record<string, unknown>[]).map(normalizeP2P),
      ...(depositDocs as Record<string, unknown>[]).map(normalizeDeposit),
      ...(withdrawalDocs as Record<string, unknown>[]).map(normalizeWithdrawal),
      ...(spotDepositDocs as Record<string, unknown>[]).map(normalizeSpotDeposit),
      ...(spotTradeDocs as Record<string, unknown>[]).map(normalizeSpotTrade),
      ...(swapDocs as Record<string, unknown>[]).map(normalizeSwap),
      ...(transferDocs as Record<string, unknown>[]).map(normalizeTransfer),
    ];

    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let filtered = all;
    if (statusFilter) {
      filtered = filtered.filter((tx) => tx.status === statusFilter);
    }
    if (search) {
      filtered = filtered.filter((tx) => matchesSearch(tx, search));
    }

    const stats: TransactionStats = {
      totalDeposits: [...(p2pDocs as Record<string, unknown>[]).filter((d) => d.orderType === "buy"),
        ...(depositDocs as Record<string, unknown>[])].length,
      totalWithdrawals: [...(p2pDocs as Record<string, unknown>[]).filter((d) => d.orderType === "sell"),
        ...(withdrawalDocs as Record<string, unknown>[])].length,
      totalTrades: (spotTradeDocs as Record<string, unknown>[]).length,
      totalSwaps: (swapDocs as Record<string, unknown>[]).length,
      totalTransfers: (transferDocs as Record<string, unknown>[]).length,
      depositVolume:
        (depositDocs as Record<string, unknown>[])
          .filter((d) => d.status === "completed")
          .reduce((s, d) => s + ((d.usdtAmount as number) || 0), 0) +
        (p2pDocs as Record<string, unknown>[])
          .filter((d) => d.orderType === "buy" && d.status === "completed")
          .reduce((s, d) => s + ((d.usdtAmount as number) || 0), 0),
      withdrawalVolume:
        (withdrawalDocs as Record<string, unknown>[])
          .filter((d) => d.status === "completed")
          .reduce((s, d) => s + ((d.usdtAmount as number) || 0), 0) +
        (p2pDocs as Record<string, unknown>[])
          .filter((d) => d.orderType === "sell" && d.status === "completed")
          .reduce((s, d) => s + ((d.usdtAmount as number) || 0), 0),
      netVolume: 0,
    };
    stats.netVolume = stats.depositVolume - stats.withdrawalVolume;

    if (statsOnly) {
      return NextResponse.json({ success: true, stats });
    }

    const page = filtered.slice(0, limit);
    const hasMore = filtered.length > limit;
    let nextCursor: string | undefined;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor(last.createdAt, last.id);
    }

    return NextResponse.json({
      success: true,
      transactions: page,
      pagination: { hasMore, nextCursor, total: all.length },
      stats,
    });
  } catch (error) {
    console.error("Unified transactions error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
