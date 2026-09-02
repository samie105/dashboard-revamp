"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CardHeader,
  CardShell,
  EmptyState,
  Eyebrow,
  IconAction,
  PageHeader,
  Segmented,
  SkeletonRows,
} from "@/components/ui/system"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  Copy01Icon,
  Exchange01Icon,
  Loading03Icon,
  Search01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Activity01Icon,
  RepeatIcon,
  Link01Icon,
  Download01Icon,
  Calendar01Icon,
  LinkSquare01Icon,
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

/* Status has three jobs on this page: colour the pill, name the state, and say
   where the transaction sits on its timeline. Keeping all three in one record
   means the pill and the tracker can never disagree about what "processing"
   looks like.

   `step` is the last timeline node reached; `terminal` marks the states that
   stop the clock without finishing (a cancelled transfer never "completes",
   and drawing it as a half-finished success would be a lie). */
const STATUS_CONFIG: Record<
  string,
  {
    label: string
    icon: typeof CheckmarkCircle01Icon
    /** Chip wash + text, drawn from the money-direction tokens. */
    chip: string
    step: number
    terminal?: "failed" | "stopped"
  }
> = {
  pending:    { label: "Pending",    icon: Clock01Icon,             chip: "bg-warning-chip text-warning",                  step: 0 },
  processing: { label: "Processing", icon: Loading03Icon,           chip: "bg-warning-chip text-warning",                  step: 1 },
  completed:  { label: "Completed",  icon: CheckmarkCircle01Icon,   chip: "bg-credit-chip text-credit",                    step: 2 },
  failed:     { label: "Failed",     icon: AlertCircleIcon,         chip: "bg-debit-chip text-debit",                      step: 1, terminal: "failed" },
  cancelled:  { label: "Cancelled",  icon: Cancel01Icon,            chip: "bg-foreground/[0.06] text-muted-foreground",    step: 1, terminal: "stopped" },
  expired:    { label: "Expired",    icon: Clock01Icon,             chip: "bg-foreground/[0.06] text-muted-foreground",    step: 1, terminal: "stopped" },
}

const CURRENCY_SYMBOLS: Record<string, string> = { NGN: "₦", USD: "$", GBP: "£", EUR: "€" }

const CHAIN_LABELS: Record<string, string> = {
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  solana: "Solana",
  sui: "Sui",
  ton: "TON",
  tron: "Tron",
}

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

