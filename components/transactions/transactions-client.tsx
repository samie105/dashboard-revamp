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
} from "@hugeicons/core-free-icons"
import {
  fetchTransactions,
  type UnifiedTransaction,
  type TransactionStats,
} from "@/lib/transaction-actions"

// ── Constants ────────────────────────────────────────────────────────────

const TYPE_TABS = ["All", "Deposits", "Withdrawals"] as const
type TypeTab = (typeof TYPE_TABS)[number]

const STATUS_PILLS = ["All", "Pending", "Processing", "Completed", "Failed", "Cancelled"] as const
type StatusPill = (typeof STATUS_PILLS)[number]

const STATUS_MAP: Record<string, { color: string; label: string; icon: typeof CheckmarkCircle01Icon }> = {
  pending:                { color: "text-amber-500",        label: "Pending",         icon: Clock01Icon },
  awaiting_verification:  { color: "text-blue-400",         label: "Awaiting",        icon: Clock01Icon },
  verifying:              { color: "text-blue-500",          label: "Verifying",       icon: Loading03Icon },
  payment_confirmed:      { color: "text-sky-500",           label: "Confirmed",       icon: CheckmarkCircle01Icon },
  sending_usdt:           { color: "text-orange-500",        label: "Sending",         icon: Loading03Icon },
  completed:              { color: "text-emerald-500",       label: "Completed",       icon: CheckmarkCircle01Icon },
  payment_failed:         { color: "text-red-500",           label: "Failed",          icon: Cancel01Icon },
  delivery_failed:        { color: "text-red-500",           label: "Failed",          icon: Cancel01Icon },
  failed:                 { color: "text-red-500",           label: "Failed",          icon: AlertCircleIcon },
  cancelled:              { color: "text-muted-foreground",  label: "Cancelled",       icon: Cancel01Icon },
  usdt_sent:              { color: "text-blue-500",          label: "USDT Sent",       icon: ArrowUp01Icon },
  tx_verified:            { color: "text-sky-500",           label: "Verified",        icon: CheckmarkCircle01Icon },
  processing:             { color: "text-orange-500",        label: "Processing",      icon: Loading03Icon },
  ngn_sent:               { color: "text-teal-500",          label: "Payout Sent",     icon: ArrowUp01Icon },
}

const PILL_STATUS_GROUP: Record<StatusPill, string[]> = {
  All:        [],
  Pending:    ["pending", "awaiting_verification"],
  Processing: ["verifying", "payment_confirmed", "sending_usdt", "usdt_sent", "tx_verified", "processing", "ngn_sent"],
  Completed:  ["completed"],
  Failed:     ["payment_failed", "delivery_failed", "failed"],
  Cancelled:  ["cancelled"],
}

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

function explorerUrl(tx: UnifiedTransaction) {
  const chain = tx.chain ?? tx.network ?? "solana"
  if (chain === "ethereum") return `https://etherscan.io/tx/${tx.txHash}`
  return `https://solscan.io/tx/${tx.txHash}`
}

