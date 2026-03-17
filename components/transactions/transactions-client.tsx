"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Copy01Icon,
  Exchange01Icon,
  Loading03Icon,
  Search01Icon,
  FilterIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Activity01Icon,
  RepeatIcon,
  Link01Icon,
  Download01Icon,
  Calendar01Icon,
} from "@hugeicons/core-free-icons"
import { useUnifiedTransactions } from "@/hooks/use-unified-transactions"
import { exportTransactionsPdf } from "@/lib/export-transactions-pdf"
import type {
  UnifiedTransaction,
  UnifiedTransactionType,
  UnifiedTransactionStatus,
} from "@/types/transactions"

// ── Constants ────────────────────────────────────────────────────────────

const TYPE_TABS: { key: UnifiedTransactionType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "spot_trade", label: "Trades" },
  { key: "swap", label: "Swaps" },
  { key: "transfer", label: "Transfers" },
]

const STATUS_PILLS: { key: UnifiedTransactionStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "cancelled", label: "Cancelled" },
]

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: typeof CheckmarkCircle01Icon }> = {
  pending:     { color: "text-amber-500",        label: "Pending",    icon: Clock01Icon },
  processing:  { color: "text-orange-500",        label: "Processing", icon: Loading03Icon },
  completed:   { color: "text-emerald-500",       label: "Completed",  icon: CheckmarkCircle01Icon },
  failed:      { color: "text-red-500",           label: "Failed",     icon: AlertCircleIcon },
  cancelled:   { color: "text-muted-foreground",  label: "Cancelled",  icon: Cancel01Icon },
  expired:     { color: "text-muted-foreground",  label: "Expired",    icon: Clock01Icon },
}

const CURRENCY_SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" }

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function fmtAmount(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: Math.max(digits, 6) })
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function explorerUrl(chain: string | undefined, txHash: string) {
  switch (chain) {
    case "ethereum": return `https://etherscan.io/tx/${txHash}`
    case "arbitrum": return `https://arbiscan.io/tx/${txHash}`
    case "sui": return `https://suiscan.xyz/mainnet/tx/${txHash}`
    case "tron": return `https://tronscan.org/#/transaction/${txHash}`
    default: return `https://solscan.io/tx/${txHash}`
  }
}

function getTypeConfig(tx: UnifiedTransaction) {
  switch (tx.type) {
    case "deposit":
    case "spot_deposit":
      return { label: tx.type === "spot_deposit" ? "Spot Deposit" : "Deposit", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: ArrowDown01Icon }
    case "withdrawal":
      return { label: "Withdrawal", color: "text-red-400", bg: "bg-red-500/10", icon: ArrowUp01Icon }
    case "p2p":
      return tx.subType === "buy"
        ? { label: "P2P Deposit", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: ArrowDown01Icon }
        : { label: "P2P Withdrawal", color: "text-red-400", bg: "bg-red-500/10", icon: ArrowUp01Icon }
    case "spot_trade":
    case "spot_order":
      return { label: tx.pair ? `Trade ${tx.pair}` : "Spot Trade", color: "text-blue-500", bg: "bg-blue-500/10", icon: Activity01Icon }
    case "swap":
      return { label: "Swap", color: "text-purple-500", bg: "bg-purple-500/10", icon: RepeatIcon }
    case "transfer":
      if (tx.subType === "internal" || tx.direction?.includes("-to-")) {
        return { label: "Internal Transfer", color: "text-yellow-500", bg: "bg-yellow-500/10", icon: Link01Icon }
      }
      return { label: "Send", color: "text-orange-500", bg: "bg-orange-500/10", icon: ArrowUp01Icon }
    default:
      return { label: "Transaction", color: "text-muted-foreground", bg: "bg-accent/50", icon: Exchange01Icon }
  }
}

function getAmountColor(tx: UnifiedTransaction): string {
  if (tx.type === "deposit" || tx.type === "spot_deposit" || (tx.type === "p2p" && tx.subType === "buy")) return "text-emerald-500"
  if (tx.type === "withdrawal" || (tx.type === "p2p" && tx.subType === "sell")) return "text-red-400"
  if (tx.type === "transfer" && tx.subType === "send") return "text-orange-500"
  return "text-foreground"
}