function fmtFiat(amount: number, currency = "USD") {
  return `${CURRENCY_SYMBOLS[currency] || ""}${fmtAmount(amount)}${currency === "USD" ? "" : ` ${currency}`}`
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`
}

function chainLabel(chain?: string) {
  if (!chain) return undefined
  return CHAIN_LABELS[chain] ?? chain.charAt(0).toUpperCase() + chain.slice(1)
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

/* Which way the money went. This replaces a palette that gave trades blue,
   swaps purple, internal transfers yellow and sends orange — four hues that
   encoded nothing a reader could act on, in a system where colour is supposed
   to mean exactly one thing. Money has three directions and now shows three.
   A swap is deliberately neutral: it isn't income or spending, it's the same
   money in a different shape. */
type Direction = "in" | "out" | "neutral"

function directionOf(tx: UnifiedTransaction): Direction {
  switch (tx.type) {
    case "deposit":
    case "spot_deposit":
      return "in"
    case "withdrawal":
      return "out"
    case "p2p":
      return tx.subType === "buy" ? "in" : "out"
    case "transfer":
      if (tx.subType === "receive" || tx.direction === "incoming") return "in"
      if (tx.subType === "send" || tx.direction === "outgoing") return "out"
      return "neutral"
    default:
      return "neutral"
  }
}

const DIRECTION_STYLE: Record<Direction, { chip: string; text: string; sign: string }> = {
  in:      { chip: "bg-credit-chip text-credit", text: "text-credit", sign: "+" },
  out:     { chip: "bg-debit-chip text-debit",   text: "text-debit",  sign: "−" },
  neutral: { chip: "bg-foreground/[0.06] text-muted-foreground", text: "text-foreground", sign: "" },
}

function typeIcon(tx: UnifiedTransaction) {
  switch (tx.type) {
    case "swap": return RepeatIcon
    case "spot_trade":
    case "spot_order": return Activity01Icon
    case "transfer":
      if (tx.subType === "internal" || tx.direction?.includes("-to-")) return Link01Icon
      return directionOf(tx) === "in" ? ArrowDown01Icon : ArrowUp01Icon
    default:
      return directionOf(tx) === "in" ? ArrowDown01Icon : ArrowUp01Icon
  }
}

function typeLabel(tx: UnifiedTransaction) {
  switch (tx.type) {
    case "deposit":
      return tx.subType === "onchain" ? "Received" : "Deposit"
    case "spot_deposit": return "Spot deposit"
    case "withdrawal": return "Withdrawal"
    case "p2p": return tx.subType === "buy" ? "P2P deposit" : "P2P withdrawal"
    case "spot_trade":
    case "spot_order": return tx.pair ? `Trade ${tx.pair}` : "Spot trade"
    case "swap": return "Swap"
    case "transfer":
      if (tx.subType === "internal" || tx.direction?.includes("-to-")) return "Internal transfer"
      return directionOf(tx) === "in" ? "Received" : "Sent"
    default: return "Transaction"
  }
}

/** One plain sentence for what happened. The detail panel used to open with a
 *  grid of twenty grey chips in which "Type" carried the same visual weight as
 *  the transaction hash — the reader had to assemble the story themselves. */
function summarise(tx: UnifiedTransaction) {
  const amt = `${fmtAmount(tx.amount)} ${tx.token}`
  const on = tx.chain ? ` on ${chainLabel(tx.chain)}` : ""
  switch (tx.type) {
    case "deposit":
      return tx.subType === "onchain"
        ? `Received ${amt}${on}`
        : `Deposited ${amt}${tx.fiatAmount ? ` for ${fmtFiat(tx.fiatAmount, tx.fiatCurrency)}` : ""}`
    case "spot_deposit":
      return `Moved ${amt} into your spot trading account`
    case "withdrawal":
      return `Withdrew ${amt}${tx.bankDetails ? ` to ${tx.bankDetails.bankName}` : on}`
    case "p2p":
      return tx.subType === "buy"
        ? `Bought ${amt} from a P2P seller`
        : `Sold ${amt} to a P2P buyer`
    case "swap": {
      const to = tx.toAmount != null ? `${fmtAmount(Number(tx.toAmount), 2)} ${tx.toToken}` : tx.toToken
      return to ? `Swapped ${amt} for ${to}` : `Swapped ${amt}`
    }
    case "spot_trade":
    case "spot_order": {
      const side = String(tx.side ?? "").toLowerCase()
      const verb = side === "sell" ? "Sold" : "Bought"
      return `${verb} ${amt}${tx.pair ? ` on ${tx.pair}` : ""}${tx.price ? ` at ${fmtFiat(tx.price)}` : ""}`
    }
    case "transfer":
      if (tx.subType === "internal" || tx.direction?.includes("-to-")) {
        return `Moved ${amt} between your accounts`
      }
      return directionOf(tx) === "in" ? `Received ${amt}${on}` : `Sent ${amt}${on}`
    default:
      return `${amt}${on}`
  }
}

/** The counterparty, in as few characters as it takes: who you paid, what you
 *  got back, which market. Without it the row runs label … amount with 400px
 *  of nothing in between on a wide screen, and the reader has to open every
 *  transaction to find out who it was with. */
function counterparty(tx: UnifiedTransaction): string | null {
  if (tx.type === "swap" && tx.toToken) {
    const to = tx.toAmount != null ? `${fmtAmount(Number(tx.toAmount))} ${tx.toToken}` : tx.toToken
    return `→ ${to}`
  }
  if (tx.bankDetails) return `to ${tx.bankDetails.bankName}`
  if (tx.pair) return tx.pair
  const dir = directionOf(tx)
  if (dir === "in" && tx.fromAddress) return `from ${truncateHash(tx.fromAddress)}`
  if (dir === "out" && tx.toAddress) return `to ${truncateHash(tx.toAddress)}`
  if (tx.direction?.includes("-to-")) return tx.direction.replace(/-/g, " ").replace(" to ", " → ")
  return null
}

/** "Today" / "Yesterday" / "Fri, 15 Aug" — the header for a day's group. */
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  })
}

// ── Status pill ──────────────────────────────────────────────────────────

function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.chip} ${className ?? ""}`}
    >
      <HugeiconsIcon
        icon={s.icon}
        aria-hidden
        className={`h-3.5 w-3.5 ${status === "processing" ? "animate-spin" : ""}`}
      />
      {s.label}
    </span>
  )
}

