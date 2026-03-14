"use server"

import { auth } from "@clerk/nextjs/server"
import { connectDB } from "@/lib/mongodb"
import Deposit, { type DepositStatus } from "@/models/Deposit"
import Withdrawal, { type WithdrawalStatus } from "@/models/Withdrawal"

// ── Types ────────────────────────────────────────────────────────────────

export type TransactionType = "deposit" | "withdrawal"

export type UnifiedTransaction = {
  _id: string
  type: TransactionType
  usdtAmount: number
  fiatAmount: number
  fiatCurrency: string
  exchangeRate: number
  status: string
  txHash?: string
  network?: string
  chain?: string
  bankDetails?: { bankName: string; accountNumber: string; accountName: string }
  createdAt: string
  completedAt?: string
}

export type TransactionStats = {
  totalDeposits: number
  totalWithdrawals: number
  inProgress: number
  netVolume: number
}

export type TransactionsResult = {
  success: boolean
  transactions?: UnifiedTransaction[]
  stats?: TransactionStats
  error?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

const COMPLETED_DEPOSIT: DepositStatus[] = ["completed"]
const COMPLETED_WITHDRAWAL: WithdrawalStatus[] = ["completed"]
const IN_PROGRESS_DEPOSIT: DepositStatus[] = ["pending", "awaiting_verification", "verifying", "payment_confirmed", "sending_usdt"]
const IN_PROGRESS_WITHDRAWAL: WithdrawalStatus[] = ["pending", "usdt_sent", "tx_verified", "processing", "ngn_sent"]

// ── Server Actions ───────────────────────────────────────────────────────

export async function fetchTransactions(): Promise<TransactionsResult> {
  try {
    const { userId } = await auth()
    if (!userId) return { success: false, error: "Unauthorized" }

    await connectDB()

    const [deposits, withdrawals] = await Promise.all([
      Deposit.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
      Withdrawal.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
    ])

    // Calculate stats
    const totalDeposits = deposits
      .filter((d) => COMPLETED_DEPOSIT.includes(d.status as DepositStatus))
      .reduce((sum, d) => sum + (d.usdtAmount ?? 0), 0)

    const totalWithdrawals = withdrawals
      .filter((w) => COMPLETED_WITHDRAWAL.includes(w.status as WithdrawalStatus))
      .reduce((sum, w) => sum + (w.usdtAmount ?? 0), 0)

    const inProgress =
      deposits.filter((d) => IN_PROGRESS_DEPOSIT.includes(d.status as DepositStatus)).length +
      withdrawals.filter((w) => IN_PROGRESS_WITHDRAWAL.includes(w.status as WithdrawalStatus)).length

    const stats: TransactionStats = {
      totalDeposits,
      totalWithdrawals,
      inProgress,
      netVolume: totalDeposits - totalWithdrawals,
    }

    // Merge into unified list sorted by date
    const unified: UnifiedTransaction[] = [
      ...deposits.map((d) => ({
        _id: String(d._id),
        type: "deposit" as const,
        usdtAmount: d.usdtAmount,
        fiatAmount: d.fiatAmount,
        fiatCurrency: d.fiatCurrency,
        exchangeRate: d.exchangeRate,
        status: d.status,
        txHash: d.txHash ?? undefined,
        network: d.network ?? undefined,
        createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
        completedAt: d.completedAt instanceof Date ? d.completedAt.toISOString() : undefined,
      })),
      ...withdrawals.map((w) => ({
        _id: String(w._id),
        type: "withdrawal" as const,
        usdtAmount: w.usdtAmount,
        fiatAmount: w.fiatAmount,
        fiatCurrency: w.fiatCurrency,
        exchangeRate: w.exchangeRate,
        status: w.status,
        txHash: w.txHash ?? undefined,
        chain: w.chain ?? undefined,
        bankDetails: w.bankDetails
          ? { bankName: w.bankDetails.bankName, accountNumber: w.bankDetails.accountNumber, accountName: w.bankDetails.accountName }
          : undefined,
        createdAt: w.createdAt instanceof Date ? w.createdAt.toISOString() : String(w.createdAt),
        completedAt: w.completedAt instanceof Date ? w.completedAt.toISOString() : undefined,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { success: true, transactions: unified, stats }
  } catch (error) {
    console.error("[fetchTransactions] Error:", error)
    return { success: false, error: "Failed to fetch transactions" }
  }
}