// ── StatusBadge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.color}`}>
      <HugeiconsIcon icon={s.icon} className="h-3 w-3" />
      {s.label}
    </span>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function TransactionsClient() {
  const [transactions, setTransactions] = React.useState<UnifiedTransaction[]>([])
  const [stats, setStats] = React.useState<TransactionStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<TypeTab>("All")
  const [activePill, setActivePill] = React.useState<StatusPill>("All")
  const [search, setSearch] = React.useState("")
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const res = await fetchTransactions()
    if (res.success) {
      setTransactions(res.transactions ?? [])
      setStats(res.stats ?? null)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => { load() }, [load])

  // ── Filtered list ──
  const filtered = React.useMemo(() => {
    let list = transactions

    // Type tab
    if (activeTab === "Deposits") list = list.filter((t) => t.type === "deposit")
    if (activeTab === "Withdrawals") list = list.filter((t) => t.type === "withdrawal")

    // Status pill
    if (activePill !== "All") {
      const group = PILL_STATUS_GROUP[activePill]
      list = list.filter((t) => group.includes(t.status))
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.usdtAmount.toString().includes(q) ||
          t.fiatAmount.toString().includes(q) ||
          t.txHash?.toLowerCase().includes(q) ||
          t._id.toLowerCase().includes(q) ||
          t.bankDetails?.accountName?.toLowerCase().includes(q),
      )
    }

    return list
  }, [transactions, activeTab, activePill, search])

  // ── Stat cards data ──
  const statCards = stats
    ? [
        { label: "Total Deposits", value: `$${fmtAmount(stats.totalDeposits)}`, icon: ArrowDown01Icon, color: "text-emerald-500" },
        { label: "Total Withdrawals", value: `$${fmtAmount(stats.totalWithdrawals)}`, icon: ArrowUp01Icon, color: "text-red-400" },
        { label: "In Progress", value: String(stats.inProgress), icon: Clock01Icon, color: "text-amber-500" },
        { label: "Net Volume", value: `$${fmtAmount(stats.netVolume)}`, icon: Exchange01Icon, color: "text-primary" },
      ]
    : null

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pt-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Transactions</h1>
          <p className="text-xs text-muted-foreground">View and track all your deposits and withdrawals</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
        >
          {loading ? (
            <HugeiconsIcon icon={Loading03Icon} className="h-3 w-3 animate-spin" />
          ) : (
            <HugeiconsIcon icon={Exchange01Icon} className="h-3 w-3" />
          )}
          Refresh
        </button>
      </div>

      {/* ── Stats Row ── */}
      {statCards && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-border/40 bg-card p-3.5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{card.label}</span>
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg bg-accent/50 ${card.color}`}>
                  <HugeiconsIcon icon={card.icon} className="h-3.5 w-3.5" />
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums tracking-tight">{card.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="rounded-2xl border border-border/40 bg-card">
          {/* Card Header — Type Tabs + Search */}
          <div className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Type tabs */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-background p-0.5">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setActivePill("All") }}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-56">
              <HugeiconsIcon icon={Search01Icon} className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search amount, hash…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background py-1.5 pl-8 pr-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/50"
              />
            </div>
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/20 px-4 py-2">
            <HugeiconsIcon icon={FilterIcon} className="h-3 w-3 shrink-0 text-muted-foreground" />
            {STATUS_PILLS.map((pill) => (
              <button
                key={pill}
                onClick={() => setActivePill(pill)}
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                  activePill === pill
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <HugeiconsIcon icon={Loading03Icon} className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
                <HugeiconsIcon icon={Exchange01Icon} className="h-5 w-5 text-muted-foreground/40" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">No transactions found</p>
              <p className="text-[10px] text-muted-foreground/60">
                {transactions.length === 0
                  ? "Your deposits and withdrawals will appear here"
                  : "Try adjusting your filters or search"}
              </p>
              {transactions.length === 0 && (
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
                      <th className="px-3 py-2 text-right font-medium">USDT</th>
                      <th className="px-3 py-2 text-right font-medium">Fiat</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {filtered.map((tx) => (
                      <React.Fragment key={tx._id}>
                        <tr
                          onClick={() => setExpandedId(expandedId === tx._id ? null : tx._id)}
                          className="cursor-pointer transition-colors hover:bg-accent/20"
                        >
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                                tx.type === "deposit" ? "bg-emerald-500/10" : "bg-red-500/10"
                              }`}>
                                <HugeiconsIcon
                                  icon={tx.type === "deposit" ? ArrowDown01Icon : ArrowUp01Icon}
                                  className={`h-3.5 w-3.5 ${tx.type === "deposit" ? "text-emerald-500" : "text-red-400"}`}
                                />
                              </div>
                              <span className="font-medium capitalize">{tx.type}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            <div className="flex flex-col">
                              <span>{fmtDate(tx.createdAt)}</span>
                              <span className="text-[10px] text-muted-foreground/60">{fmtTime(tx.createdAt)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            <span className={tx.type === "deposit" ? "text-emerald-500" : "text-red-400"}>
                              {tx.type === "deposit" ? "+" : "-"}{fmtAmount(tx.usdtAmount)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                            {tx.fiatCurrency} {fmtAmount(tx.fiatAmount)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge status={tx.status} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <HugeiconsIcon
                              icon={ArrowRight01Icon}
                              className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${expandedId === tx._id ? "rotate-90" : ""}`}
                            />
                          </td>
                        </tr>
                        {/* Expanded detail row */}
                        {expandedId === tx._id && (
                          <tr>
                            <td colSpan={6} className="bg-accent/5 px-4 py-3">
                              <TransactionDetail tx={tx} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="flex flex-col divide-y divide-border/10 sm:hidden">
                {filtered.map((tx) => (
                  <div key={tx._id}>
                    <button
                      onClick={() => setExpandedId(expandedId === tx._id ? null : tx._id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/20"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        tx.type === "deposit" ? "bg-emerald-500/10" : "bg-red-500/10"
                      }`}>
                        <HugeiconsIcon
                          icon={tx.type === "deposit" ? ArrowDown01Icon : ArrowUp01Icon}
                          className={`h-4 w-4 ${tx.type === "deposit" ? "text-emerald-500" : "text-red-400"}`}
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium capitalize">{tx.type}</span>
                          <span className={`text-xs font-semibold tabular-nums ${tx.type === "deposit" ? "text-emerald-500" : "text-red-400"}`}>
                            {tx.type === "deposit" ? "+" : "-"}{fmtAmount(tx.usdtAmount)} USDT
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{fmtDate(tx.createdAt)}</span>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    </button>
                    {expandedId === tx._id && (
                      <div className="bg-accent/5 px-4 py-3">
                        <TransactionDetail tx={tx} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result count */}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-border/20 px-4 py-2.5">
              <span className="text-[10px] text-muted-foreground">
                Showing {filtered.length} of {transactions.length} transactions
              </span>
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
      <DetailRow label="Order ID" value={tx._id} copyable />
      <DetailRow label="Type" value={tx.type === "deposit" ? "Deposit" : "Withdrawal"} />
      <DetailRow label="USDT Amount" value={`${fmtAmount(tx.usdtAmount)} USDT`} />
      <DetailRow label="Fiat Amount" value={`${tx.fiatCurrency} ${fmtAmount(tx.fiatAmount)}`} />
      <DetailRow label="Exchange Rate" value={`1 USDT = ${tx.fiatCurrency} ${fmtAmount(tx.exchangeRate)}`} />
      <DetailRow label="Network" value={(tx.chain ?? tx.network ?? "solana").toUpperCase()} />
      {tx.txHash && (
        <DetailRow
          label="Tx Hash"
          value={truncateHash(tx.txHash)}
          href={explorerUrl(tx)}
          copyable
          copyValue={tx.txHash}
        />
      )}
      {tx.bankDetails && (
        <>
          <DetailRow label="Bank" value={tx.bankDetails.bankName} />
          <DetailRow label="Account" value={`${tx.bankDetails.accountName} • ${tx.bankDetails.accountNumber}`} />
        </>
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