// ── Main component ───────────────────────────────────────────────────────

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

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const activeType = (filters.type || "all") as UnifiedTransactionType | "all"
  const activeStatus = (filters.status || "all") as UnifiedTransactionStatus | "all"
  const hasDateFilter = Boolean(filters.dateFrom || filters.dateTo)

  /* One day per group. A flat list of forty rows makes the reader parse a date
     column to work out where "this week" ends; a dated header does it once. */
  const groups = React.useMemo(() => {
    const out: { label: string; items: UnifiedTransaction[] }[] = []
    for (const tx of transactions) {
      const label = dayLabel(tx.createdAt)
      const last = out[out.length - 1]
      if (last && last.label === label) last.items.push(tx)
      else out.push({ label, items: [tx] })
    }
    return out
  }, [transactions])

  /* The stat row is about MONEY, so it's named for money. It used to count
     things ("Deposits: 3") in the big figure and hide the volume underneath in
     small text, which put the least interesting number in the largest type. */
  const statCards = stats
    ? [
        {
          label: "Money in",
          value: `$${fmtAmount(stats.depositVolume)}`,
          sub: `${stats.totalDeposits} deposit${stats.totalDeposits === 1 ? "" : "s"}`,
          tone: "text-credit",
        },
        {
          label: "Money out",
          value: `$${fmtAmount(stats.withdrawalVolume)}`,
          sub: `${stats.totalWithdrawals} withdrawal${stats.totalWithdrawals === 1 ? "" : "s"}`,
          tone: "text-debit",
        },
        {
          label: "Moved",
          value: String(stats.totalTrades + stats.totalSwaps + stats.totalTransfers),
          sub: `${stats.totalTrades + stats.totalSwaps} trades · ${stats.totalTransfers} transfers`,
          tone: "text-foreground",
        },
        {
          label: "Net",
          value: `${stats.netVolume >= 0 ? "+" : "−"}$${fmtAmount(Math.abs(stats.netVolume))}`,
          sub: "In minus out",
          tone: stats.netVolume >= 0 ? "text-credit" : "text-debit",
        },
      ]
    : null

  const filtered = Boolean(filters.type || filters.status || filters.search || hasDateFilter)

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 lg:p-8">
      <PageHeader
        title="Transactions"
        subtitle="Every movement of money, across all your accounts"
        actions={
          <>
            <IconAction
              icon={({ className }: { className?: string }) => (
                <HugeiconsIcon icon={Download01Icon} className={className} />
              )}
              label="Export PDF"
              onClick={() => transactions.length > 0 && exportTransactionsPdf(transactions)}
            />
            <IconAction
              icon={({ className }: { className?: string }) => (
                <HugeiconsIcon
                  icon={isLoading ? Loading03Icon : Exchange01Icon}
                  className={`${className} ${isLoading ? "animate-spin" : ""}`}
                />
              )}
              label="Refresh"
              onClick={refresh}
            />
          </>
        }
      />

      {/* ── Summary — four figures, in the money-direction palette ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(statCards ?? Array.from({ length: 4 }, () => null)).map((card, i) => (
          <div key={card?.label ?? i} className="flex flex-col gap-1.5 rounded-2xl bg-card/80 p-4">
            {card ? (
              <>
                <Eyebrow>{card.label}</Eyebrow>
                <span className={`text-[19px] font-semibold tabular-nums tracking-tight ${card.tone}`}>
                  {card.value}
                </span>
                <p className="text-[13px] text-muted-foreground">{card.sub}</p>
              </>
            ) : (
              <>
                <span className="skel h-2.5 w-16 rounded" />
                <span className="skel h-5 w-24 rounded" />
                <span className="skel h-3 w-20 rounded" />
              </>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-debit-chip px-4 py-3 text-[13px] text-debit">{error}</div>
      )}

      {/* ── History ── */}
      <CardShell>
        <CardHeader
          title="History"
          subtitle={
            isLoading
              ? "Loading…"
              : `${transactions.length} ${transactions.length === 1 ? "transaction" : "transactions"}${filtered ? " matching your filters" : ""}`
          }
          /* The tabs sit in the header's right slot from `lg` up and drop to
             their own row below it under that. In the slot on a phone they
             squeezed "14 transactions" into a two-line column beside them and
             left the search box about 60px wide. */
          right={
            <div className="hidden max-w-full overflow-x-auto scrollbar-none lg:block">
              <Segmented
                options={TYPE_TABS}
                value={activeType}
                onChange={(key) => setFilters({ type: key === "all" ? undefined : key })}
                size="sm"
              />
            </div>
          }
        />

        <div className="-mx-1 max-w-full overflow-x-auto px-5 pb-3 scrollbar-none lg:hidden">
          <Segmented
            options={TYPE_TABS}
            value={activeType}
            onChange={(key) => setFilters({ type: key === "all" ? undefined : key })}
            size="sm"
          />
        </div>

        {/* Filters — search, status, date. One quiet row, not two loud ones. */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <div className="relative w-full min-w-0 sm:max-w-72 sm:flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
            />
            <input
              type="search"
              placeholder="Search hash, token, address…"
              value={filters.search || ""}
              onChange={(e) => setFilters({ search: e.target.value || undefined })}
              className="h-9 w-full rounded-full bg-surface-sunken pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <label className="sr-only" htmlFor="tx-status">Status</label>
          <select
            id="tx-status"
            value={activeStatus}
            onChange={(e) =>
              setFilters({
                status:
                  e.target.value === "all"
                    ? undefined
                    : (e.target.value as UnifiedTransactionStatus),
              })
            }
            className={`h-9 shrink-0 rounded-full px-3 text-[13px] font-medium outline-none transition-colors ${
              activeStatus === "all"
                ? "bg-surface-sunken text-muted-foreground"
                : "bg-primary/[0.12] text-primary"
            }`}
          >
            {STATUS_PILLS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.key === "all" ? "Any status" : p.label}
              </option>
            ))}
          </select>

          <div className="relative shrink-0" ref={dateRef}>
            <button
              onClick={() => setShowDatePicker((v) => !v)}
              className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
                hasDateFilter
                  ? "bg-primary/[0.12] text-primary"
                  : "bg-surface-sunken text-muted-foreground hover:text-foreground"
              }`}
            >
              <HugeiconsIcon icon={Calendar01Icon} aria-hidden className="h-3.5 w-3.5" />
              {hasDateFilter ? "Dated" : "Any date"}
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-full z-20 mt-2 min-w-60 rounded-2xl bg-popover p-3 shadow-2xl ring-1 ring-border/40">
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="mb-1 block text-[12px] text-muted-foreground">From</label>
                    <input
                      type="date"
                      value={filters.dateFrom || ""}
                      onChange={(e) => setFilters({ dateFrom: e.target.value || undefined })}
                      className="h-9 w-full rounded-lg bg-surface-sunken px-2.5 text-[13px] outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[12px] text-muted-foreground">To</label>
                    <input
                      type="date"
                      value={filters.dateTo || ""}
                      onChange={(e) => setFilters({ dateTo: e.target.value || undefined })}
                      className="h-9 w-full rounded-lg bg-surface-sunken px-2.5 text-[13px] outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                  {hasDateFilter && (
                    <button
                      onClick={() => {
                        setFilters({ dateFrom: undefined, dateTo: undefined })
                        setShowDatePicker(false)
                      }}
                      className="rounded-lg py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── The list ── */}
        {isLoading ? (
          <SkeletonRows rows={7} label="Loading transactions" />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={({ className }) => <HugeiconsIcon icon={Exchange01Icon} className={className} />}
            title={filtered ? "Nothing matches those filters" : "No transactions yet"}
            description={
              filtered
                ? "Try a wider date range, or clear the status filter."
                : "Deposits, withdrawals, swaps and transfers all land here."
            }
            ctas={filtered ? [] : [{ label: "Make a deposit", href: "/buy" }]}
          />
        ) : (
          <div className="flex flex-col">
            {groups.map((group) => (
              <section key={group.label}>
                {/* The day header replaces a date column that every row had to
                    repeat. Sticky, so you always know where you are in a long
                    scroll. */}
                <h3 className="sticky top-0 z-10 bg-card/85 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 backdrop-blur-sm">
                  {group.label}
                </h3>
                {group.items.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    expanded={expandedId === tx.id}
                    onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}

        {hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && (
              <HugeiconsIcon icon={Loading03Icon} className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </CardShell>
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────

/* One row shape for every breakpoint. The page used to keep a 640px-min table
   for desktop and a separate card list for phones — two markup trees, two sets
   of styles, and a detail panel rendered twice. */
function TransactionRow({
  tx,
  expanded,
  onToggle,
}: {
  tx: UnifiedTransaction
  expanded: boolean
  onToggle: () => void
}) {
  const dir = directionOf(tx)
  const style = DIRECTION_STYLE[dir]
  const Icon = typeIcon(tx)
  const peer = counterparty(tx)
  const failed = tx.status === "failed" || tx.status === "cancelled" || tx.status === "expired"

  return (
    <div className="border-t border-border/10 first:border-t-0">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/25"
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.chip}`}>
          <HugeiconsIcon icon={Icon} aria-hidden className="h-4 w-4" />
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold">{typeLabel(tx)}</span>
          <span className="truncate text-[12.5px] text-muted-foreground">
            {[chainLabel(tx.chain), fmtTime(tx.createdAt)].filter(Boolean).join(" · ")}
          </span>
        </span>

        {/* Who it was with. Hidden on phones, where the row has no slack. */}
        {peer && (
          <span className="hidden min-w-0 max-w-[34%] flex-1 truncate text-right font-mono text-[12.5px] text-muted-foreground/80 md:block">
            {peer}
          </span>
        )}

        {/* Amount, with what it was worth underneath. A struck-through figure
            on a failed transaction says "this didn't happen" faster than the
            status pill alone can. */}
        <span className="flex w-[104px] shrink-0 flex-col items-end sm:w-40">
          <span
            className={`text-[14px] font-semibold tabular-nums ${failed ? "text-muted-foreground line-through" : style.text}`}
          >
            {style.sign}
            {fmtAmount(tx.amount)} {tx.token}
          </span>
          {tx.fiatAmount != null && (
            <span className="text-[12.5px] tabular-nums text-muted-foreground">
              {fmtFiat(tx.fiatAmount, tx.fiatCurrency)}
            </span>
          )}
        </span>

        {/* Fixed width, so the pills form a column instead of ragging with the
            length of the amount beside them. */}
        <span className="hidden w-[112px] shrink-0 justify-end sm:flex">
          <StatusPill status={tx.status} />
        </span>

        <HugeiconsIcon
          icon={ArrowRight01Icon}
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="bg-surface-sunken/50 px-4 pb-4 pt-1">
          <TransactionDetail tx={tx} />
        </div>
      )}
    </div>
  )
}