function getAmountPrefix(tx: UnifiedTransaction): string {
  if (tx.type === "deposit" || tx.type === "spot_deposit" || (tx.type === "p2p" && tx.subType === "buy")) return "+"
  if (tx.type === "withdrawal" || (tx.type === "p2p" && tx.subType === "sell") || (tx.type === "transfer" && tx.subType === "send")) return "-"
  return ""
}

// ── StatusBadge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.color}`}>
      <HugeiconsIcon icon={s.icon} className="h-3 w-3" />
      {s.label}
    </span>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function TransactionsClient() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [showDatePicker, setShowDatePicker] = React.useState(false)
  const dateRef = React.useRef<HTMLDivElement>(null)

  const {
    transactions,
    stats,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    filters,
    setFilters,
    refresh,
    sentinelRef,
  } = useUnifiedTransactions({ pollInterval: 30000 })

  // Close date picker on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const activeType = filters.type || "all"
  const activeStatus = filters.status || "all"
  const hasDateFilter = filters.dateFrom || filters.dateTo

  // ── Stat cards ──
  const statCards = stats
    ? [
        { label: "Deposits", value: String(stats.totalDeposits), sub: `${fmtAmount(stats.depositVolume)} USDT`, icon: ArrowDown01Icon, color: "text-emerald-500" },
        { label: "Withdrawals", value: String(stats.totalWithdrawals), sub: `${fmtAmount(stats.withdrawalVolume)} USDT`, icon: ArrowUp01Icon, color: "text-red-400" },
        { label: "Trades & Swaps", value: String(stats.totalTrades + stats.totalSwaps), sub: `${stats.totalTransfers} transfers`, icon: Activity01Icon, color: "text-blue-500" },
        { label: "Net Volume", value: `$${fmtAmount(stats.netVolume)}`, sub: "USDT total", icon: Exchange01Icon, color: "text-primary" },
      ]
    : null

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pt-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Transactions</h1>
          <p className="text-xs text-muted-foreground">Your complete transaction history</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportTransactionsPdf(transactions)}
            disabled={transactions.length === 0}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
          >
            <HugeiconsIcon icon={Download01Icon} className="h-3 w-3" />
            PDF
          </button>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
          >
            {isLoading ? (
              <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Exchange01Icon} className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      {statCards && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-border/40 bg-card p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg bg-accent/50 ${card.color}`}>
                  <HugeiconsIcon icon={card.icon} className="h-3.5 w-3.5" />
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums tracking-tight">{card.value}</span>
              {card.sub && <p className={`text-[10px] mt-0.5 ${card.color}`}>{card.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="rounded-2xl border border-border/40 bg-card">
        {/* Type Tabs + Search + Date + PDF */}
        <div className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Type tabs */}
          <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border/50 bg-background p-0.5">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilters({ type: tab.key === "all" ? undefined : tab.key })}
                className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeType === tab.key
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search + Date filter */}
          <div className="flex items-center gap-2">
            <div className="relative max-w-56 flex-1">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search hash, token, address…"
                value={filters.search || ""}
                onChange={(e) => setFilters({ search: e.target.value || undefined })}
                className="w-full rounded-lg border border-border/50 bg-background py-1.5 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50"
              />
            </div>

            {/* Date filter */}
            <div className="relative" ref={dateRef}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  hasDateFilter
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                <HugeiconsIcon icon={Calendar01Icon} className="h-3 w-3" />
                {hasDateFilter ? "Filtered" : "Date"}
              </button>

              {showDatePicker && (
                <div className="absolute right-0 top-full z-20 mt-2 min-w-56 rounded-xl border border-border/50 bg-card p-3 shadow-lg">
                  <div className="space-y-2.5">
                    <div>
                      <label className="mb-1 block text-[10px] text-muted-foreground">From</label>
                      <input
                        type="date"
                        value={filters.dateFrom || ""}
                        onChange={(e) => setFilters({ dateFrom: e.target.value || undefined })}
                        className="w-full rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] text-muted-foreground">To</label>
                      <input
                        type="date"
                        value={filters.dateTo || ""}
                        onChange={(e) => setFilters({ dateTo: e.target.value || undefined })}
                        className="w-full rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    {hasDateFilter && (
                      <button
                        onClick={() => {
                          setFilters({ dateFrom: undefined, dateTo: undefined })
                          setShowDatePicker(false)
                        }}
                        className="w-full py-1 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                      >
                        Clear dates
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/20 px-4 py-2">
          <HugeiconsIcon icon={FilterIcon} className="h-3 w-3 shrink-0 text-muted-foreground" />
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilters({ status: pill.key === "all" ? undefined : pill.key })}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                activeStatus === pill.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          ))}
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            {transactions.length} result{transactions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Transaction list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
              <HugeiconsIcon icon={Exchange01Icon} className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">No transactions found</p>
            <p className="text-[10px] text-muted-foreground/60">
              {(filters.type || filters.status || filters.search)
                ? "Try adjusting your filters or search"
                : "Your transactions will appear here"}
            </p>
            {!filters.type && !filters.status && !filters.search && (
              <div className="mt-2 flex items-center gap-2">
                <a href="/deposit" className="rounded-lg bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary/90">
                  Deposit
                </a>
                <a href="/withdraw" className="rounded-lg border border-border/50 px-3.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent/50">
                  Withdraw
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-hidden">
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20 bg-accent/10 text-[10px] text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Date</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 text-right font-medium">Details</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                    <th className="px-4 py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {transactions.map((tx) => {
                    const config = getTypeConfig(tx)
                    return (
                      <React.Fragment key={tx.id}>
                        <tr
                          onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                          className="cursor-pointer transition-colors hover:bg-accent/20"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${config.bg}`}>
                                <HugeiconsIcon icon={config.icon} className={`h-3.5 w-3.5 ${config.color}`} />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{config.label}</span>
                                {tx.chain && <span className="text-[9px] uppercase text-muted-foreground">{tx.chain}</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{fmtDate(tx.createdAt)}</span>
                              <span className="text-[10px] text-muted-foreground/60">{fmtTime(tx.createdAt)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            <span className={getAmountColor(tx)}>
                              {getAmountPrefix(tx)}{fmtAmount(tx.amount)} {tx.token}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            {tx.fiatAmount != null && tx.fiatCurrency ? (
                              <span>{CURRENCY_SYMBOLS[tx.fiatCurrency] || ""}{fmtAmount(tx.fiatAmount)} {tx.fiatCurrency}</span>
                            ) : tx.type === "swap" && tx.toToken ? (
                              <span>→ {typeof tx.toAmount === "string" ? parseFloat(tx.toAmount).toLocaleString(undefined, { maximumFractionDigits: 6 }) : tx.toAmount} {tx.toToken}</span>
                            ) : tx.pair ? (
                              <span>{tx.pair}</span>
                            ) : tx.direction ? (
                              <span className="capitalize text-[10px]">{tx.direction.replace(/-/g, " → ")}</span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge status={tx.status} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <HugeiconsIcon
                              icon={ArrowRight01Icon}
                              className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${expandedId === tx.id ? "rotate-90" : ""}`}
                            />
                          </td>
                        </tr>
                        {expandedId === tx.id && (
                          <tr>
                            <td colSpan={6} className="bg-accent/5 px-4 py-3">
                              <TransactionDetail tx={tx} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col divide-y divide-border/10 sm:hidden">
              {transactions.map((tx) => {
                const config = getTypeConfig(tx)
                return (
                  <div key={tx.id}>
                    <button
                      onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/20"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
                        <HugeiconsIcon icon={config.icon} className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{config.label}</span>
                          <span className={`text-xs font-semibold tabular-nums ${getAmountColor(tx)}`}>
                            {getAmountPrefix(tx)}{fmtAmount(tx.amount)} {tx.token}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{fmtDate(tx.createdAt)}</span>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    </button>
                    {expandedId === tx.id && (
                      <div className="bg-accent/5 px-4 py-3">
                        <TransactionDetail tx={tx} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && (
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Expanded Detail Panel ────────────────────────────────────────────────

function TransactionDetail({ tx }: { tx: UnifiedTransaction }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <DetailRow label="ID" value={`#${tx.id.slice(-8).toUpperCase()}`} copyable copyValue={tx.id} />
      <DetailRow
        label="Type"
        value={
          tx.type === "p2p"
            ? `P2P ${tx.subType}`
            : tx.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        }
      />
      <DetailRow label="Amount" value={`${fmtAmount(tx.amount)} ${tx.token}`} />
      {tx.chain && <DetailRow label="Network" value={tx.chain.toUpperCase()} />}

      {/* Fiat info */}
      {tx.fiatAmount != null && tx.fiatCurrency && (
        <>
          <DetailRow label="Fiat Amount" value={`${CURRENCY_SYMBOLS[tx.fiatCurrency] || ""}${fmtAmount(tx.fiatAmount)} ${tx.fiatCurrency}`} />
          {tx.exchangeRate != null && (
            <DetailRow label="Exchange Rate" value={`1 USDT = ${CURRENCY_SYMBOLS[tx.fiatCurrency] || ""}${fmtAmount(tx.exchangeRate)}`} />
          )}
        </>
      )}

      {/* Trade-specific */}
      {tx.pair && <DetailRow label="Pair" value={tx.pair} />}
      {tx.side && <DetailRow label="Side" value={String(tx.side).toUpperCase()} />}
      {tx.price != null && <DetailRow label="Price" value={fmtAmount(tx.price, 8)} />}

      {/* Swap-specific */}
      {tx.type === "swap" && tx.fromToken && tx.toToken && (
        <DetailRow label="Swap" value={`${tx.fromToken} → ${tx.toToken}`} />
      )}
      {tx.type === "swap" && tx.fromChain && tx.toChain && (
        <DetailRow label="Route" value={`${tx.fromChain} → ${tx.toChain}`} />
      )}
      {tx.type === "swap" && tx.toAmount && (
        <DetailRow label="Received" value={`${typeof tx.toAmount === "string" ? parseFloat(tx.toAmount).toLocaleString(undefined, { maximumFractionDigits: 6 }) : tx.toAmount} ${tx.toToken}`} />
      )}

      {/* Transfer direction */}
      {tx.direction && <DetailRow label="Direction" value={tx.direction.replace(/-/g, " → ")} />}

      {/* Addresses */}
      {tx.fromAddress && <DetailRow label="From" value={truncateHash(tx.fromAddress)} copyable copyValue={tx.fromAddress} />}
      {tx.toAddress && <DetailRow label="To" value={truncateHash(tx.toAddress)} copyable copyValue={tx.toAddress} />}

      {/* Bank details */}
      {tx.bankDetails && (
        <>
          <DetailRow label="Bank" value={tx.bankDetails.bankName} />
          <DetailRow label="Account" value={`${tx.bankDetails.accountName} • ${tx.bankDetails.accountNumber}`} />
        </>
      )}

      {/* Tx hash */}
      {tx.txHash && (
        <DetailRow
          label="Tx Hash"
          value={truncateHash(tx.txHash)}
          href={explorerUrl(tx.chain, tx.txHash)}
          copyable
          copyValue={tx.txHash}
        />
      )}

      <DetailRow label="Created" value={`${fmtDate(tx.createdAt)} at ${fmtTime(tx.createdAt)}`} />
      {tx.completedAt && (
        <DetailRow label="Completed" value={`${fmtDate(tx.completedAt)} at ${fmtTime(tx.completedAt)}`} />
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  href,
  copyable,
  copyValue,
}: {
  label: string
  value: string
  href?: string
  copyable?: boolean
  copyValue?: string
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg bg-accent/20 px-3 py-2">
      <span className="text-[10px] font-medium text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="truncate text-[11px] font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="truncate text-[11px] font-medium">{value}</span>
        )}
        {copyable && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              copyToClipboard(copyValue ?? value)
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <HugeiconsIcon icon={Copy01Icon} className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