// ── Detail ───────────────────────────────────────────────────────────────

/* The breakdown, in the order a person actually asks for it:
     1. what happened, in a sentence, with the money
     2. where it is now — the tracker
     3. the specifics, grouped by the question they answer
   The old panel put all twenty facts in one flat grid of identical grey chips,
   where the transaction hash and the word "Type" looked equally important. */
function TransactionDetail({ tx }: { tx: UnifiedTransaction }) {
  const dir = directionOf(tx)
  const style = DIRECTION_STYLE[dir]
  const failed = tx.status === "failed" || tx.status === "cancelled" || tx.status === "expired"

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-card/70 p-4">
      {/* 1 ── What happened */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[15px] font-semibold leading-snug">{summarise(tx)}</p>
          <p className="text-[13px] text-muted-foreground">
            {fmtDate(tx.createdAt)} at {fmtTime(tx.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`font-display text-[22px] font-light leading-none tabular-nums ${failed ? "text-muted-foreground line-through" : style.text}`}
          >
            {style.sign}
            {fmtAmount(tx.amount)} {tx.token}
          </span>
          <StatusPill status={tx.status} />
        </div>
      </div>

      {/* 2 ── Where it is now */}
      <StatusTracker tx={tx} />

      {/* 3 ── The specifics */}
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailSection title="Amount">
          <DetailRow label={dir === "out" ? "Sent" : dir === "in" ? "Received" : "Amount"} value={`${fmtAmount(tx.amount)} ${tx.token}`} />
          {tx.fiatAmount != null && (
            <DetailRow label="Value" value={fmtFiat(tx.fiatAmount, tx.fiatCurrency)} />
          )}
          {tx.exchangeRate != null && (
            <DetailRow
              label="Rate"
              value={`1 ${tx.token} = ${fmtFiat(tx.exchangeRate, tx.fiatCurrency)}`}
            />
          )}
          {tx.price != null && <DetailRow label="Price" value={fmtFiat(tx.price)} />}
          {tx.pair && <DetailRow label="Pair" value={tx.pair} />}
          {tx.side && <DetailRow label="Side" value={String(tx.side).toUpperCase()} />}
          {tx.type === "swap" && tx.toAmount != null && (
            <DetailRow
              label="Received"
              value={`${fmtAmount(Number(tx.toAmount))} ${tx.toToken ?? ""}`.trim()}
            />
          )}
        </DetailSection>

        <DetailSection title="Route">
          {tx.chain && <DetailRow label="Network" value={chainLabel(tx.chain)!} />}
          {tx.type === "swap" && tx.fromChain && tx.toChain && (
            <DetailRow
              label="Bridge"
              value={`${chainLabel(tx.fromChain)} → ${chainLabel(tx.toChain)}`}
            />
          )}
          {tx.fromAddress && (
            <DetailRow label="From" value={truncateHash(tx.fromAddress)} mono copyValue={tx.fromAddress} />
          )}
          {tx.toAddress && (
            <DetailRow label="To" value={truncateHash(tx.toAddress)} mono copyValue={tx.toAddress} />
          )}
          {tx.direction && !tx.fromAddress && !tx.toAddress && (
            <DetailRow label="Direction" value={tx.direction.replace(/-/g, " → ")} />
          )}
          {tx.bankDetails && (
            <>
              <DetailRow label="Bank" value={tx.bankDetails.bankName} />
              <DetailRow
                label="Account"
                value={`${tx.bankDetails.accountName} · ${tx.bankDetails.accountNumber}`}
              />
            </>
          )}
          {!tx.chain && !tx.fromAddress && !tx.toAddress && !tx.bankDetails && !tx.direction && (
            <p className="px-3 py-2 text-[13px] text-muted-foreground/60">
              No route recorded — this stayed inside WorldStreet.
            </p>
          )}
        </DetailSection>
      </div>

      {/* Reference — the ids you'd quote to support, full width because a hash
          in a half-width column truncates into uselessness. */}
      <DetailSection title="Reference">
        <DetailRow
          label="Transaction ID"
          value={`#${tx.id.slice(-8).toUpperCase()}`}
          mono
          copyValue={tx.id}
        />
        {tx.txHash && (
          <DetailRow
            label="Hash"
            value={truncateHash(tx.txHash)}
            mono
            copyValue={tx.txHash}
            href={explorerUrl(tx.chain, tx.txHash)}
          />
        )}
      </DetailSection>
    </div>
  )
}

/* ── Status tracker ────────────────────────────────────────────────────────
   The one thing the brief asked for by name. Status was a nine-pixel label in
   a table cell; it's now a rail with the timestamps attached, so "where is my
   money" is answered by looking, not by reading. Terminal failures stop the
   rail where they stopped rather than drawing an unreached third node. */
function StatusTracker({ tx }: { tx: UnifiedTransaction }) {
  const cfg = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending

  const steps =
    cfg.terminal === "failed"
      ? [
          { label: "Submitted", at: tx.createdAt },
          { label: "Failed", at: tx.completedAt },
        ]
      : cfg.terminal === "stopped"
        ? [
            { label: "Submitted", at: tx.createdAt },
            { label: cfg.label, at: tx.completedAt },
          ]
        : [
            { label: "Submitted", at: tx.createdAt },
            { label: "Processing", at: undefined },
            { label: "Completed", at: tx.completedAt },
          ]

  const reached = cfg.terminal ? 1 : cfg.step
  const tone =
    cfg.terminal === "failed"
      ? "bg-debit"
      : cfg.terminal === "stopped"
        ? "bg-muted-foreground"
        : "bg-credit"

  return (
    <ol className="flex max-w-2xl items-start gap-0 rounded-xl bg-surface-sunken/70 px-4 py-3">
      {steps.map((step, i) => {
        const done = i <= reached
        return (
          <li key={step.label} className={`flex min-w-0 items-start ${i === steps.length - 1 ? "" : "flex-1"}`}>
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? tone : "bg-foreground/15"} ${
                  // The live edge pulses; a finished one shouldn't.
                  done && i === reached && !cfg.terminal && cfg.step < 2
                    ? "motion-safe:animate-pulse"
                    : ""
                }`}
              />
              <span className={`whitespace-nowrap text-[12px] font-medium ${done ? "text-foreground" : "text-muted-foreground/50"}`}>
                {step.label}
              </span>
              <span className="whitespace-nowrap text-[11.5px] tabular-nums text-muted-foreground/60">
                {step.at ? fmtTime(step.at) : done ? "—" : ""}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`mt-[4px] h-0.5 min-w-4 flex-1 rounded-full ${i < reached ? tone : "bg-foreground/10"}`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Detail primitives ────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-sunken/70 p-3">
      <Eyebrow className="px-1 pb-1">{title}</Eyebrow>
      {children}
    </div>
  )
}

function DetailRow({
  label,
  value,
  href,
  mono,
  copyValue,
}: {
  label: string
  value: string
  href?: string
  mono?: boolean
  copyValue?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    copyToClipboard(copyValue ?? value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`truncate text-[13px] font-medium text-primary hover:underline ${mono ? "font-mono" : ""}`}
          >
            {value}
          </a>
        ) : (
          <span className={`truncate text-[13px] font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
        )}
        {href && (
          <HugeiconsIcon icon={LinkSquare01Icon} aria-hidden className="h-3 w-3 shrink-0 text-primary/70" />
        )}
        {copyValue && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              copy()
            }}
            aria-label={`Copy ${label}`}
            className="shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            <HugeiconsIcon
              icon={copied ? CheckmarkCircle01Icon : Copy01Icon}
              className={`h-3.5 w-3.5 ${copied ? "text-credit" : ""}`}
            />
          </button>
        )}
      </span>
    </div>
  )
}
